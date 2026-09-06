import { ChatGroq } from '@langchain/groq';
import { jobFitSchema } from '../utils/jobFitSchema.js';
import { jobRequirementSchema } from '../utils/jobRequirementSchema.js';
import { resumeSchema } from '../utils/resumeSchema.js';
import { skillMatchSchema } from '../utils/skillMatchSchema.js';

/**
 * Defensible token budgets for structured output LLM invocations.
 * Prevents over-requesting Groq's TPM allocation while providing generous headroom
 * to prevent output truncation on realistic comprehensive schemas.
 */
export const TOKEN_BUDGETS = {
  JOB_REQUIREMENTS: 1500,
  RESUME_PROFILE: 1500,
  REQUIREMENT_COMPARISON: 1800,
  JOB_FIT_ANALYSIS: 1000
};

/**
 * Helper to sanitize error messages so raw API keys, organization IDs, and secrets
 * are never leaked to logs or client-facing errors.
 */
export const sanitizeErrorMessage = (msg) => {
  if (typeof msg !== 'string') return '';
  return msg
    .replace(/gsk_[a-zA-Z0-9_-]+/g, '[REDACTED_API_KEY]')
    .replace(/org_[a-zA-Z0-9_-]+/g, '[REDACTED_ORG]')
    .replace(/\b(?:api[_-]?key|secret)\b\s*[:=]\s*['"]?[a-zA-Z0-9_-]+['"]?/gi, '[REDACTED]');
};

/**
 * Extracts retry delay from Groq error headers or response messages.
 * Returns delay in milliseconds, or null if no timing information is present.
 */
export const parseRetryDelay = (err) => {
  // 1. Inspect HTTP Retry-After header
  const headers = err?.headers || err?.response?.headers;
  let retryAfterHeader = null;
  if (headers) {
    if (typeof headers.get === 'function') {
      retryAfterHeader = headers.get('retry-after') || headers.get('Retry-After');
    } else if (typeof headers === 'object') {
      retryAfterHeader = headers['retry-after'] || headers['Retry-After'];
    }
  }

  if (retryAfterHeader) {
    const sec = parseFloat(retryAfterHeader);
    if (!isNaN(sec) && sec > 0) {
      return sec * 1000;
    }
    const dateMs = Date.parse(retryAfterHeader);
    if (!isNaN(dateMs)) {
      const diff = dateMs - Date.now();
      if (diff > 0) return diff;
    }
  }

  // 2. Parse from error message or error details
  const message = [
    err?.message,
    err?.error?.message,
    typeof err?.error === 'string' ? err.error : ''
  ].filter(Boolean).join(' ');

  // "Please try again in 3m56.736s" or "try again in 1.6875s"
  const minSecMatch = message.match(/try again in (?:(\d+)m)?\s*([\d.]+)\s*(?:s|seconds?)/i);
  if (minSecMatch) {
    const min = minSecMatch[1] ? parseFloat(minSecMatch[1]) : 0;
    const sec = minSecMatch[2] ? parseFloat(minSecMatch[2]) : 0;
    const totalSec = (min * 60) + sec;
    if (!isNaN(totalSec) && totalSec > 0) {
      return totalSec * 1000;
    }
  }

  // "try again in 1500ms"
  const msMatch = message.match(/try again in ([\d.]+)\s*ms/i);
  if (msMatch) {
    const ms = parseFloat(msMatch[1]);
    if (!isNaN(ms) && ms > 0) {
      return ms;
    }
  }

  return null;
};

/**
 * Classifies LLM invocation errors to determine appropriate retry strategy.
 */
export const classifyError = (err) => {
  const status = err?.status || err?.statusCode || err?.response?.status;
  const message = [
    err?.message,
    err?.error?.message,
    typeof err?.error === 'string' ? err.error : ''
  ].filter(Boolean).join(' ');

  // Rate limit detection (429 or explicit rate_limit_exceeded)
  const isRateLimit =
    status === 429 ||
    err?.error?.code === 'rate_limit_exceeded' ||
    err?.code === 'rate_limit_exceeded' ||
    /rate_limit_exceeded/i.test(message) ||
    /rate limit reached/i.test(message) ||
    /\b429\b/.test(message);

  if (isRateLimit) return 'RATE_LIMIT';

  // Deterministic 4xx client errors (400 Bad Request, 401 Unauthorized, 403, 404, json_validate_failed)
  if (
    (status >= 400 && status < 500) ||
    /json_validate_failed/i.test(message) ||
    err?.error?.code === 'json_validate_failed'
  ) {
    return 'NON_RETRYABLE_CLIENT_ERROR';
  }

  // Transient server errors (5xx)
  if (status >= 500 && status < 600) return 'TRANSIENT_SERVER_ERROR';

  // Transient network connection errors
  if (/ECONNRESET|ETIMEDOUT|ENOTFOUND|fetch failed/i.test(message)) {
    return 'TRANSIENT_NETWORK_ERROR';
  }

  return 'UNKNOWN';
};

/**
 * Helper to initialize ChatGroq model instance with optional explicit maxTokens.
 */
export const createGroqChatModel = (temperature = 0.1, maxTokens = undefined) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured in the environment');
  }

  const modelName = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

  return new ChatGroq({
    model: modelName,
    apiKey,
    temperature,
    ...(maxTokens ? { maxTokens } : {})
  });
};

