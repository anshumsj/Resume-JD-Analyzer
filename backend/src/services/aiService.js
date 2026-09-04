import { ChatGroq } from '@langchain/groq';
import { jobFitSchema } from '../utils/jobFitSchema.js';
import { jobRequirementSchema } from '../utils/jobRequirementSchema.js';
import { resumeSchema } from '../utils/resumeSchema.js';

/**
 * Helper to initialize ChatGroq model instance.
 */
const createGroqChatModel = (temperature = 0.1) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured in the environment');
  }

  const modelName = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

  return new ChatGroq({
    model: modelName,
    apiKey,
    temperature
  });
};

/**
 * Service to extract structured candidate profile from raw resume text.
 */
export const extractResumeProfile = async (resumeText) => {
  const model = createGroqChatModel(0.1);
  const structuredLlm = model.withStructuredOutput(resumeSchema);

  const prompt = `You are an expert technical resume parser and talent analyst.
Extract a structured candidate profile from the provided resume text into the specified schema.

STRICT ANTI-HALLUCINATION & EXTRACTION RULES:
1. Use ONLY information explicitly contained in the supplied resume text.
2. Never infer a skill merely because another skill usually implies it.
3. Never assume experience with a technology or tool that is not explicitly mentioned.
4. Do NOT convert a project into technologies or tools that the resume does not mention.
5. Preserve the distinction between explicit evidence and inference.
6. Do NOT invent employment, education, projects, certifications, or skills.
7. Keep all extracted items concise, accurate, and faithful to the resume text.
8. Do NOT perform Job Description matching in this stage.
9. Do NOT calculate any score or make any evaluation.

FIELD INSTRUCTIONS:
- skills: Extract technical skills explicitly supported by the resume (languages, frameworks, libraries, databases, cloud/platform tools, backend technologies, and engineering concepts). Do NOT invent skills based on project names alone.
- experience: Extract concise, evidence-based descriptions of professional, work, or internship experience relevant to technical roles. Preserve meaningful technologies and accomplishments without copying entire paragraphs.
- projects: Extract concise descriptions of technically relevant projects, including project names, technologies used, and core accomplishments.
- education: Extract education information explicitly present in the resume (degrees, majors, institutions, and dates). Do not invent status or qualifications.

CANDIDATE RESUME TEXT:
---
${resumeText}
---`;

  try {
    const rawResult = await structuredLlm.invoke(prompt);
    const validatedResult = resumeSchema.parse(rawResult);
    return validatedResult;
  } catch (error) {
    const rawMsg = error?.message || 'Unknown resume extraction error';
    const sanitizedMsg = rawMsg.replace(/gsk_[a-zA-Z0-9_-]+/g, '[REDACTED_API_KEY]');
    console.error('AI Service Error (Resume Extraction):', sanitizedMsg);
    throw new Error(`Resume profile extraction failed: ${sanitizedMsg}`);
  }
};

/**
 * Service to extract structured requirements from a raw Job Description.
 */
export const extractJobRequirements = async (jobDescription) => {
  const model = createGroqChatModel(0.1);
  const structuredLlm = model.withStructuredOutput(jobRequirementSchema);

  const prompt = `You are an expert technical recruiter analyzing a Job Description (JD).
Extract the structured requirements from the provided Job Description into the specified schema.

EXTRACTION GUIDELINES:
1. Base your extraction ONLY on the supplied Job Description.
2. Do NOT invent technologies, responsibilities, or qualifications not mentioned in the text.
3. Preserve conceptual requirements exactly when the JD uses concepts rather than specific technologies (e.g. if the JD specifies "knowledge of relational database systems", extract "relational database systems" rather than converting it to PostgreSQL or MySQL).
4. Strictly distinguish required/essential skills from preferred/nice-to-have skills based on JD phrasing.
5. Keep skill names concise and normalized enough for later retrieval, while faithfully preserving the meaning in the JD.
6. Do NOT include generic filler words unless they represent clearly meaningful job competencies.
7. Do NOT perform candidate or resume matching.
8. Do NOT calculate any score or make any evaluation.

JOB DESCRIPTION:
---
${jobDescription}
---`;

  try {
    const rawResult = await structuredLlm.invoke(prompt);
    const validatedResult = jobRequirementSchema.parse(rawResult);
    return validatedResult;
  } catch (error) {
    const rawMsg = error?.message || 'Unknown JD requirement extraction error';
    const sanitizedMsg = rawMsg.replace(/gsk_[a-zA-Z0-9_-]+/g, '[REDACTED_API_KEY]');
    console.error('AI Service Error (JD Extraction):', sanitizedMsg);
    throw new Error(`JD requirement extraction failed: ${sanitizedMsg}`);
  }
};

/**
 * Service responsible for LLM interaction using LangChain's ChatGroq with structured job-fit analysis.
 */
export const analyzeResumeJobFit = async (
  resumeText,
  jobDescription,
  structuredRequirements = null,
  structuredResume = null
) => {
  const model = createGroqChatModel(0.1);
  const structuredLlm = model.withStructuredOutput(jobFitSchema);

  const requirementsContext = structuredRequirements
    ? `
STRUCTURED JD CONTEXT:
- Role Title: ${structuredRequirements.jobTitle}
- Required Skills: ${structuredRequirements.requiredSkills.join(', ')}
- Preferred Skills: ${structuredRequirements.preferredSkills.join(', ') || 'None specified'}
- Key Responsibilities: ${structuredRequirements.responsibilities.join('; ') || 'None specified'}
`
    : '';

  const resumeContext = structuredResume
    ? `
STRUCTURED CANDIDATE PROFILE:
- Explicit Skills: ${structuredResume.skills.join(', ')}
- Work Experience: ${structuredResume.experience.join('; ') || 'None listed'}
- Key Projects: ${structuredResume.projects.join('; ') || 'None listed'}
- Education: ${structuredResume.education.join('; ') || 'None listed'}
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
${requirementsContext}
${resumeContext}
---
CANDIDATE RESUME:
${resumeText}
---

---
TARGET JOB DESCRIPTION:
${jobDescription}
---`;

  try {
    const rawResult = await structuredLlm.invoke(prompt);
    const validatedResult = jobFitSchema.parse(rawResult);
    return validatedResult;
  } catch (error) {
    const rawMsg = error?.message || 'Unknown structured AI error';
    const sanitizedMsg = rawMsg.replace(/gsk_[a-zA-Z0-9_-]+/g, '[REDACTED_API_KEY]');
    console.error('AI Service Error (Job-Fit Analysis):', sanitizedMsg);
    throw new Error(`AI structured analysis failed: ${sanitizedMsg}`);
  }
};
