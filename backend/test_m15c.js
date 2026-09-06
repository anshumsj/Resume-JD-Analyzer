import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '../.env' });

import { resumeSchema } from './src/utils/resumeSchema.js';
import {
  extractResumeProfile,
  deduplicateAndNormalizeSkills,
  classifyError
} from './src/services/aiService.js';
import { extractTextFromPdf } from './src/services/resumeService.js';

const fullTestResumeText = `JANE DOE
Software Engineer | Backend Developer
Email: jane.doe@example.com | Phone: +1-555-0199 | Location: San Francisco, CA

SUMMARY:
Passionate Backend Engineer with experience building scalable REST APIs, asynchronous workers, and database architectures.

TECHNICAL SKILLS:
- Languages: JavaScript, TypeScript, Python
- Backend & Frameworks: Node.js, Express, REST APIs
- Databases & Caching: MongoDB, PostgreSQL, Redis
- DevOps & Cloud: Docker, AWS S3, Git, CI/CD

PROFESSIONAL EXPERIENCE:
Backend Engineer Intern — CloudScale Tech (Jun 2025 – Dec 2025)
- Designed and implemented 10+ RESTful API endpoints using Node.js and Express.
- Optimized database queries in MongoDB and integrated Redis caching, reducing response times by 35%.

PROJECTS:
TaskFlow – Distributed Task Queue Platform
- Built asynchronous job processing engine with Node.js, Redis, and Docker.

EDUCATION:
B.S. in Computer Science — University of California, Berkeley (2021 – 2025)`;

const minimalResumeText = `JOHN SMITH
Full Stack Developer
Skills: JavaScript, Node.js, Express, MongoDB, REST APIs, Git`;