/**
 * Rate-limit-aware helper to invoke structured model with delay parsing and bounded retry.
 * Accepts either a factory function `async () => result` or a pre-bound `structuredLlm` + `prompt`.
 */
export const invokeWithRetry = async (fnOrStructuredLlm, promptOrOptions = {}, options = {}) => {
  let fn;
  let config;

  if (typeof fnOrStructuredLlm === 'function') {
    fn = fnOrStructuredLlm;
    config = typeof promptOrOptions === 'number' ? { maxRetries: promptOrOptions } : promptOrOptions;
  } else {
    fn = () => fnOrStructuredLlm.invoke(promptOrOptions);
    config = typeof options === 'number' ? { maxRetries: options } : options;
  }

  const maxRetries = config.maxRetries ?? 5;
  const sleepFn = config.sleepFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const onRetry = config.onRetry ?? null;

  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fn();
      return res;
    } catch (err) {
      lastError = err;
      const errorType = classifyError(err);

      // Non-retryable client error (400 Bad Request, 401 Unauthorized, json_validate_failed, etc.)
      if (errorType === 'NON_RETRYABLE_CLIENT_ERROR') {
        const sanitizedDetails = sanitizeErrorMessage(err?.message);
        console.error(`[Non-Retryable Error ${err.status || 400}]: ${sanitizedDetails}`);
        const cleanErr = new Error(`LLM call failed with non-retryable status ${err.status || 400}: ${sanitizedDetails}`);
        cleanErr.status = err.status || 400;
        throw cleanErr;
      }

      // If max attempts reached, stop retrying
      if (attempt >= maxRetries) {
        break;
      }

      // Rate limit (429) handling
      if (errorType === 'RATE_LIMIT') {
        const parsedDelayMs = parseRetryDelay(err);

        // Abort if delay exceeds reasonable interactive threshold (30s)
        if (parsedDelayMs !== null && parsedDelayMs > 30000) {
          console.warn(`[Rate Limit 429] Delay of ${(parsedDelayMs / 1000).toFixed(1)}s exceeds allowable interactive wait (30s).`);
          const exhaustedErr = new Error(`LLM rate limit replenishment window of ${(parsedDelayMs / 1000).toFixed(1)}s exceeds allowable wait threshold.`);
          exhaustedErr.status = 429;
          exhaustedErr.isRateLimit = true;
          exhaustedErr.retryAfterMs = parsedDelayMs;
          exhaustedErr.originalDetails = sanitizeErrorMessage(err?.message);
          throw exhaustedErr;
        }

        const jitter = Math.floor(Math.random() * 250) + 250; // 250ms - 500ms safety buffer
        const waitMs = parsedDelayMs !== null
          ? Math.ceil(parsedDelayMs) + jitter
          : (attempt * 1500) + jitter;

        console.log(`[Rate Limit 429] Detected rate limit. Waiting ${(waitMs / 1000).toFixed(2)}s before retry (attempt ${attempt}/${maxRetries})...`);
        if (typeof onRetry === 'function') {
          onRetry({ attempt, maxRetries, errorType, waitMs, err });
        }
        await sleepFn(waitMs);
        continue;
      }

      // Transient 5xx / network error handling
      if (
        errorType === 'TRANSIENT_SERVER_ERROR' ||
        errorType === 'TRANSIENT_NETWORK_ERROR'
      ) {
        const waitMs = 1500 + Math.floor(Math.random() * 500);
        console.log(`[${errorType}] Retrying LLM call in ${(waitMs / 1000).toFixed(2)}s (attempt ${attempt}/${maxRetries})...`);
        if (typeof onRetry === 'function') {
          onRetry({ attempt, maxRetries, errorType, waitMs, err });
        }
        await sleepFn(waitMs);
        continue;
      }

      // Unhandled/unknown errors: do not loop blindly
      const sanitizedDetails = sanitizeErrorMessage(err?.message);
      console.error(`[Unhandled Error]: ${sanitizedDetails}`);
      const cleanErr = new Error(`LLM invocation failed: ${sanitizedDetails}`);
      throw cleanErr;
    }
  }

  // Exhausted all retries
  const sanitizedLastMsg = sanitizeErrorMessage(lastError?.message);
  const isRateLimitExhausted = classifyError(lastError) === 'RATE_LIMIT';

  console.error(`[LLM Retries Exhausted] Failed after ${maxRetries} attempts. Last error: ${sanitizedLastMsg}`);

  const exhaustedError = new Error(
    isRateLimitExhausted
      ? `LLM rate limit budget exceeded after ${maxRetries} retry attempts. Please wait a moment before trying again.`
      : `LLM service request failed after ${maxRetries} attempts: ${sanitizedLastMsg}`
  );
  exhaustedError.status = isRateLimitExhausted ? 429 : (lastError?.status || 500);
  exhaustedError.isRateLimit = isRateLimitExhausted;
  exhaustedError.originalDetails = sanitizedLastMsg;
  throw exhaustedError;
};

