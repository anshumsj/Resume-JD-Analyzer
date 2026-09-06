import { z } from 'zod';

/**
 * Zod schema defining the structured Job Description requirement extraction output.
 * Uses robust array defaults and clear field instructions to handle any JD structure cleanly.
 */
export const jobRequirementSchema = z.object({
  jobTitle: z
    .string()
    .default('Role Description')
    .describe('The explicit job title from the JD, or a concise role description supported by the JD if no explicit title is stated.'),
  requiredSkills: z
    .array(z.string())
    .default([])
    .describe('Comprehensive and exhaustive list of ALL technical skills, programming languages, frameworks, libraries, databases, APIs, protocols, architectures, tools, testing methodologies, and core engineering competencies explicitly presented as required, essential, or minimum qualifications in the JD. Extract every distinct requirement without omitting any.'),
  preferredSkills: z
    .array(z.string())
    .default([])
    .describe('Comprehensive list of ALL skills, technologies, cloud tools, platforms, or qualifications explicitly presented as preferred, nice-to-have, bonus, plus, or advantageous in the JD. Return empty array [] if none are specified.'),
  responsibilities: z
    .array(z.string())
    .default([])
    .describe('Concise descriptions of all key duties, responsibilities, and tasks directly mentioned in the JD. Return empty array [] if none exist.')
});
