/**
 * LangGraph Agent Orchestration for JobFit AI
 *
 * Coordinates the existing services:
 * 1. extract: extractResumeProfile + extractJobRequirements (concurrently)
 * 2. compare: compareResumeToRequirements
 * 3. score: calculateJobFitScore
 * 4. recommendation: generateCandidateRecommendation
 * 5. resource: enrichLearningRoadmap
 *
 * Strictly acts as the orchestration layer without embedding or mutating business logic.
 */

import { StateGraph, START, END } from '@langchain/langgraph';
import { JobFitAnnotation } from './jobFitState.js';
import {
  extractResumeProfile,
  extractJobRequirements,
  compareResumeToRequirements
} from '../services/aiService.js';
import { calculateJobFitScore } from '../services/scoringService.js';
import { generateCandidateRecommendation } from '../services/recommendationService.js';
import { enrichLearningRoadmap } from '../services/webSearchService.js';

export const NODE_NAMES = {
  EXTRACT: 'extract',
  COMPARE: 'compare',
  SCORE: 'scoring',
  RECOMMENDATION: 'recommend',
  RESOURCE: 'resource_enrichment'
};

/**
 * Node 1: Extract structured candidate profile and JD requirements concurrently.
 */
export const extractNode = async (state) => {
  const resumeText = state.resumeText || '';
  const jobDescription = state.jobDescription || '';

  const [resumeProfile, requirements] = await Promise.all([
    extractResumeProfile(resumeText),
    extractJobRequirements(jobDescription)
  ]);

  return {
    resumeProfile,
    requirements
  };
};

/**
 * Node 2: Perform semantic comparison between resume profile and JD requirements.
 */
export const compareNode = async (state) => {
  const resumeProfile = state.resumeProfile || {};
  const requirements = state.requirements || {};
  const resumeText = state.resumeText || '';

  const skillMatches = await compareResumeToRequirements(
    resumeProfile,
    requirements,
    resumeText
  );

  return {
    skillMatches
  };
};

/**
 * Node 3: Compute deterministic job-fit score and auditable breakdown.
 */
export const scoreNode = async (state) => {
  const requirements = state.requirements || {};
  const skillMatches = state.skillMatches || {};

  const score = calculateJobFitScore(requirements, skillMatches);

  return {
    score
  };
};

/**
 * Node 4: Generate candidate recommendation, strengths, gaps, and learning priorities.
 */
export const recommendationNode = async (state) => {
  const requirements = state.requirements || {};
  const skillMatches = state.skillMatches || {};
  const score = state.score || {};

  const recommendation = generateCandidateRecommendation({
    requirements,
    skillMatches,
    score
  });

  return {
    recommendation
  };
};

/**
 * Node 5: Enrich identified learning roadmap gaps with authoritative external resources.
 */
export const resourceNode = async (state) => {
  const roadmap = state.recommendation?.learningRoadmap || [];
  let learningResources = [];

  try {
    learningResources = await enrichLearningRoadmap(roadmap);
  } catch (err) {
    // Graceful degradation: search failure does not fail the orchestration pipeline
    learningResources = [];
  }

  return {
    learningResources
  };
};

/**
 * Compiles and returns the executable LangGraph state workflow.
 */
export const buildJobFitGraph = () => {
  const workflow = new StateGraph(JobFitAnnotation)
    .addNode(NODE_NAMES.EXTRACT, extractNode)
    .addNode(NODE_NAMES.COMPARE, compareNode)
    .addNode(NODE_NAMES.SCORE, scoreNode)
    .addNode(NODE_NAMES.RECOMMENDATION, recommendationNode)
    .addNode(NODE_NAMES.RESOURCE, resourceNode)
    .addEdge(START, NODE_NAMES.EXTRACT)
    .addEdge(NODE_NAMES.EXTRACT, NODE_NAMES.COMPARE)
    .addEdge(NODE_NAMES.COMPARE, NODE_NAMES.SCORE)
    .addEdge(NODE_NAMES.SCORE, NODE_NAMES.RECOMMENDATION)
    .addEdge(NODE_NAMES.RECOMMENDATION, NODE_NAMES.RESOURCE)
    .addEdge(NODE_NAMES.RESOURCE, END);

  return workflow.compile();
};

export const jobFitGraph = buildJobFitGraph();

/**
 * Helper function to invoke the compiled graph with resume text and job description.
 */
export const runJobFitGraph = async ({ resumeText, jobDescription }) => {
  return await jobFitGraph.invoke({ resumeText, jobDescription });
};
