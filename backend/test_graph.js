import fs from 'fs';
import dotenv from 'dotenv';
import { END, START, StateGraph } from '@langchain/langgraph';

// Load environment variables
dotenv.config();
dotenv.config({ path: '../.env' });

import { extractTextFromPdf } from './src/services/resumeService.js';
import {
  jobFitGraph,
  runJobFitGraph,
  NODE_NAMES,
  buildJobFitGraph,
  shouldEnrichResources,
  scoreNode,
  recommendationNode,
  resourceNode
} from './src/graph/jobFitGraph.js';
import { JobFitAnnotation } from './src/graph/jobFitState.js';

async function runGraphTests() {
  console.log('=== MILESTONE 11-B: CONDITIONAL LANGGRAPH ROUTING TESTS ===\n');

  // TEST 1 — Roadmap Exists
  console.log('--- TEST 1: Roadmap Exists ---');
  const stateWithGaps = {
    recommendation: {
      learningRoadmap: [
        {
          skill: 'PostgreSQL',
          priority: 'medium',
          category: 'required',
          reason: 'PostgreSQL is required by the job description.'
        }
      ]
    }
  };
  const route1 = shouldEnrichResources(stateWithGaps);
  console.log(`Route for roadmap with 1 item: "${route1}" (expected "${NODE_NAMES.RESOURCE}")`);
  if (route1 !== NODE_NAMES.RESOURCE) {
    throw new Error(`Test 1 failed: expected ${NODE_NAMES.RESOURCE}, got ${route1}`);
  }
  console.log('TEST 1 PASSED');

  // TEST 2 — Empty Roadmap
  console.log('\n--- TEST 2: Empty Roadmap ---');
  const stateEmptyRoadmap = {
    recommendation: {
      learningRoadmap: []
    }
  };
  const route2 = shouldEnrichResources(stateEmptyRoadmap);
  console.log(`Route for empty roadmap: "${route2}" (expected "${END}")`);
  if (route2 !== END) {
    throw new Error(`Test 2 failed: expected ${END}, got ${route2}`);
  }
  console.log('TEST 2 PASSED');

  // TEST 3 — Missing Recommendation
  console.log('\n--- TEST 3: Missing / Null Recommendation ---');
  const stateNoRec1 = { recommendation: null };
  const stateNoRec2 = {};
  const route3a = shouldEnrichResources(stateNoRec1);
  const route3b = shouldEnrichResources(stateNoRec2);
  console.log(`Route for null recommendation: "${route3a}", empty state: "${route3b}" (expected "${END}")`);
  if (route3a !== END || route3b !== END) {
    throw new Error(`Test 3 failed: expected ${END}, got ${route3a}, ${route3b}`);
  }
  console.log('TEST 3 PASSED');

  // TEST 4 — Multiple Roadmap Items
  console.log('\n--- TEST 4: Multiple Roadmap Items ---');
  const stateMultiGaps = {
    recommendation: {
      learningRoadmap: [
        { skill: 'PostgreSQL', priority: 'medium', category: 'required' },
        { skill: 'Kubernetes', priority: 'medium', category: 'preferred' },
        { skill: 'AWS', priority: 'low', category: 'preferred' }
      ]
    }
  };
  const route4 = shouldEnrichResources(stateMultiGaps);
  console.log(`Route for 3 roadmap items: "${route4}" (expected "${NODE_NAMES.RESOURCE}")`);
  if (route4 !== NODE_NAMES.RESOURCE) {
    throw new Error(`Test 4 failed: expected ${NODE_NAMES.RESOURCE}, got ${route4}`);
  }
  console.log('TEST 4 PASSED');

  // TEST 5 — Determinism
  console.log('\n--- TEST 5: Determinism ---');
  for (let i = 0; i < 10; i++) {
    const rGaps = shouldEnrichResources(stateWithGaps);
    const rEmpty = shouldEnrichResources(stateEmptyRoadmap);
    if (rGaps !== NODE_NAMES.RESOURCE || rEmpty !== END) {
      throw new Error(`Test 5 failed: non-deterministic routing detected at iteration ${i}`);
    }
  }
  console.log('TEST 5 PASSED: 10/10 iterations produced identical routing results');

  // TEST 6 — Full Graph With Gaps (Real Resume + SDE JD)
  console.log('\n--- TEST 6: Full Graph Execution With Roadmap Gaps ---');
  const pdfBuffer = fs.readFileSync('Resume.pdf.pdf');
  const resumeText = await extractTextFromPdf(pdfBuffer);
  console.log(`Extracted resume text: ${resumeText.length} characters`);

  const sdeJobDescription = `Job Title: Backend Software Engineer

Requirements:
- Node.js
- Express.js
- PostgreSQL
- Redis
- Docker
- Strong understanding of relational database systems
- Experience building scalable REST APIs

Preferred:
- AWS cloud architecture
- Kubernetes
- Microservices architecture

Responsibilities:
- Design and maintain reliable backend APIs and microservices
- Implement queue-based asynchronous background workers
- Optimize database queries and schema designs
- Collaborate with cross-functional frontend teams`;

  console.log('Invoking runJobFitGraph with real candidate (has gaps in PostgreSQL/Kubernetes)...');
  const startTime = Date.now();
  const finalState = await runJobFitGraph({ resumeText, jobDescription: sdeJobDescription });
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`Graph completed in ${duration}s`);

  // Verify that candidate had roadmap gaps and resource enrichment executed
  console.log(`Roadmap items count: ${finalState.recommendation.learningRoadmap.length}`);
  console.log(`Enriched resources count: ${finalState.learningResources.length}`);
  if (finalState.recommendation.learningRoadmap.length === 0) {
    throw new Error('Test 6 failed: real candidate was expected to have roadmap gaps');
  }
  if (!Array.isArray(finalState.learningResources) || finalState.learningResources.length === 0) {
    throw new Error('Test 6 failed: resource enrichment should have executed for candidate with gaps');
  }
  console.log(`Candidate Fit Score: ${finalState.score.overall}/100, Decision: ${finalState.recommendation.decision}`);
  console.log('TEST 6 PASSED: Candidate with gaps conditionally routed to resource_enrichment and was enriched');

  // TEST 7 — Full Graph With No Gaps (Synthetic State)
  console.log('\n--- TEST 7: Full Graph With No Gaps (Conditional Routing Skips Tool) ---');
  let toolExecuted = false;

  // Build a test graph with a spy on the resource enrichment node
  const noGapGraph = new StateGraph(JobFitAnnotation)
    .addNode(NODE_NAMES.EXTRACT, async () => ({
      resumeProfile: { skills: ['Node.js', 'Express.js'] },
      requirements: { requiredSkills: ['Node.js', 'Express.js'], preferredSkills: [] }
    }))
    .addNode(NODE_NAMES.COMPARE, async () => ({
      skillMatches: {
        requirementMatches: [
          { jdRequirement: 'Node.js', relationship: 'direct', resumeEvidence: ['Node.js'] },
          { jdRequirement: 'Express.js', relationship: 'direct', resumeEvidence: ['Express.js'] }
        ]
      }
    }))
    .addNode(NODE_NAMES.SCORE, scoreNode)
    .addNode(NODE_NAMES.RECOMMENDATION, recommendationNode)
    .addNode(NODE_NAMES.RESOURCE, async (state) => {
      toolExecuted = true;
      return await resourceNode(state);
    })
    .addEdge(START, NODE_NAMES.EXTRACT)
    .addEdge(NODE_NAMES.EXTRACT, NODE_NAMES.COMPARE)
    .addEdge(NODE_NAMES.COMPARE, NODE_NAMES.SCORE)
    .addEdge(NODE_NAMES.SCORE, NODE_NAMES.RECOMMENDATION)
    .addConditionalEdges(NODE_NAMES.RECOMMENDATION, shouldEnrichResources)
    .addEdge(NODE_NAMES.RESOURCE, END)
    .compile();

  const noGapResult = await noGapGraph.invoke({
    resumeText: 'Node.js Express.js developer',
    jobDescription: 'Requirements: Node.js, Express.js'
  });

  console.log(`No-gap overall score: ${noGapResult.score.overall}`);
  console.log(`No-gap recommendation decision: ${noGapResult.recommendation.decision}`);
  console.log(`No-gap learningRoadmap length: ${noGapResult.recommendation.learningRoadmap.length}`);
  console.log(`No-gap learningResources length: ${noGapResult.learningResources.length}`);
  console.log(`Tool executed: ${toolExecuted} (expected false)`);

  if (noGapResult.recommendation.learningRoadmap.length !== 0) {
    throw new Error('Test 7 failed: expected 0 learningRoadmap items for direct matches');
  }
  if (toolExecuted !== false) {
    throw new Error('Test 7 failed: resource_enrichment node was executed when roadmap was empty!');
  }
  if (noGapResult.learningResources.length !== 0) {
    throw new Error('Test 7 failed: learningResources should remain [] when tool is skipped');
  }
  console.log('TEST 7 PASSED: Graph conditionally routed to END, skipping resource_enrichment completely');

  console.log('\n=== ALL M11-B CONDITIONAL ROUTING TESTS PASSED SUCCESSFULLY! ===');
}

runGraphTests().catch((err) => {
  console.error('\nTest failed with error:', err);
  process.exit(1);
});
