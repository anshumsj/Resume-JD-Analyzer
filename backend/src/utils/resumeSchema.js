import { z } from 'zod';

/**
 * Zod schema defining the structured candidate resume profile output.
 * Uses robust array defaults and summary descriptions to handle complete
 * or partial resumes cleanly without triggering JSON schema validation failures.
 */
export const resumeSchema = z.object({
  skills: z
    .array(z.string())
    .default([])
    .describe('Technical skills explicitly supported by the resume, including programming languages, frameworks, libraries, databases, cloud/platform tools, backend technologies, and engineering concepts. Return [] if none exist.'),
  experience: z
    .array(z.string())
    .default([])
    .describe('Concise summary items of professional, internship, or work experiences (1 line per role). Return [] if none exist.'),
  projects: z
    .array(z.string())
    .default([])
    .describe('Concise summary items of technically relevant projects (1 line per project). Return [] if none exist.'),
  education: z
    .array(z.string())
    .default([])
    .describe('Concise summary items of education credentials, degrees, fields of study, and institutions. Return [] if none exist.')
});
