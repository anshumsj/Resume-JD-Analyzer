import { ChatGroq } from '@langchain/groq';

/**
 * Service responsible for LLM interaction using LangChain's ChatGroq.
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
    temperature: 0.2
  });

  const prompt = `You are an expert technical recruiter and hiring evaluator.
Analyze the candidate's resume against the target Job Description (JD) to evaluate their job fit.

Candidate Resume:
---
${resumeText}
---

Target Job Description:
---
${jobDescription}
---

Provide a clear and concise preliminary evaluation structured under the following sections:

1. Relevant Skills & Experience
Identify the candidate's strongest matching skills, technical competencies, and relevant project or work experiences that align directly with the JD requirements.

2. Skill & Experience Gaps
Identify obvious missing qualifications, tools, domain knowledge, or experience gaps called for in the JD that are not evident in the resume.

3. Preliminary Assessment
Provide a concise, balanced summary evaluation of the candidate's overall fit for this role.

Note: Provide a qualitative, concise textual assessment. Do not calculate or output a numerical match score.`;

  try {
    const response = await model.invoke(prompt);
    const analysisText = typeof response.content === 'string'
      ? response.content
      : Array.isArray(response.content)
        ? response.content.map(c => (typeof c === 'string' ? c : c.text || '')).join('\n')
        : String(response.content);

    return analysisText;
  } catch (error) {
    // Sanitize any error to prevent leaking sensitive credentials in logs or responses
    const rawMsg = error?.message || 'Unknown LLM error';
    const sanitizedMsg = rawMsg.replace(/gsk_[a-zA-Z0-9_-]+/g, '[REDACTED_API_KEY]');
    console.error('AI Service Error:', sanitizedMsg);
    throw new Error(`AI analysis failed: ${sanitizedMsg}`);
  }
};
