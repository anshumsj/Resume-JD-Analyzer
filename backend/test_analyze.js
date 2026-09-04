import fs from 'fs';
import {
  calculateJobFitScore,
  RELATIONSHIP_SCORES,
  REQUIREMENT_WEIGHTS
} from './src/services/scoringService.js';
import {
  generateCandidateRecommendation,
  DECISION_TYPES,
  RECOMMENDATION_THRESHOLDS,
  ROADMAP_PRIORITY_MATRIX
} from './src/services/recommendationService.js';
import { RecommendationSchema } from './src/utils/recommendationSchema.js';

const BASE_URL = 'http://localhost:8000';

async function runTests() {
  console.log('=== PART A: M8 DETERMINISTIC SCORING UNIT TESTS ===');

  // M8 Unit Test 1: all direct
  const ut1 = calculateJobFitScore(
    { requiredSkills: ['Node.js', 'Express.js'], preferredSkills: [] },
    { requirementMatches: [
      { jdRequirement: 'Node.js', relationship: 'direct', resumeEvidence: ['Node.js'] },
      { jdRequirement: 'Express.js', relationship: 'direct', resumeEvidence: ['Express.js'] }
    ]}
  );
  console.log(`M8 Unit Test 1 (All Direct): overall = ${ut1.overall} (expected 100), recommendation = ${ut1.recommendation}`);
  if (ut1.overall !== 100 || ut1.recommendation !== 'strong_fit') {
    throw new Error(`M8 Unit Test 1 failed: expected 100 strong_fit, got ${ut1.overall} ${ut1.recommendation}`);
  }

  // M8 Unit Test 2: mixed relationships
  const ut2 = calculateJobFitScore(
    { requiredSkills: ['Node.js', 'PostgreSQL', 'Kubernetes'], preferredSkills: [] },
    { requirementMatches: [
      { jdRequirement: 'Node.js', relationship: 'direct', resumeEvidence: ['Node.js'] },
      { jdRequirement: 'PostgreSQL', relationship: 'related', resumeEvidence: ['MySQL'] },
      { jdRequirement: 'Kubernetes', relationship: 'missing', resumeEvidence: [] }
    ]}
  );
  console.log(`M8 Unit Test 2 (Mixed Relationships): overall = ${ut2.overall} (expected 47), recommendation = ${ut2.recommendation}`);
  if (ut2.overall !== 47 || ut2.recommendation !== 'low_fit') {
    throw new Error(`M8 Unit Test 2 failed: expected 47 low_fit, got ${ut2.overall} ${ut2.recommendation}`);
  }

  // M8 Unit Test 3: preferred weighting
  const ut3 = calculateJobFitScore(
    { requiredSkills: ['Node.js'], preferredSkills: ['AWS'] },
    { requirementMatches: [
      { jdRequirement: 'Node.js', relationship: 'direct', resumeEvidence: ['Node.js'] },
      { jdRequirement: 'AWS', relationship: 'partial', resumeEvidence: ['AWS S3'] }
    ]}
  );
  console.log(`M8 Unit Test 3 (Preferred Weighting): overall = ${ut3.overall} (expected 87), required = ${ut3.requiredScore}, preferred = ${ut3.preferredScore}`);
  if (ut3.overall !== 87 || ut3.recommendation !== 'strong_fit' || ut3.requiredScore !== 100 || ut3.preferredScore !== 60) {
    throw new Error(`M8 Unit Test 3 failed: expected 87, 100, 60, got ${ut3.overall}, ${ut3.requiredScore}, ${ut3.preferredScore}`);
  }

  // M8 Unit Test 4: all missing
  const ut4 = calculateJobFitScore(
    { requiredSkills: ['Node.js', 'Redis'], preferredSkills: ['AWS'] },
    { requirementMatches: [
      { jdRequirement: 'Node.js', relationship: 'missing', resumeEvidence: [] },
      { jdRequirement: 'Redis', relationship: 'missing', resumeEvidence: [] },
      { jdRequirement: 'AWS', relationship: 'missing', resumeEvidence: [] }
    ]}
  );
  console.log(`M8 Unit Test 4 (All Missing): overall = ${ut4.overall} (expected 0), recommendation = ${ut4.recommendation}`);
  if (ut4.overall !== 0 || ut4.recommendation !== 'low_fit') {
    throw new Error(`M8 Unit Test 4 failed: expected 0 low_fit, got ${ut4.overall} ${ut4.recommendation}`);
  }

  // M8 Unit Test 5: no preferred skills (safe handling, no NaN, no division by zero)
  const ut5 = calculateJobFitScore(
    { requiredSkills: ['Node.js'], preferredSkills: [] },
    { requirementMatches: [
      { jdRequirement: 'Node.js', relationship: 'direct', resumeEvidence: ['Node.js'] }
    ]}
  );
  console.log(`M8 Unit Test 5 (No Preferred Skills): overall = ${ut5.overall}, preferredScore = ${ut5.preferredScore} (expected null, no NaN)`);
  if (isNaN(ut5.overall) || ut5.preferredScore !== null || ut5.overall !== 100) {
    throw new Error(`M8 Unit Test 5 failed: got overall ${ut5.overall}, preferredScore ${ut5.preferredScore}`);
  }

  console.log('--- ALL M8 SCORING UNIT TESTS PASSED ---\n');

  console.log('=== PART B: M9 CANDIDATE RECOMMENDATION & ROADMAP UNIT TESTS ===');

  // M9 Test 1: Strong candidate (high overall, high required, mostly direct -> apply)
  const req1 = { requiredSkills: ['Node.js', 'Express.js'], preferredSkills: ['AWS'] };
  const matches1 = { requirementMatches: [
    { jdRequirement: 'Node.js', relationship: 'direct', resumeEvidence: ['Node.js'] },
    { jdRequirement: 'Express.js', relationship: 'direct', resumeEvidence: ['Express.js'] },
    { jdRequirement: 'AWS', relationship: 'direct', resumeEvidence: ['AWS'] }
  ]};
  const score1 = calculateJobFitScore(req1, matches1);
  const rec1 = generateCandidateRecommendation({ requirements: req1, skillMatches: matches1, score: score1 });
  console.log(`M9 Test 1 (Strong Candidate): decision = "${rec1.decision}" (expected "apply")`);
  if (rec1.decision !== 'apply' || rec1.strengths.length !== 3 || rec1.learningRoadmap.length !== 0) {
    throw new Error(`M9 Test 1 failed: expected apply with 3 strengths and 0 roadmap items, got ${JSON.stringify(rec1)}`);
  }

  // M9 Test 2: Good candidate with gaps (reasonable score, some gaps -> apply_with_gaps)
  const req2 = { requiredSkills: ['Node.js', 'PostgreSQL'], preferredSkills: ['Kubernetes'] };
  const matches2 = { requirementMatches: [
    { jdRequirement: 'Node.js', relationship: 'direct', resumeEvidence: ['Node.js'] },
    { jdRequirement: 'PostgreSQL', relationship: 'related', resumeEvidence: ['MySQL'] },
    { jdRequirement: 'Kubernetes', relationship: 'missing', resumeEvidence: [] }
  ]};
  const score2 = calculateJobFitScore(req2, matches2);
  const rec2 = generateCandidateRecommendation({ requirements: req2, skillMatches: matches2, score: score2 });
  console.log(`M9 Test 2 (Good with Gaps): decision = "${rec2.decision}" (expected "apply_with_gaps"), gaps = ${rec2.priorityGaps.length}`);
  if (rec2.decision !== 'apply_with_gaps' || rec2.priorityGaps.length !== 2) {
    throw new Error(`M9 Test 2 failed: expected apply_with_gaps with 2 gaps, got ${JSON.stringify(rec2)}`);
  }
  // Check gap ordering: required gap (PostgreSQL) must come before preferred gap (Kubernetes)
  if (rec2.priorityGaps[0].skill !== 'PostgreSQL' || rec2.priorityGaps[1].skill !== 'Kubernetes') {
    throw new Error(`M9 Test 2 failed: required gaps must be prioritized before preferred gaps`);
  }

  // M9 Test 3: Weak candidate (low overall & required score -> low_fit)
  const req3 = { requiredSkills: ['Node.js', 'PostgreSQL', 'Docker'], preferredSkills: ['Kubernetes'] };
  const matches3 = { requirementMatches: [
    { jdRequirement: 'Node.js', relationship: 'missing', resumeEvidence: [] },
    { jdRequirement: 'PostgreSQL', relationship: 'missing', resumeEvidence: [] },
    { jdRequirement: 'Docker', relationship: 'partial', resumeEvidence: ['Docker overview'] },
    { jdRequirement: 'Kubernetes', relationship: 'missing', resumeEvidence: [] }
  ]};
  const score3 = calculateJobFitScore(req3, matches3);
  const rec3 = generateCandidateRecommendation({ requirements: req3, skillMatches: matches3, score: score3 });
  console.log(`M9 Test 3 (Weak Candidate): decision = "${rec3.decision}" (expected "low_fit")`);
  if (rec3.decision !== 'low_fit') {
    throw new Error(`M9 Test 3 failed: expected low_fit, got ${rec3.decision}`);
  }

  // M9 Test 4: Related skill (PostgreSQL -> MySQL, related -> gap with transferable evidence, NOT completely absent)
  const req4 = { requiredSkills: ['PostgreSQL'], preferredSkills: [] };
  const matches4 = { requirementMatches: [
    { jdRequirement: 'PostgreSQL', relationship: 'related', resumeEvidence: ['MySQL'] }
  ]};
  const rec4 = generateCandidateRecommendation({ requirements: req4, skillMatches: matches4 });
  console.log(`M9 Test 4 (Related Skill): relationship = ${rec4.priorityGaps[0]?.relationship}, reason = "${rec4.learningRoadmap[0]?.reason}"`);
  if (
    rec4.priorityGaps[0]?.relationship !== 'related' ||
    !rec4.priorityGaps[0]?.resumeEvidence.includes('MySQL') ||
    !rec4.learningRoadmap[0]?.reason.includes('transferable') ||
    rec4.learningRoadmap[0]?.priority !== 'medium'
  ) {
    throw new Error(`M9 Test 4 failed: related skill not handled as transferable gap: ${JSON.stringify(rec4)}`);
  }

  // M9 Test 5: Direct conceptual match (relational database systems -> MySQL/SQL, direct -> strength, NOT in roadmap)
  const req5 = { requiredSkills: ['relational database systems'], preferredSkills: [] };
  const matches5 = { requirementMatches: [
    { jdRequirement: 'relational database systems', relationship: 'direct', resumeEvidence: ['MySQL', 'SQL'] }
  ]};
  const rec5 = generateCandidateRecommendation({ requirements: req5, skillMatches: matches5 });
  console.log(`M9 Test 5 (Direct Conceptual Match): strengths = [${rec5.strengths}], roadmap count = ${rec5.learningRoadmap.length}`);
  if (!rec5.strengths.includes('relational database systems') || rec5.learningRoadmap.length !== 0) {
    throw new Error(`M9 Test 5 failed: conceptual direct match should be strength and not appear in roadmap`);
  }

  // M9 Test 6: No gaps (all direct matches -> verify learningRoadmap is empty)
  const req6 = { requiredSkills: ['Node.js', 'Docker'], preferredSkills: ['Redis'] };
  const matches6 = { requirementMatches: [
    { jdRequirement: 'Node.js', relationship: 'direct', resumeEvidence: ['Node.js'] },
    { jdRequirement: 'Docker', relationship: 'direct', resumeEvidence: ['Docker'] },
    { jdRequirement: 'Redis', relationship: 'direct', resumeEvidence: ['Redis'] }
  ]};
  const rec6 = generateCandidateRecommendation({ requirements: req6, skillMatches: matches6 });
  console.log(`M9 Test 6 (No Gaps): learningRoadmap length = ${rec6.learningRoadmap.length} (expected 0)`);
  if (rec6.learningRoadmap.length !== 0 || rec6.priorityGaps.length !== 0 || rec6.decision !== 'apply') {
    throw new Error(`M9 Test 6 failed: all direct matches should result in empty roadmap and apply`);
  }

  // M9 Test 7: No preferred skills (verify recommendation still works, no undefined/NaN errors)
  const req7 = { requiredSkills: ['Node.js'], preferredSkills: [] };
  const matches7 = { requirementMatches: [
    { jdRequirement: 'Node.js', relationship: 'direct', resumeEvidence: ['Node.js'] }
  ]};
  const score7 = calculateJobFitScore(req7, matches7);
  const rec7 = generateCandidateRecommendation({ requirements: req7, skillMatches: matches7, score: score7 });
  console.log(`M9 Test 7 (No Preferred Skills): decision = ${rec7.decision}, preferredScore = ${score7.preferredScore}`);
  if (rec7.decision !== 'apply' || typeof rec7.reason !== 'string' || !Array.isArray(rec7.strengths)) {
    throw new Error(`M9 Test 7 failed: safe execution with no preferred skills failed`);
  }

  // M9 Test 8: Deterministic behavior (same input produces exactly the same recommendation)
  const rec8a = generateCandidateRecommendation({ requirements: req2, skillMatches: matches2, score: score2 });
  const rec8b = generateCandidateRecommendation({ requirements: req2, skillMatches: matches2, score: score2 });
  const isIdentical = JSON.stringify(rec8a) === JSON.stringify(rec8b);
  console.log(`M9 Test 8 (Determinism & Idempotence): identical outputs = ${isIdentical}`);
  if (!isIdentical) {
    throw new Error(`M9 Test 8 failed: non-deterministic output detected`);
  }

  console.log('--- ALL M9 RECOMMENDATION & ROADMAP UNIT TESTS PASSED ---\n');

  console.log('=== PART C: API INTEGRATION TESTS ===');

  console.log('\n=== TEST 1: Health Check ===');
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  console.log('Status:', healthRes.status);
  const healthData = await healthRes.json();
  console.log('Body:', healthData);
  if (healthRes.status !== 200 || healthData.status !== 'ok') {
    throw new Error('Health check failed');
  }

  console.log('\n=== TEST 2: Analyze - Missing Resume File ===');
  const fdNoResume = new FormData();
  fdNoResume.append('jobDescription', 'We are looking for a Node.js engineer.');
  const resNoResume = await fetch(`${BASE_URL}/api/analyze`, {
    method: 'POST',
    body: fdNoResume
  });
  console.log('Status:', resNoResume.status);
  const noResumeData = await resNoResume.json();
  console.log('Body:', noResumeData);
  if (resNoResume.status !== 400 || noResumeData.success !== false) {
    throw new Error('Missing resume test failed');
  }

  console.log('\n=== TEST 3: Analyze - Missing Job Description ===');
  const fdNoJd = new FormData();
  fdNoJd.append('resume', new Blob([fs.readFileSync('Resume.pdf.pdf')], { type: 'application/pdf' }), 'Resume.pdf.pdf');
  const resNoJd = await fetch(`${BASE_URL}/api/analyze`, {
    method: 'POST',
    body: fdNoJd
  });
  console.log('Status:', resNoJd.status);
  const noJdData = await resNoJd.json();
  console.log('Body:', noJdData);
  if (resNoJd.status !== 400 || noJdData.success !== false) {
    throw new Error('Missing jobDescription test failed');
  }

  console.log('\n=== TEST 4: Analyze - Invalid File Type (Non-PDF) ===');
  const fdInvalid = new FormData();
  fdInvalid.append('resume', new Blob(['Not a PDF file content'], { type: 'text/plain' }), 'resume.txt');
  fdInvalid.append('jobDescription', 'We need a backend developer.');
  const resInvalid = await fetch(`${BASE_URL}/api/analyze`, {
    method: 'POST',
    body: fdInvalid
  });
  console.log('Status:', resInvalid.status);
  const invalidData = await resInvalid.json();
  console.log('Body:', invalidData);
  if (resInvalid.status !== 400 || invalidData.success !== false) {
    throw new Error('Invalid file type test failed');
  }

  console.log('\n=== TEST 5: Analyze - Real Resume + Realistic SDE Job Description ===');
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

  const fdSuccess = new FormData();
  fdSuccess.append('resume', new Blob([fs.readFileSync('Resume.pdf.pdf')], { type: 'application/pdf' }), 'Resume.pdf.pdf');
  fdSuccess.append('jobDescription', sdeJobDescription);

  console.log('Sending request to /api/analyze...');
  const startTime = Date.now();
  const resSuccess = await fetch(`${BASE_URL}/api/analyze`, {
    method: 'POST',
    body: fdSuccess
  });
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`Status: ${resSuccess.status} (completed in ${duration}s)`);
  const successJson = await resSuccess.json();

  console.log('\n--- VERIFYING COMPLETE RESPONSE STRUCTURE ---');
  console.log('success === true:', successJson.success === true);

  // Resume Profile checks
  console.log('resumeProfile is object:', typeof successJson.resumeProfile === 'object' && successJson.resumeProfile !== null);
  console.log('resumeProfile.skills is Array:', Array.isArray(successJson.resumeProfile?.skills));

  // Requirements checks
  console.log('requirements is object:', typeof successJson.requirements === 'object' && successJson.requirements !== null);
  console.log('requirements.requiredSkills is Array:', Array.isArray(successJson.requirements?.requiredSkills));

  // SkillMatches checks
  console.log('skillMatches is object:', typeof successJson.skillMatches === 'object' && successJson.skillMatches !== null);
  console.log('skillMatches.requirementMatches is Array:', Array.isArray(successJson.skillMatches?.requirementMatches));

  // Deterministic Score checks
  console.log('score is object:', typeof successJson.score === 'object' && successJson.score !== null);
  console.log('score.overall is number (0-100):', typeof successJson.score?.overall === 'number');

  // Deterministic Recommendation checks
  console.log('recommendation is object:', typeof successJson.recommendation === 'object' && successJson.recommendation !== null);
  console.log('recommendation.decision is valid:', ['apply', 'apply_with_gaps', 'low_fit'].includes(successJson.recommendation?.decision));
  console.log('recommendation.reason is string:', typeof successJson.recommendation?.reason === 'string');
  console.log('recommendation.strengths is non-empty Array:', Array.isArray(successJson.recommendation?.strengths) && successJson.recommendation.strengths.length > 0);
  console.log('recommendation.priorityGaps is Array:', Array.isArray(successJson.recommendation?.priorityGaps));
  console.log('recommendation.learningRoadmap is Array:', Array.isArray(successJson.recommendation?.learningRoadmap));

  // Validate recommendation structure with Zod schema
  RecommendationSchema.parse(successJson.recommendation);
  console.log('Recommendation matches Zod schema: true');

  // Analysis checks
  console.log('analysis is object:', typeof successJson.analysis === 'object' && successJson.analysis !== null);
  console.log('analysis.matchedSkills is Array:', Array.isArray(successJson.analysis?.matchedSkills));
  console.log('analysis.preliminaryAssessment is string:', typeof successJson.analysis?.preliminaryAssessment === 'string');

  if (
    resSuccess.status !== 200 ||
    successJson.success !== true ||
    !['apply', 'apply_with_gaps', 'low_fit'].includes(successJson.recommendation?.decision)
  ) {
    throw new Error('Verification of complete response payload failed');
  }

  console.log('\n--- RECOMMENDATION & ROADMAP DETAILS ---');
  console.log(`Decision: ${successJson.recommendation.decision}`);
  console.log(`Reason: ${successJson.recommendation.reason}`);
  console.log(`Strengths (${successJson.recommendation.strengths.length}):`, successJson.recommendation.strengths);

  console.log('\nPriority Gaps:');
  for (const gap of successJson.recommendation.priorityGaps) {
    console.log(`- [${gap.category.toUpperCase()} | ${gap.relationship}] ${gap.skill} (evidence: [${gap.resumeEvidence.join(', ') || 'None'}])`);
  }

  console.log('\nLearning Roadmap:');
  for (const item of successJson.recommendation.learningRoadmap) {
    console.log(`- [PRIORITY: ${item.priority.toUpperCase()} | ${item.category}] ${item.skill}`);
    console.log(`  Reason: ${item.reason}`);
  }

  console.log('\n--- FULL RESPONSE PAYLOAD ---');
  console.log(JSON.stringify(successJson, null, 2));

  console.log('\n=== ALL INTEGRATION & UNIT TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch(err => {
  console.error('\nTest failed with error:', err);
  process.exit(1);
});