/**
 * Service to extract structured candidate profile from raw resume text.
 */
export const extractResumeProfile = async (resumeText, options = {}) => {
  const model = createGroqChatModel(0.1, TOKEN_BUDGETS.RESUME_PROFILE);
  const structuredLlm = model.withStructuredOutput(resumeSchema);

  const prompt = `You are an expert technical resume parser and talent analyst.
Extract a concise, structured candidate profile from the provided resume text into the specified schema.
You MUST respond with a valid JSON object adhering strictly to the required schema. Do NOT include markdown formatting or extra conversational text outside the JSON object.

EXTRACTION RULES & BEST PRACTICES:
1. Extract ONLY information explicitly supported by the supplied resume text. Do NOT invent or infer missing experience, education, projects, or skills.
2. ULTRA-COMPACT SUMMARIES: Keep extracted experience, project, and education entries as short 1-line summary strings (maximum 10 words per entry) focusing on title, key technology, and role. Do NOT copy multi-paragraph text or full bullet point lists.
3. CORE SKILLS: Extract explicit technical skills (programming languages, frameworks, libraries, databases, cloud/DevOps tools, and core engineering concepts). Limit to maximum 20 core skills.
4. ABSENT SECTIONS: If a section (e.g. experience, projects, or education) is absent or not mentioned in the resume, return an empty array [] for that field.
5. Do NOT perform job matching, scoring, or candidate evaluation.

FIELD INSTRUCTIONS:
- skills: Array of explicit technical skills and concepts mentioned in the resume (max 20).
- experience: Array of concise summary items (1 short line per role, max 10 words each). Return [] if none exist.
- projects: Array of concise summary items (1 short line per project, max 10 words each). Return [] if none exist.
- education: Array of concise summary items (1 short line per degree/credential, max 10 words each). Return [] if none exist.

CANDIDATE RESUME TEXT:
---
${resumeText}
---`;

  try {
    const rawResult = await invokeWithRetry(structuredLlm, prompt, options);
    const validatedResult = resumeSchema.parse(rawResult || {});

    return {
      skills: deduplicateAndNormalizeSkills(validatedResult.skills || []),
      experience: deduplicateAndNormalizeSkills(validatedResult.experience || []),
      projects: deduplicateAndNormalizeSkills(validatedResult.projects || []),
      education: deduplicateAndNormalizeSkills(validatedResult.education || [])
    };
  } catch (error) {
    const rawMsg = error?.message || 'Unknown resume extraction error';
    const sanitizedMsg = sanitizeErrorMessage(rawMsg);
    console.error('AI Service Error (Resume Extraction):', sanitizedMsg);
    const wrappedErr = new Error(`Resume profile extraction failed: ${sanitizedMsg}`);
    wrappedErr.status = error?.status || 500;
    wrappedErr.isRateLimit = error?.isRateLimit || error?.status === 429;
    throw wrappedErr;
  }
};

