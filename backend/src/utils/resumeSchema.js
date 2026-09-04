import { z } from 'zod';

/**
 * Zod schema defining the structured candidate resume profile output.
 */
export const resumeSchema = z.object({
  skills: z
    .array(z.string().min(1))
    .describe('Technical skills explicitly supported by the resume, including programming languages, frameworks, libraries, databases, cloud/platform technologies, backend technologies, and engineering concepts.'),
  experience: z
    .array(z.string().min(1))
    .describe('Concise, evidence-based descriptions of professional, internship, or work experiences with technologies and accomplishments directly supported by the resume.'),
  projects: z
    .array(z.string().min(1))
    .describe('Concise descriptions of technically relevant projects from the resume, including project names, technologies used, and core accomplishments.'),
  education: z
    .array(z.string().min(1))
    .describe('Education credentials, degrees, fields of study, and institutions explicitly mentioned in the resume.')
});
