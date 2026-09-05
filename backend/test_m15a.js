import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '../.env' });

import {
  extractJobRequirements,
  deduplicateAndNormalizeSkills
} from './src/services/aiService.js';
import { runJobFitGraph } from './src/graph/jobFitGraph.js';
import { extractTextFromPdf } from './src/services/resumeService.js';

const BASE_URL = 'http://localhost:8000';

const sdeBackendJd = `Software Development Engineer — Backend

About the Role:
We are looking for a Software Development Engineer — Backend to design and scale distributed systems.

Required Skills:
- JavaScript / TypeScript
- Node.js
- REST APIs
- HTTP
- asynchronous programming
- PostgreSQL / relational databases
- SQL
- database design
- indexing
- transactions
- Git
- unit testing
- integration testing
- data structures and algorithms
- OOP
- backend debugging

Preferred Skills:
- Redis
- Docker
- AWS
- Kubernetes
- message queues such as RabbitMQ/Kafka/AWS SQS
- microservices
- CI/CD
- observability
- system design
- JWT
- OAuth 2.0

Responsibilities:
- Design, develop, and maintain high-performance backend microservices
- Collaborate with frontend engineers to define clean REST API contracts
- Write unit and integration tests to ensure software quality and reliability
- Optimize database queries and schema performance`;

const noPreferredJd = `Job Title: Junior Node.js Developer

Requirements:
- JavaScript
- Node.js
- Express.js
- MongoDB
- Git

Responsibilities:
- Build and maintain RESTful APIs
- Fix bugs and optimize backend services`;

