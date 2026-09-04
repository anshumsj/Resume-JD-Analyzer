import { z } from 'zod';

/**
 * Zod schema defining the structured Job Description requirement extraction output.
 */
export const jobRequirementSchema = z.object({
  jobTitle: z
    .string()
    .min(1)
    .describe('The explicit job title from the JD, or a concise role description supported by the JD if no explicit title is stated.'),
  requiredSkills: z
    .array(z.string().min(1))
    .describe('Technical skills, technologies, frameworks, tools, platforms, or conceptual capabilities explicitly presented as required or essential in the JD.'),
  preferredSkills: z
    .array(z.string().min(1))
    .describe('Skills, technologies, or qualifications explicitly presented as preferred, nice-to-have, bonus, or advantageous in the JD.'),
  responsibilities: z
    .array(z.string().min(1))
    .describe('Concise descriptions of key responsibilities and duties directly mentioned in the JD.')
});
