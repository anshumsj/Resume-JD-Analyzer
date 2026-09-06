import { z } from 'zod';

/**
 * Zod schema defining the structured Job-Fit analysis output.
 * Uses robust array defaults and summary descriptions to handle qualitative evaluation cleanly.
 */
export const jobFitSchema = z.object({
  matchedSkills: z
    .array(z.string())
    .default([])
    .describe('Skills from the Job Description that are directly supported by explicit evidence in the resume. Return [] if none exist.'),
  missingSkills: z
    .array(z.string())
    .default([])
    .describe('Important Job Description requirements for which the resume lacks sufficient evidence. Return [] if none exist.'),
  relevantExperience: z
    .array(z.string())
    .default([])
    .describe('Concise pieces of actual experience, projects, or accomplishments from the resume directly relevant to the JD. Return [] if none exist.'),
  preliminaryAssessment: z
    .string()
    .default('')
    .describe('A concise, qualitative summary evaluating the candidate fit without producing any numerical scores or unconditional hiring decisions.')
});
