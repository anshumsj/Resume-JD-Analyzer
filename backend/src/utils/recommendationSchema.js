import { z } from 'zod';

export const PriorityGapSchema = z.object({
  skill: z.string(),
  category: z.enum(['required', 'preferred']),
  relationship: z.enum(['direct', 'related', 'partial', 'missing']),
  resumeEvidence: z.array(z.string())
});

export const LearningRoadmapItemSchema = z.object({
  skill: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  category: z.enum(['required', 'preferred']),
  reason: z.string()
});

export const RecommendationSchema = z.object({
  decision: z.enum(['apply', 'apply_with_gaps', 'low_fit']),
  reason: z.string(),
  strengths: z.array(z.string()),
  priorityGaps: z.array(PriorityGapSchema),
  learningRoadmap: z.array(LearningRoadmapItemSchema)
});
