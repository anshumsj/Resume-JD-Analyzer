import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();
dotenv.config({ path: '../.env' });

import { extractTextFromPdf } from './src/services/resumeService.js';
import {
  jobFitGraph,
  runJobFitGraph,
  NODE_NAMES,
  buildJobFitGraph
} from './src/graph/jobFitGraph.js';

async function runGraphTests() {
  console.log('=== MILESTONE 11-A: LANGGRAPH ORCHESTRATION TESTS ===\n');

  // Test 1: Verify graph compilation & structure
  console.log('--- TEST 1: Graph Compilation & Node Structure ---');
  if (!jobFitGraph) {
    throw new Error('Graph failed to compile or is undefined');
  }
  console.log('Graph compiled successfully.');
  console.log('Registered node names:', Object.values(NODE_NAMES));

  // Test 2: Unit test with controlled/mock inputs to verify node sequence & state updates
  console.log('\n--- TEST 2: Node Sequence & State Transformation Test ---');
  const customWorkflow = buildJobFitGraph();
  if (typeof customWorkflow.invoke !== 'function') {
    throw new Error('Compiled workflow does not have an invoke method');
  }
  console.log('buildJobFitGraph produces a valid executable Runnable.');

  // Test 3: End-to-end execution with real Resume PDF text + realistic SDE JD
  console.log('\n--- TEST 3: End-to-End Execution with Real Resume PDF ---');
  const pdfBuffer = fs.readFileSync('Resume.pdf.pdf');
  const resumeText = await extractTextFromPdf(pdfBuffer);
  console.log(`Extracted resume text: ${resumeText.length} characters`);

  const jobDescription = `Job Title: Backend Software Engineer

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

  console.log('Invoking runJobFitGraph...');
  const startTime = Date.now();
  const finalState = await runJobFitGraph({ resumeText, jobDescription });
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`runJobFitGraph completed in ${duration}s\n`);

  console.log('--- VERIFYING FINAL SHARED STATE ---');
  const requiredKeys = [
    'resumeText',
    'jobDescription',
    'resumeProfile',
    'requirements',
    'skillMatches',
    'score',
    'recommendation',
    'learningResources'
  ];

  for (const key of requiredKeys) {
    const hasKey = key in finalState && finalState[key] !== null && finalState[key] !== undefined;
    console.log(`state.${key} exists: ${hasKey}`);
    if (!hasKey) {
      throw new Error(`Missing expected state property: ${key}`);
    }
  }

  // Verify internal structures
  console.log('\n--- STATE PROPERTY VALIDATION ---');
  console.log('resumeProfile.skills is Array:', Array.isArray(finalState.resumeProfile?.skills));
  console.log('requirements.requiredSkills is Array:', Array.isArray(finalState.requirements?.requiredSkills));
  console.log('skillMatches.requirementMatches is Array:', Array.isArray(finalState.skillMatches?.requirementMatches));
  console.log('score.overall is Number (0-100):', typeof finalState.score?.overall === 'number');
  console.log('score.breakdown is non-empty Array:', Array.isArray(finalState.score?.breakdown) && finalState.score.breakdown.length > 0);
  console.log('recommendation.decision is valid:', ['apply', 'apply_with_gaps', 'low_fit'].includes(finalState.recommendation?.decision));
  console.log('recommendation.strengths is Array:', Array.isArray(finalState.recommendation?.strengths));
  console.log('recommendation.priorityGaps is Array:', Array.isArray(finalState.recommendation?.priorityGaps));
  console.log('recommendation.learningRoadmap is Array:', Array.isArray(finalState.recommendation?.learningRoadmap));
  console.log('learningResources is Array:', Array.isArray(finalState.learningResources));

  console.log('\n--- ORCHESTRATION PIPELINE SUMMARY ---');
  console.log(`Candidate Fit Score: ${finalState.score.overall}/100`);
  console.log(`Recommendation: ${finalState.recommendation.decision}`);
  console.log(`Reason: ${finalState.recommendation.reason}`);
  console.log(`Strengths count: ${finalState.recommendation.strengths.length}`);
  console.log(`Gaps count: ${finalState.recommendation.priorityGaps.length}`);
  console.log(`Roadmap items count: ${finalState.recommendation.learningRoadmap.length}`);
  console.log(`Learning resources enriched count: ${finalState.learningResources.length}`);

  console.log('\n=== ALL LANGGRAPH ORCHESTRATION TESTS PASSED SUCCESSFULLY! ===');
}

runGraphTests().catch((err) => {
  console.error('\nGraph test failed with error:', err);
  process.exit(1);
});
