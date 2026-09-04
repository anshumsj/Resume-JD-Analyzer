import fs from 'fs';

const BASE_URL = 'http://localhost:8000';

async function runTests() {
  console.log('=== TEST 1: Health Check ===');
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  console.log('Status:', healthRes.status);
  console.log('Body:', await healthRes.json());

  console.log('\n=== TEST 2: Analyze - Missing Resume File ===');
  const fdNoResume = new FormData();
  fdNoResume.append('jobDescription', 'We are looking for a Node.js engineer.');
  const resNoResume = await fetch(`${BASE_URL}/api/analyze`, {
    method: 'POST',
    body: fdNoResume
  });
  console.log('Status:', resNoResume.status);
  console.log('Body:', await resNoResume.json());

  console.log('\n=== TEST 3: Analyze - Missing Job Description ===');
  const fdNoJd = new FormData();
  fdNoJd.append('resume', new Blob([fs.readFileSync('Resume.pdf.pdf')], { type: 'application/pdf' }), 'Resume.pdf.pdf');
  const resNoJd = await fetch(`${BASE_URL}/api/analyze`, {
    method: 'POST',
    body: fdNoJd
  });
  console.log('Status:', resNoJd.status);
  console.log('Body:', await resNoJd.json());

  console.log('\n=== TEST 4: Analyze - Invalid File Type (Non-PDF) ===');
  const fdInvalid = new FormData();
  fdInvalid.append('resume', new Blob(['Hello text'], { type: 'text/plain' }), 'resume.txt');
  fdInvalid.append('jobDescription', 'We need a backend developer.');
  const resInvalid = await fetch(`${BASE_URL}/api/analyze`, {
    method: 'POST',
    body: fdInvalid
  });
  console.log('Status:', resInvalid.status);
  console.log('Body:', await resInvalid.json());

  console.log('\n=== TEST 5: Analyze - Happy Path with Real Resume + Realistic SDE Job Description ===');
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
  console.log('success field:', successJson.success);
  console.log('Analysis preview (first 800 chars):');
  console.log(successJson.analysis ? successJson.analysis.substring(0, 800) + '...' : successJson);

  console.log('\n=== TEST 6: Existing Endpoint Check (/api/resume/extract) ===');
  const fdExtract = new FormData();
  fdExtract.append('resume', new Blob([fs.readFileSync('Resume.pdf.pdf')], { type: 'application/pdf' }), 'Resume.pdf.pdf');
  const resExtract = await fetch(`${BASE_URL}/api/resume/extract`, {
    method: 'POST',
    body: fdExtract
  });
  console.log('Status:', resExtract.status);
  const extractJson = await resExtract.json();
  console.log('Extract success:', extractJson.success, 'Character count:', extractJson.text?.length);
}

runTests().catch(err => console.error('Test script error:', err));
