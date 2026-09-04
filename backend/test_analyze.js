import fs from 'fs';
import {
  calculateJobFitScore,
  RELATIONSHIP_SCORES,
  REQUIREMENT_WEIGHTS,
  getRecommendation
} from './src/services/scoringService.js';

const BASE_URL = 'http://localhost:8000';

async function runTests() {
  console.log('=== PART A: DETERMINISTIC SCORING UNIT TESTS ===');

  // Unit Test 1: all direct
  const ut1 = calculateJobFitScore(
    { requiredSkills: ['Node.js', 'Express.js'], preferredSkills: [] },
    { requirementMatches: [
      { jdRequirement: 'Node.js', relationship: 'direct', resumeEvidence: ['Node.js'] },
      { jdRequirement: 'Express.js', relationship: 'direct', resumeEvidence: ['Express.js'] }
    ]}
  );
  console.log(`Unit Test 1 (All Direct): overall = ${ut1.overall} (expected 100), recommendation = ${ut1.recommendation}`);
  if (ut1.overall !== 100 || ut1.recommendation !== 'strong_fit') {
    throw new Error(`Unit Test 1 failed: expected 100 strong_fit, got ${ut1.overall} ${ut1.recommendation}`);
  }

  // Unit Test 2: mixed relationships
  const ut2 = calculateJobFitScore(
    { requiredSkills: ['Node.js', 'PostgreSQL', 'Kubernetes'], preferredSkills: [] },
    { requirementMatches: [
      { jdRequirement: 'Node.js', relationship: 'direct', resumeEvidence: ['Node.js'] },
      { jdRequirement: 'PostgreSQL', relationship: 'related', resumeEvidence: ['MySQL'] },
      { jdRequirement: 'Kubernetes', relationship: 'missing', resumeEvidence: [] }
    ]}
  );
  console.log(`Unit Test 2 (Mixed Relationships): overall = ${ut2.overall} (expected 47), recommendation = ${ut2.recommendation}`);
  if (ut2.overall !== 47 || ut2.recommendation !== 'low_fit') {
    throw new Error(`Unit Test 2 failed: expected 47 low_fit, got ${ut2.overall} ${ut2.recommendation}`);
  }

  // Unit Test 3: preferred weighting
  const ut3 = calculateJobFitScore(
    { requiredSkills: ['Node.js'], preferredSkills: ['AWS'] },
    { requirementMatches: [
      { jdRequirement: 'Node.js', relationship: 'direct', resumeEvidence: ['Node.js'] },
      { jdRequirement: 'AWS', relationship: 'partial', resumeEvidence: ['AWS S3'] }
    ]}
  );
  console.log(`Unit Test 3 (Preferred Weighting): overall = ${ut3.overall} (expected 87), required = ${ut3.requiredScore}, preferred = ${ut3.preferredScore}`);
  if (ut3.overall !== 87 || ut3.recommendation !== 'strong_fit' || ut3.requiredScore !== 100 || ut3.preferredScore !== 60) {
    throw new Error(`Unit Test 3 failed: expected 87, 100, 60, got ${ut3.overall}, ${ut3.requiredScore}, ${ut3.preferredScore}`);
  }

  // Unit Test 4: all missing
  const ut4 = calculateJobFitScore(
    { requiredSkills: ['Node.js', 'Redis'], preferredSkills: ['AWS'] },
    { requirementMatches: [
      { jdRequirement: 'Node.js', relationship: 'missing', resumeEvidence: [] },
      { jdRequirement: 'Redis', relationship: 'missing', resumeEvidence: [] },
      { jdRequirement: 'AWS', relationship: 'missing', resumeEvidence: [] }
    ]}
  );
  console.log(`Unit Test 4 (All Missing): overall = ${ut4.overall} (expected 0), recommendation = ${ut4.recommendation}`);
  if (ut4.overall !== 0 || ut4.recommendation !== 'low_fit') {
    throw new Error(`Unit Test 4 failed: expected 0 low_fit, got ${ut4.overall} ${ut4.recommendation}`);
  }

  // Unit Test 5: no preferred skills (safe handling, no NaN, no division by zero)
  const ut5 = calculateJobFitScore(
    { requiredSkills: ['Node.js'], preferredSkills: [] },
    { requirementMatches: [
      { jdRequirement: 'Node.js', relationship: 'direct', resumeEvidence: ['Node.js'] }
    ]}
  );
  console.log(`Unit Test 5 (No Preferred Skills): overall = ${ut5.overall}, preferredScore = ${ut5.preferredScore} (expected null, no NaN)`);
  if (isNaN(ut5.overall) || ut5.preferredScore !== null || ut5.overall !== 100) {
    throw new Error(`Unit Test 5 failed: got overall ${ut5.overall}, preferredScore ${ut5.preferredScore}`);
  }

  console.log('--- ALL UNIT TESTS PASSED ---\n');

  console.log('=== PART B: API INTEGRATION TESTS ===');

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
  console.log('score.overall is number (0-100):', typeof successJson.score?.overall === 'number' && successJson.score.overall >= 0 && successJson.score.overall <= 100);
  console.log('score.requiredScore is number:', typeof successJson.score?.requiredScore === 'number');
  console.log('score.preferredScore is number or null:', typeof successJson.score?.preferredScore === 'number' || successJson.score?.preferredScore === null);
  console.log('score.recommendation is valid:', ['strong_fit', 'good_fit', 'moderate_fit', 'low_fit'].includes(successJson.score?.recommendation));
  console.log('score.breakdown is non-empty Array:', Array.isArray(successJson.score?.breakdown) && successJson.score.breakdown.length > 0);

  // Validate breakdown item structure
  for (const b of successJson.score?.breakdown || []) {
    if (!b.requirement || typeof b.requirement !== 'string') {
      throw new Error(`Invalid breakdown requirement: ${JSON.stringify(b)}`);
    }
    if (!['required', 'preferred'].includes(b.category)) {
      throw new Error(`Invalid breakdown category: ${JSON.stringify(b)}`);
    }
    if (!['direct', 'related', 'partial', 'missing'].includes(b.relationship)) {
      throw new Error(`Invalid breakdown relationship: ${JSON.stringify(b)}`);
    }
    if (typeof b.relationshipScore !== 'number') {
      throw new Error(`Invalid breakdown relationshipScore: ${JSON.stringify(b)}`);
    }
    if (typeof b.requirementWeight !== 'number') {
      throw new Error(`Invalid breakdown requirementWeight: ${JSON.stringify(b)}`);
    }
    if (typeof b.contribution !== 'number') {
      throw new Error(`Invalid breakdown contribution: ${JSON.stringify(b)}`);
    }
    if (!Array.isArray(b.resumeEvidence)) {
      throw new Error(`Invalid breakdown resumeEvidence: ${JSON.stringify(b)}`);
    }
  }

  // Analysis checks
  console.log('analysis is object:', typeof successJson.analysis === 'object' && successJson.analysis !== null);
  console.log('analysis.matchedSkills is Array:', Array.isArray(successJson.analysis?.matchedSkills));
  console.log('analysis.preliminaryAssessment is string:', typeof successJson.analysis?.preliminaryAssessment === 'string');

  if (
    resSuccess.status !== 200 ||
    successJson.success !== true ||
    typeof successJson.score?.overall !== 'number' ||
    !['strong_fit', 'good_fit', 'moderate_fit', 'low_fit'].includes(successJson.score?.recommendation)
  ) {
    throw new Error('Verification of complete response payload failed');
  }

  console.log('\n--- DETERMINISTIC SCORE DETAILS ---');
  console.log(`Overall Score: ${successJson.score.overall}/100`);
  console.log(`Required Skills Score: ${successJson.score.requiredScore}%`);
  console.log(`Preferred Skills Score: ${successJson.score.preferredScore}%`);
  console.log(`Recommendation: ${successJson.score.recommendation}`);

  console.log('\n--- SCORE BREAKDOWN ---');
  for (const b of successJson.score.breakdown) {
    console.log(
      `[${b.category.toUpperCase()}] "${b.requirement}" => ${b.relationship} (score: ${b.relationshipScore}, wt: ${b.requirementWeight}, contrib: ${b.contribution}) Evidence: [${b.resumeEvidence.join(', ') || 'None'}]`
    );
  }

  console.log('\n--- FULL RESPONSE PAYLOAD ---');
  console.log(JSON.stringify(successJson, null, 2));

  console.log('\n=== ALL INTEGRATION & UNIT TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch(err => {
  console.error('\nTest failed with error:', err);
  process.exit(1);
});
