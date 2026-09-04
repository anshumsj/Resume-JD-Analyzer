import { ChatGroq } from '@langchain/groq';
import { jobFitSchema } from '../utils/jobFitSchema.js';

/**
 * Service responsible for LLM interaction using LangChain's ChatGroq with structured output.
 */
export const analyzeResumeJobFit = async (resumeText, jobDescription) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured in the environment');
  }

  const modelName = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

  const model = new ChatGroq({
    model: modelName,
    apiKey: apiKey,
    temperature: 0.1
  });

  // Configure model to produce validated structured output conforming to jobFitSchema
  const structuredLlm = model.withStructuredOutput(jobFitSchema);

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
    // Validate output through the Zod schema
    const validatedResult = jobFitSchema.parse(rawResult);
    return validatedResult;
  } catch (error) {
    // Sanitize error to prevent leaking credentials or internal details
    const rawMsg = error?.message || 'Unknown structured AI error';
    const sanitizedMsg = rawMsg.replace(/gsk_[a-zA-Z0-9_-]+/g, '[REDACTED_API_KEY]');
    console.error('AI Service Error:', sanitizedMsg);
    throw new Error(`AI structured analysis failed: ${sanitizedMsg}`);
  }
};
