import fs from 'fs';

const BASE_URL = 'http://localhost:8000';

async function runTests() {
  console.log('=== TEST 1: Health Check ===');
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

  console.log('\n--- VERIFYING STRUCTURED OUTPUT ---');
  console.log('success === true:', successJson.success === true);

  // Resume Profile checks
  console.log('resumeProfile is object:', typeof successJson.resumeProfile === 'object' && successJson.resumeProfile !== null);
  console.log('resumeProfile.skills is Array:', Array.isArray(successJson.resumeProfile?.skills));
  console.log('resumeProfile.experience is Array:', Array.isArray(successJson.resumeProfile?.experience));
  console.log('resumeProfile.projects is Array:', Array.isArray(successJson.resumeProfile?.projects));
  console.log('resumeProfile.education is Array:', Array.isArray(successJson.resumeProfile?.education));

  // Requirements checks
  console.log('requirements is object:', typeof successJson.requirements === 'object' && successJson.requirements !== null);
  console.log('requirements.jobTitle is string:', typeof successJson.requirements?.jobTitle === 'string');
  console.log('requirements.requiredSkills is Array:', Array.isArray(successJson.requirements?.requiredSkills));
  console.log('requirements.preferredSkills is Array:', Array.isArray(successJson.requirements?.preferredSkills));
  console.log('requirements.responsibilities is Array:', Array.isArray(successJson.requirements?.responsibilities));

  // SkillMatches checks
  console.log('skillMatches is object:', typeof successJson.skillMatches === 'object' && successJson.skillMatches !== null);
  console.log('skillMatches.requirementMatches is Array:', Array.isArray(successJson.skillMatches?.requirementMatches));

  // Validate each requirement match
  const validRelationships = ['direct', 'related', 'partial', 'missing'];
  let directCount = 0, relatedCount = 0, partialCount = 0, missingCount = 0;

  for (const match of successJson.skillMatches?.requirementMatches || []) {
    if (!match.jdRequirement || typeof match.jdRequirement !== 'string') {
      throw new Error(`Invalid match jdRequirement: ${JSON.stringify(match)}`);
    }
    if (!Array.isArray(match.resumeEvidence)) {
      throw new Error(`Invalid match resumeEvidence: ${JSON.stringify(match)}`);
    }
    if (!validRelationships.includes(match.relationship)) {
      throw new Error(`Invalid relationship enum value "${match.relationship}" in: ${JSON.stringify(match)}`);
    }
    if (match.relationship === 'direct') directCount++;
    if (match.relationship === 'related') relatedCount++;
    if (match.relationship === 'partial') partialCount++;
    if (match.relationship === 'missing') missingCount++;
  }

  console.log(`\nSemantic Relationship Breakdown:`);
  console.log(`- direct: ${directCount}`);
  console.log(`- related: ${relatedCount}`);
  console.log(`- partial: ${partialCount}`);
  console.log(`- missing: ${missingCount}`);

  // Analysis checks
  console.log('\nanalysis is object:', typeof successJson.analysis === 'object' && successJson.analysis !== null);
  console.log('analysis.matchedSkills is Array:', Array.isArray(successJson.analysis?.matchedSkills));
  console.log('analysis.missingSkills is Array:', Array.isArray(successJson.analysis?.missingSkills));
  console.log('analysis.relevantExperience is Array:', Array.isArray(successJson.analysis?.relevantExperience));
  console.log('analysis.preliminaryAssessment is string:', typeof successJson.analysis?.preliminaryAssessment === 'string');

  if (
    resSuccess.status !== 200 ||
    successJson.success !== true ||
    typeof successJson.resumeProfile !== 'object' ||
    !Array.isArray(successJson.resumeProfile.skills) ||
    typeof successJson.requirements !== 'object' ||
    !Array.isArray(successJson.requirements.requiredSkills) ||
    typeof successJson.skillMatches !== 'object' ||
    !Array.isArray(successJson.skillMatches.requirementMatches) ||
    successJson.skillMatches.requirementMatches.length === 0 ||
    typeof successJson.analysis !== 'object' ||
    !Array.isArray(successJson.analysis.matchedSkills) ||
    !Array.isArray(successJson.analysis.missingSkills) ||
    !Array.isArray(successJson.analysis.relevantExperience) ||
    typeof successJson.analysis.preliminaryAssessment !== 'string'
  ) {
    throw new Error('Verification of structured response failed');
  }

  console.log('\n--- SAMPLE REQUIREMENT MATCHES ---');
  for (const m of successJson.skillMatches.requirementMatches) {
    console.log(`[${m.relationship.toUpperCase()}] "${m.jdRequirement}" => Evidence: [${m.resumeEvidence.join(', ') || 'None'}]`);
  }

  console.log('\n--- FULL RESPONSE PAYLOAD ---');
  console.log(JSON.stringify(successJson, null, 2));

  console.log('\n=== ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch(err => {
  console.error('\nTest failed with error:', err);
  process.exit(1);
});