async function runM15ATests() {
  console.log('=== MILESTONE 15-A: JD EXTRACTION HARDENING TESTS ===\n');

  // -------------------------------------------------------------
  // TEST 1: Deduplication and Normalization Unit Tests
  // -------------------------------------------------------------
  console.log('--- TEST 1: Deduplication & Normalization Unit Tests ---');

  // 1a: Exact case-insensitive deduplication
  const dupSkills = ['Node.js', 'node.js', '  NODE.JS  ', 'Express.js', '- Express.js'];
  const normDups = deduplicateAndNormalizeSkills(dupSkills);
  console.log('Normalized duplicates:', normDups);
  if (normDups.length !== 2 || normDups[0] !== 'Node.js' || normDups[1] !== 'Express.js') {
    throw new Error(`Test 1a failed: expected ['Node.js', 'Express.js'], got ${JSON.stringify(normDups)}`);
  }
  console.log('Test 1a (Case-insensitive exact deduplication): PASSED');

  // 1b: Distinct variants must NOT be collapsed (Requirement 11)
  const variants = ['JavaScript', 'JavaScript/TypeScript', 'TypeScript/JavaScript', 'javascript'];
  const normVariants = deduplicateAndNormalizeSkills(variants);
  console.log('Normalized variants:', normVariants);
  if (
    normVariants.length !== 3 ||
    !normVariants.includes('JavaScript') ||
    !normVariants.includes('JavaScript/TypeScript') ||
    !normVariants.includes('TypeScript/JavaScript')
  ) {
    throw new Error(`Test 1b failed: variant skills were incorrectly collapsed: ${JSON.stringify(normVariants)}`);
  }
  console.log('Test 1b (Distinct variant preservation without collapsing): PASSED');

  // 1c: Leading bullet characters and whitespace cleanup
  const dirtyItems = ['- PostgreSQL', '• Docker', '* Kubernetes', '  1. Redis  ', ''];
  const normDirty = deduplicateAndNormalizeSkills(dirtyItems);
  console.log('Cleaned bullet items:', normDirty);
  if (
    normDirty.length !== 4 ||
    normDirty[0] !== 'PostgreSQL' ||
    normDirty[1] !== 'Docker' ||
    normDirty[2] !== 'Kubernetes' ||
    normDirty[3] !== 'Redis'
  ) {
    throw new Error(`Test 1c failed: bullet cleaning failed: ${JSON.stringify(normDirty)}`);
  }
  console.log('Test 1c (Bullet and artifact cleaning): PASSED');

  // -------------------------------------------------------------
  // TEST 2: Multi-Skill JD Comprehensive Extraction (Requirement 8)
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Multi-Skill JD Extraction (SDE Backend) ---');
  console.log('Extracting requirements from full SDE Backend JD...');
  const sdeExtracted = await extractJobRequirements(sdeBackendJd);

  console.log(`Job Title: "${sdeExtracted.jobTitle}"`);
  console.log(`Required skills count: ${sdeExtracted.requiredSkills.length}`);
  console.log('Required skills:', sdeExtracted.requiredSkills);
  console.log(`Preferred skills count: ${sdeExtracted.preferredSkills.length}`);
  console.log('Preferred skills:', sdeExtracted.preferredSkills);
  console.log(`Responsibilities count: ${sdeExtracted.responsibilities.length}`);
  console.log('Responsibilities:', sdeExtracted.responsibilities);

  // Must extract multiple required skills (not just the first one)
  if (sdeExtracted.requiredSkills.length < 5) {
    throw new Error(`Test 2 failed: expected at least 5 required skills, got ${sdeExtracted.requiredSkills.length}`);
  }

  // Must extract multiple preferred skills
  if (sdeExtracted.preferredSkills.length < 4) {
    throw new Error(`Test 2 failed: expected at least 4 preferred skills, got ${sdeExtracted.preferredSkills.length}`);
  }

  // Check key competencies are captured
  const reqLower = sdeExtracted.requiredSkills.map(s => s.toLowerCase());
  const hasJsOrTs = reqLower.some(s => s.includes('javascript') || s.includes('typescript'));
  const hasNode = reqLower.some(s => s.includes('node'));
  const hasDbOrSql = reqLower.some(s => s.includes('sql') || s.includes('postgres') || s.includes('database'));
  const hasTesting = reqLower.some(s => s.includes('test'));

  if (!hasJsOrTs || !hasNode || !hasDbOrSql || !hasTesting) {
    throw new Error(`Test 2 failed: missing core required skills in ${JSON.stringify(sdeExtracted.requiredSkills)}`);
  }
  console.log('TEST 2 PASSED: SDE Backend JD extracted multiple required and preferred skills comprehensively');

  // -------------------------------------------------------------
  // TEST 3: Responsibilities Extraction (Requirement 9)
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Responsibilities Extraction ---');
  if (!Array.isArray(sdeExtracted.responsibilities) || sdeExtracted.responsibilities.length === 0) {
    throw new Error('Test 3 failed: responsibilities array is empty or missing');
  }
  console.log(`Extracted ${sdeExtracted.responsibilities.length} responsibilities.`);
  console.log('TEST 3 PASSED: Responsibilities properly extracted rather than discarded');

  // -------------------------------------------------------------
  // TEST 4: JD With No Explicit Preferred Skills (Requirement 10)
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: JD With No Preferred Skills Section ---');
  console.log('Allowing TPM bucket 10s cooldown before Test 4...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  console.log('Extracting requirements from JD with no preferred section...');
  const noPrefExtracted = await extractJobRequirements(noPreferredJd);
  console.log(`No-pref required count: ${noPrefExtracted.requiredSkills.length}`);
  console.log(`No-pref preferred count: ${noPrefExtracted.preferredSkills.length}`);

  if (noPrefExtracted.requiredSkills.length < 3) {
    throw new Error(`Test 4 failed: expected required skills, got ${noPrefExtracted.requiredSkills.length}`);
  }
  if (!Array.isArray(noPrefExtracted.preferredSkills) || noPrefExtracted.preferredSkills.length !== 0) {
    throw new Error(`Test 4 failed: preferredSkills should be empty array [], got ${JSON.stringify(noPrefExtracted.preferredSkills)}`);
  }
  console.log('TEST 4 PASSED: Handled JD with no preferred section without hallucinating preferred skills');

  // -------------------------------------------------------------
  // TEST 5: Full LangGraph End-to-End Test
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Full LangGraph Execution With SDE Backend JD ---');
  console.log('Allowing TPM bucket 15s cooldown before LangGraph execution...');
  await new Promise(resolve => setTimeout(resolve, 15000));
  const pdfBuffer = fs.readFileSync('Resume.pdf.pdf');
  const resumeText = await extractTextFromPdf(pdfBuffer);

  console.log('Invoking runJobFitGraph with candidate resume and SDE Backend JD...');
  const graphState = await runJobFitGraph({ resumeText, jobDescription: sdeBackendJd });

  console.log(`Graph overall fit score: ${graphState.score.overall}/100`);
  console.log(`Graph decision: ${graphState.recommendation.decision}`);
  console.log(`Requirements required count: ${graphState.requirements.requiredSkills.length}`);
  console.log(`Requirements preferred count: ${graphState.requirements.preferredSkills.length}`);
  console.log(`Skill matches count: ${graphState.skillMatches.requirementMatches.length}`);
  console.log(`Priority gaps count: ${graphState.recommendation.priorityGaps.length}`);
  console.log(`Learning roadmap count: ${graphState.recommendation.learningRoadmap.length}`);

  // CRITICAL VERIFICATION: The score must NOT be 100/100 because the candidate has genuine gaps
  if (graphState.score.overall === 100 && graphState.recommendation.learningRoadmap.length === 0) {
    throw new Error('Test 5 failed: Graph incorrectly reported 100% fit with 0 roadmap items!');
  }
  if (graphState.recommendation.learningRoadmap.length === 0) {
    throw new Error('Test 5 failed: candidate should have learning roadmap items for PostgreSQL/Kubernetes/AWS');
  }
  console.log('TEST 5 PASSED: Full LangGraph accurately recognized skill gaps and avoided false 100% fit');

  // -------------------------------------------------------------
  // TEST 6: /api/analyze Integration Test
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: /api/analyze Integration Test ---');
  console.log('Allowing TPM bucket 10s cooldown before API test...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  const fd = new FormData();
  fd.append('resume', new Blob([fs.readFileSync('Resume.pdf.pdf')], { type: 'application/pdf' }), 'Resume.pdf.pdf');
  fd.append('jobDescription', sdeBackendJd);

  const apiRes = await fetch(`${BASE_URL}/api/analyze`, {
    method: 'POST',
    body: fd
  });
  console.log('API Status:', apiRes.status);
  const apiData = await apiRes.json();

  if (apiRes.status !== 200 || !apiData.success) {
    throw new Error(`Test 6 failed: API returned status ${apiRes.status}: ${JSON.stringify(apiData)}`);
  }

  console.log(`API returned requiredSkills count: ${apiData.requirements.requiredSkills.length}`);
  console.log(`API returned preferredSkills count: ${apiData.requirements.preferredSkills.length}`);
  console.log(`API returned score: ${apiData.score.overall}/100`);
  console.log(`API returned decision: ${apiData.recommendation.decision}`);

  if (apiData.requirements.requiredSkills.length < 5) {
    throw new Error(`Test 6 failed: API requiredSkills count was ${apiData.requirements.requiredSkills.length} (expected >= 5)`);
  }
  if (apiData.requirements.preferredSkills.length < 3) {
    throw new Error(`Test 6 failed: API preferredSkills count was ${apiData.requirements.preferredSkills.length} (expected >= 3)`);
  }
  if (apiData.score.overall === 100 && apiData.recommendation.learningRoadmap.length === 0) {
    throw new Error('Test 6 failed: API produced false 100% match!');
  }
  console.log('TEST 6 PASSED: /api/analyze endpoint successfully extracted comprehensive requirements and accurately evaluated fit');

  console.log('\n=== ALL M15-A VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
}

runM15ATests().catch(err => {
  console.error('\nTest failed with error:', err);
  process.exit(1);
});