/**
 * Normalizes and deduplicates an array of skill or requirement strings.
 * - Trims whitespace and strips leading bullet/numbering markers (e.g., '-', '*', '•', '1.').
 * - Filters out empty or non-string values.
 * - Performs exact case-insensitive deduplication while preserving the canonical casing.
 * - Preserves distinct variants (e.g. 'JavaScript', 'JavaScript/TypeScript', 'TypeScript/JavaScript')
 *   without performing aggressive substring collapses that discard valid requirements.
 */
export const deduplicateAndNormalizeSkills = (skills = []) => {
  if (!Array.isArray(skills)) return [];

  const seen = new Set();
  const normalized = [];

  for (const item of skills) {
    if (typeof item !== 'string') continue;

    // Strip leading bullet markers, numbering, and excess whitespace
    const cleaned = item
      .replace(/^[\s\-*•\d.)]+/, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned) continue;

    // Use lowercase trimmed key for exact deduplication check
    const dedupKey = cleaned.toLowerCase();

    if (!seen.has(dedupKey)) {
      seen.add(dedupKey);
      normalized.push(cleaned);
    }
  }

  return normalized;
};

/**
 * Service to extract structured requirements from a raw Job Description.
 */
export const extractJobRequirements = async (jobDescription, options = {}) => {
  const model = createGroqChatModel(0.1, TOKEN_BUDGETS.JOB_REQUIREMENTS);
  const structuredLlm = model.withStructuredOutput(jobRequirementSchema);

  const prompt = `You are an expert technical recruiter analyzing a Job Description (JD).
Extract the structured requirements from the provided Job Description into the specified schema.
You MUST respond with a valid JSON object adhering strictly to the required schema. Do NOT include markdown formatting or extra conversational text outside the JSON object.

CRITICAL COMPREHENSIVE EXTRACTION RULES:
1. Base your extraction ONLY on the supplied Job Description. Do NOT invent technologies, responsibilities, or qualifications not mentioned in the text.
2. EXHAUSTIVE EXTRACTION: You MUST extract ALL meaningful technical requirements mentioned across the entire JD.
   - Do NOT stop after extracting only the first skill or a single sample skill.
   - Extract every discrete programming language, framework, library, database, protocol, API technology, testing tool, architectural concept, and engineering practice.
3. COMPOSITE & LISTED SKILLS: When requirements contain multiple technologies or tools in a single bullet point, sentence, or comma-separated list (e.g. "PostgreSQL / relational databases, SQL, database design, indexing, transactions" or "message queues such as RabbitMQ/Kafka/AWS SQS"), extract EACH distinct technology or competency as a separate item in the array.
4. STRICT SECTION & PHRASING CLASSIFICATION:
   - "requiredSkills": Extract from sections such as "Requirements", "Required Skills", "Qualifications", "Basic Qualifications", "Minimum Qualifications", "What You Bring", "Must Haves", as well as essential technical skills stated in the overview.
   - "preferredSkills": Extract from sections such as "Preferred Skills", "Preferred Qualifications", "Nice to have", "Bonus Points", "Desired Skills", "Pluses". If no preferred qualifications are mentioned in the JD, return an empty array [].
   - "responsibilities": Extract core duties and responsibilities mentioned in sections such as "Responsibilities", "What you'll do", "The Role", or overview duties.
5. CONCISE & FIDELITY: Keep extracted skill names concise, clean, and faithful to the text (e.g., "JavaScript / TypeScript", "Node.js", "PostgreSQL", "Docker", "Kubernetes", "AWS"). Preserve conceptual requirements when stated (e.g., "asynchronous programming", "database design", "indexing", "unit testing").
6. Do NOT perform candidate matching or evaluation.
7. Do NOT invent generic filler phrases.

FIELD INSTRUCTIONS:
- jobTitle: Extract the explicit role title from the JD.
- requiredSkills: Comprehensive array of ALL required technical competencies, languages, frameworks, databases, tools, testing methodologies, and architectural concepts.
- preferredSkills: Array of ALL preferred, bonus, or nice-to-have technical skills. Return [] if none exist.
- responsibilities: Array of concise duty and responsibility statements directly supported by the JD.

JOB DESCRIPTION:
---
${jobDescription}
---`;

  try {
    const rawResult = await invokeWithRetry(structuredLlm, prompt, options);
    const validatedResult = jobRequirementSchema.parse(rawResult);

    return {
      jobTitle: (validatedResult.jobTitle || 'Role Description').trim(),
      requiredSkills: deduplicateAndNormalizeSkills(validatedResult.requiredSkills),
      preferredSkills: deduplicateAndNormalizeSkills(validatedResult.preferredSkills),
      responsibilities: deduplicateAndNormalizeSkills(validatedResult.responsibilities)
    };
  } catch (error) {
    const rawMsg = error?.message || 'Unknown JD requirement extraction error';
    const sanitizedMsg = sanitizeErrorMessage(rawMsg);
    console.error('AI Service Error (JD Extraction):', sanitizedMsg);
    const wrappedErr = new Error(`JD requirement extraction failed: ${sanitizedMsg}`);
    wrappedErr.status = error?.status || 500;
    wrappedErr.isRateLimit = error?.isRateLimit || error?.status === 429;
    throw wrappedErr;
  }
};

