import { z } from 'zod';

/**
 * Single requirement comparison item schema.
 */
export const requirementMatchItemSchema = z.object({
  jdRequirement: z
    .string()
    .min(1)
    .describe('The explicit skill, technology, capability, or responsibility requirement from the Job Description being evaluated.'),
  resumeEvidence: z
    .array(z.string().min(1))
    .describe('Concrete, truthful skills, projects, or experiences from the candidate resume that relate to this requirement. Empty array if relationship is missing.'),
  relationship: z
    .enum(['direct', 'related', 'partial', 'missing'])
    .describe('Semantic relationship category: "direct" (explicit evidence of identical skill or conceptual equivalent), "related" (different technology with meaningful transferable knowledge), "partial" (incomplete or narrow evidence for a broader requirement), or "missing" (no meaningful evidence in resume).')
});

/**
 * Zod schema defining the structured semantic requirement comparison output.
 */
export const skillMatchSchema = z.object({
  requirementMatches: z
    .array(requirementMatchItemSchema)
    .min(1)
    .describe('Requirement-by-requirement semantic comparison between the Job Description requirements and candidate resume evidence.')
});