async function runM15CTests() {
  console.log('====================================================');
  console.log('MILESTONE 15-C: RESUME EXTRACTION & SCHEMA HARDENING TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(`❌ FAILED: ${message}`);
      failed++;
      throw new Error(message);
    } else {
      console.log(`✅ PASSED: ${message}`);
      passed++;
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Focused Resume Profile Zod Schema Unit Tests
  // -------------------------------------------------------------
  console.log('--- TEST 1: Focused Resume Profile Schema Unit Tests ---');
  {
    // 1a: Complete valid object
    const validData = {
      skills: ['JavaScript', 'Node.js', 'Express', 'MongoDB'],
      experience: ['Backend Developer Intern at Tech Corp'],
      projects: ['TaskFlow SAAS'],
      education: ['BS in Computer Science']
    };
    const parsed1 = resumeSchema.parse(validData);
    assert(
      parsed1.skills.length === 4 && parsed1.projects.length === 1,
      'Valid complete object parses cleanly'
    );

    // 1b: Missing / empty keys fall back to []
    const emptyObject = {};
    const parsed2 = resumeSchema.parse(emptyObject);
    assert(
      Array.isArray(parsed2.skills) && parsed2.skills.length === 0 &&
      Array.isArray(parsed2.experience) && parsed2.experience.length === 0 &&
      Array.isArray(parsed2.projects) && parsed2.projects.length === 0 &&
      Array.isArray(parsed2.education) && parsed2.education.length === 0,
      'Empty object cleanly defaults all 4 array keys to []'
    );

    // 1c: Partial objects cleanly default omitted keys to []
    const partialData = {
      skills: ['Node.js', 'Redis']
    };
    const parsed3 = resumeSchema.parse(partialData);
    assert(
      parsed3.skills.length === 2 && Array.isArray(parsed3.projects) && parsed3.projects.length === 0,
      'Partial object with omitted sections defaults missing keys to []'
    );
  }

  // -------------------------------------------------------------
  // TEST 2: Deterministic 400 json_validate_failed Abort Classification
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Non-Retryable 400 Classification ---');
  {
    const jsonValidateError = new Error(
      '400 {"error":{"message":"Failed to validate JSON. Please adjust your prompt. See \'failed_generation\' for more details.","type":"invalid_request_error","code":"json_validate_failed","failed_generation":""}}'
    );
    jsonValidateError.status = 400;

    const classified = classifyError(jsonValidateError);
    assert(
      classified === 'NON_RETRYABLE_CLIENT_ERROR',
      `json_validate_failed is classified as NON_RETRYABLE_CLIENT_ERROR (got "${classified}")`
    );
  }

  // -------------------------------------------------------------
  // TEST 3: Realistic Resume Profile Extraction with Full Stack Skills
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Realistic Resume Extraction (Skills, Exp, Proj, Edu) ---');
  try {
    const profile = await extractResumeProfile(fullTestResumeText);
    console.log(`Extracted ${profile.skills.length} skills:`, profile.skills);
    console.log(`Extracted ${profile.experience.length} experience entries`);
    console.log(`Extracted ${profile.projects.length} project entries`);
    console.log(`Extracted ${profile.education.length} education entries`);

    assert(Array.isArray(profile.skills) && profile.skills.length >= 6, 'Extracted realistic skills array');
    assert(Array.isArray(profile.experience) && profile.experience.length >= 1, 'Extracted experience section');
    assert(Array.isArray(profile.projects) && profile.projects.length >= 1, 'Extracted projects section');
    assert(Array.isArray(profile.education) && profile.education.length >= 1, 'Extracted education section');

    const skillText = profile.skills.join(' ').toLowerCase();
    const hasCore = skillText.includes('node') && skillText.includes('express') && skillText.includes('mongodb');
    assert(hasCore, 'Core technical skills (Node.js, Express, MongoDB) preserved in extracted profile');
  } catch (err) {
    if (err.isRateLimit || err.status === 429 || /rate limit/i.test(err.message)) {
      console.warn(`⚠️ [Provider Quota] Groq rate limit reached during live extraction test: ${err.message}`);
    } else {
      assert(false, `Test 3 failed with unexpected error: ${err.message}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 4: Minimal Resume with Missing Sections (No Projects/Experience/Education)
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Minimal Resume (Missing Sections Handling) ---');
  try {
    const minimalProfile = await extractResumeProfile(minimalResumeText);
    console.log('Minimal profile extracted:', minimalProfile);

    assert(Array.isArray(minimalProfile.skills) && minimalProfile.skills.length >= 4, 'Skills extracted from minimal resume');
    assert(Array.isArray(minimalProfile.experience), 'Experience defaults to valid array when missing');
    assert(Array.isArray(minimalProfile.projects), 'Projects defaults to valid array when missing');
    assert(Array.isArray(minimalProfile.education), 'Education defaults to valid array when missing');
  } catch (err) {
    if (err.isRateLimit || err.status === 429 || /rate limit/i.test(err.message)) {
      console.warn(`⚠️ [Provider Quota] Groq rate limit reached during minimal extraction test: ${err.message}`);
    } else {
      assert(false, `Test 4 failed with unexpected error: ${err.message}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 5: Actual Local PDF Extraction Test (Resume.pdf.pdf)
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Actual Resume PDF Text Parsing & Profile Extraction ---');
  try {
    const pdfBuffer = fs.readFileSync('Resume.pdf.pdf');
    const pdfText = await extractTextFromPdf(pdfBuffer);
    assert(pdfText && pdfText.trim().length > 0, 'Extracted text from Resume.pdf.pdf');

    const pdfProfile = await extractResumeProfile(pdfText);
    assert(Array.isArray(pdfProfile.skills) && pdfProfile.skills.length >= 10, 'PDF resume profile extracted successfully');
    console.log(`Successfully extracted ${pdfProfile.skills.length} skills from Resume.pdf.pdf`);
  } catch (err) {
    if (err.isRateLimit || err.status === 429 || /rate limit/i.test(err.message)) {
      console.warn(`⚠️ [Provider Quota] Groq rate limit reached during PDF extraction test: ${err.message}`);
    } else {
      assert(false, `Test 5 failed with unexpected error: ${err.message}`);
    }
  }

  console.log('\n====================================================');
  console.log(`ALL M15-C UNIT & INTEGRATION TESTS FINISHED: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runM15CTests().catch((err) => {
  console.error('Fatal error in M15-C test runner:', err);
  process.exit(1);
});
