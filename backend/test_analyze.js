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
  const sdeJobDescription = `Job Title: Backend Software Engineer (Node.js)

About the Role:
We are looking for a motivated Backend Engineer to build high-performance distributed backend services and APIs.

Key Responsibilities:
- Design, build, and maintain scalable REST APIs and microservices using Node.js, Express, and MongoDB / PostgreSQL.
- Architect real-time communication systems and asynchronous background task processing using Redis, BullMQ, and WebSockets.
- Optimize database schemas, queries, and caching mechanisms.
- Collaborate with frontend engineers working in React/Next.js.

Requirements:
- Bachelor's degree in Computer Science, Software Engineering, or equivalent.
- Strong hands-on experience with JavaScript, Node.js, Express, and RESTful architecture.
- Solid database fundamentals in MongoDB, MySQL, or Redis.
- Knowledge of asynchronous event-driven design, message queues (BullMQ/RabbitMQ), and Socket.IO.
- Familiarity with Docker, Kubernetes, and AWS deployment is a plus.
- Good understanding of Data Structures, Algorithms, and System Design.`;

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
  console.log('analysis is object (not markdown string):', typeof successJson.analysis === 'object' && !Array.isArray(successJson.analysis) && typeof successJson.analysis !== 'string');
  console.log('analysis.matchedSkills is Array:', Array.isArray(successJson.analysis?.matchedSkills));
  console.log('analysis.missingSkills is Array:', Array.isArray(successJson.analysis?.missingSkills));
  console.log('analysis.relevantExperience is Array:', Array.isArray(successJson.analysis?.relevantExperience));
  console.log('analysis.preliminaryAssessment is string:', typeof successJson.analysis?.preliminaryAssessment === 'string');

  if (
    resSuccess.status !== 200 ||
    successJson.success !== true ||
    typeof successJson.analysis !== 'object' ||
    typeof successJson.analysis === 'string' ||
    !Array.isArray(successJson.analysis.matchedSkills) ||
    !Array.isArray(successJson.analysis.missingSkills) ||
    !Array.isArray(successJson.analysis.relevantExperience) ||
    typeof successJson.analysis.preliminaryAssessment !== 'string'
  ) {
    throw new Error('Structured analysis response format verification failed');
  }

  console.log('\n--- FULL STRUCTURED RESPONSE ---');
  console.log(JSON.stringify(successJson, null, 2));

  console.log('\n=== ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch(err => {
  console.error('\nTest failed with error:', err);
  process.exit(1);
});
