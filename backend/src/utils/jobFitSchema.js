import { z } from 'zod';

/**
 * Zod schema defining the structured Job-Fit analysis output.
 */
export const jobFitSchema = z.object({
  matchedSkills: z
    .array(z.string().min(1))
    .describe('Skills from the Job Description that are directly supported by explicit evidence in the resume.'),
  missingSkills: z
    .array(z.string().min(1))
    .describe('Important Job Description requirements for which the resume lacks sufficient evidence.'),
  relevantExperience: z
    .array(z.string().min(1))
    .describe('Concise pieces of actual experience, projects, or accomplishments from the resume directly relevant to the JD.'),
  preliminaryAssessment: z
    .string()
    .min(1)
    .describe('A concise, qualitative summary evaluating the candidate fit without producing any numerical scores or unconditional hiring decisions.')
});
