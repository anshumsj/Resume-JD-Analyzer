import { Annotation } from '@langchain/langgraph';

/**
 * Shared state schema for the JobFit AI LangGraph workflow.
 *
 * Carries:
 * - resumeText: string
 * - jobDescription: string
 * - resumeProfile: object | null
 * - requirements: object | null
 * - skillMatches: object | null
 * - score: object | null
 * - recommendation: object | null
 * - learningResources: array
 */
export const JobFitAnnotation = Annotation.Root({
  resumeText: Annotation({
    reducer: (x, y) => (y !== undefined ? y : x ?? ''),
    default: () => ''
  }),
  jobDescription: Annotation({
    reducer: (x, y) => (y !== undefined ? y : x ?? ''),
    default: () => ''
  }),
  resumeProfile: Annotation({
    reducer: (x, y) => (y !== undefined ? y : x ?? null),
    default: () => null
  }),
  requirements: Annotation({
    reducer: (x, y) => (y !== undefined ? y : x ?? null),
    default: () => null
  }),
  skillMatches: Annotation({
    reducer: (x, y) => (y !== undefined ? y : x ?? null),
    default: () => null
  }),
  score: Annotation({
    reducer: (x, y) => (y !== undefined ? y : x ?? null),
    default: () => null
  }),
  recommendation: Annotation({
    reducer: (x, y) => (y !== undefined ? y : x ?? null),
    default: () => null
  }),
  learningResources: Annotation({
    reducer: (x, y) => (y !== undefined ? y : x ?? []),
    default: () => []
  })
});