/**
 * Service to perform semantic requirement comparison between JD requirements and candidate resume.
 */
export const compareResumeToRequirements = async (resumeProfile, requirements, resumeText = '', options = {}) => {
  const model = createGroqChatModel(0.1, TOKEN_BUDGETS.REQUIREMENT_COMPARISON);
  const structuredLlm = model.withStructuredOutput(skillMatchSchema);

  const prompt = `You are comparing a candidate's resume evidence against a Job Description.
For each important requirement from the Job Description (including required skills, preferred skills, and core responsibilities), determine how strongly the candidate resume supports it.

CLASSIFICATION DEFINITIONS:
- "direct":
  The resume explicitly demonstrates the identical skill, technology, or conceptual requirement.
  Example: JD asks for "Node.js" and resume has "Node.js".
  Example: JD asks for "Relational database systems" and resume has "MySQL" (MySQL directly demonstrates relational database systems).
  Example: JD asks for "React" and resume has "React.js".

- "related":
  The resume demonstrates a different but meaningfully related technology or skill that provides relevant transferable knowledge.
  Example: JD asks for "PostgreSQL" and resume has "MySQL" (both are SQL relational databases).
  ONLY use "related" when the relationship is technically meaningful. Do Not treat arbitrary technologies as related.

- "partial":
  The resume provides some evidence toward the requirement but does not demonstrate the complete or broad scope of the requirement.
  Example: JD asks for "AWS cloud architecture" and resume only demonstrates "AWS S3" file storage.
  Example: JD asks for "Docker & Kubernetes container orchestration" and resume only has "Docker".

- "missing":
  There is no meaningful or verifiable evidence in the resume for the requirement.
  Example: JD asks for "Kubernetes" and resume has no Kubernetes evidence.

CRITICAL ANTI-HALLUCINATION RULES:
1. Do NOT invent resume evidence under any circumstance.
2. Every item in resumeEvidence MUST be directly traceable to the supplied candidate profile.
3. If a requirement has no meaningful evidence, classify it as "missing" and set resumeEvidence to an empty array [].
4. Never claim that the candidate knows a technology if it is absent from the resume. For instance, if JD asks for "PostgreSQL" and candidate only knows "MySQL", the relationship may be "related", but resumeEvidence must state "MySQL", NEVER "PostgreSQL".
5. Do NOT calculate any numerical score.
6. Do NOT make a hire or apply decision.

---
STRUCTURED JD REQUIREMENTS:
- Role Title: ${requirements.jobTitle}
- Required Skills: ${requirements.requiredSkills.join(', ')}
- Preferred Skills: ${requirements.preferredSkills.join(', ') || 'None'}
- Responsibilities: ${requirements.responsibilities.join('; ') || 'None'}
---

---
STRUCTURED CANDIDATE PROFILE:
- Skills: ${resumeProfile.skills.join(', ')}
- Experience Highlights: ${resumeProfile.experience.join('; ')}
- Projects: ${resumeProfile.projects.join('; ')}
- Education: ${resumeProfile.education.join('; ')}
---`;

  try {
    const rawResult = await invokeWithRetry(structuredLlm, prompt, options);
    const validatedResult = skillMatchSchema.parse(rawResult);
    return validatedResult;
  } catch (error) {
    const rawMsg = error?.message || 'Unknown semantic requirement comparison error';
    const sanitizedMsg = sanitizeErrorMessage(rawMsg);
    console.error('AI Service Error (Requirement Comparison):', sanitizedMsg);
    const wrappedErr = new Error(`Semantic requirement comparison failed: ${sanitizedMsg}`);
    wrappedErr.status = error?.status || 500;
    wrappedErr.isRateLimit = error?.isRateLimit || error?.status === 429;
    throw wrappedErr;
  }
};

/**
 * Service responsible for LLM interaction using LangChain's ChatGroq with structured job-fit analysis.
 */
export const analyzeResumeJobFit = async (
  resumeText,
  jobDescription,
  structuredRequirements = null,
  structuredResume = null,
  structuredMatches = null,
  options = {}
) => {
  const model = createGroqChatModel(0.1, TOKEN_BUDGETS.JOB_FIT_ANALYSIS);
  const structuredLlm = model.withStructuredOutput(jobFitSchema);

  const matchesContext = structuredMatches?.requirementMatches
    ? `
SEMANTIC REQUIREMENT COMPARISONS:
${structuredMatches.requirementMatches
  .map(m => `- ${m.jdRequirement} [${m.relationship}]: ${m.resumeEvidence.length > 0 ? m.resumeEvidence.join(', ') : 'No evidence'}`)
  .join('\n')}
`
    : '';

  const prompt = `You are an expert technical recruiter and talent evaluator performing an objective candidate evaluation.
Analyze the candidate's resume against the target Job Description (JD) to evaluate their job fit.

CRITICAL ANTI-HALLUCINATION & EVALUATION RULES:
1. Base your analysis ONLY on the supplied resume text and job description.
2. Do NOT assume that the candidate knows a technology merely because it is common in their field, because they know a related technology, or because it appears indirectly without evidence.
3. If evidence is insufficient, treat it as insufficient rather than inventing experience or skills.

FIELD INSTRUCTIONS:
- matchedSkills:
  Include specific skills from the Job Description that are supported by explicit evidence in the resume.
  Do NOT claim a skill is matched merely because it is vaguely related.
- missingSkills:
  Include important JD requirements for which the resume does NOT provide sufficient evidence.
  Do NOT invent missing skills that are not relevant to the JD.
- relevantExperience:
  Include concise pieces of real experience, accomplishments, or projects from the resume that are directly relevant to the JD.
  Do NOT invent experience.
- preliminaryAssessment:
  Provide a concise overall qualitative assessment of the candidate's fit.
  Do NOT produce any numerical match scores.
  Do NOT make an unconditional hiring decision.
${matchesContext}
---
CANDIDATE RESUME:
${resumeText}
---

---
TARGET JOB DESCRIPTION:
${jobDescription}
---`;

  try {
    const rawResult = await invokeWithRetry(structuredLlm, prompt, options);
    const validatedResult = jobFitSchema.parse(rawResult);
    return validatedResult;
  } catch (error) {
    const rawMsg = error?.message || 'Unknown structured AI error';
    const sanitizedMsg = sanitizeErrorMessage(rawMsg);
    console.error('AI Service Error (Job-Fit Analysis):', sanitizedMsg);
    const wrappedErr = new Error(`AI structured analysis failed: ${sanitizedMsg}`);
    wrappedErr.status = error?.status || 500;
    wrappedErr.isRateLimit = error?.isRateLimit || error?.status === 429;
    throw wrappedErr;
  }
};
