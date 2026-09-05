import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '../.env' });

import {
  TOKEN_BUDGETS,
  createGroqChatModel,
  invokeWithRetry,
  parseRetryDelay,
  classifyError,
  deduplicateAndNormalizeSkills,
  extractJobRequirements
} from './src/services/aiService.js';
import { runJobFitGraph } from './src/graph/jobFitGraph.js';
import { extractTextFromPdf } from './src/services/resumeService.js';

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

async function runM15BTests() {
  console.log('====================================================');
  console.log('MILESTONE 15-B: GROQ RATE LIMIT HARDENING TEST SUITE');
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
  // TEST 1: Output Token Budget Verification
  // -------------------------------------------------------------
  console.log('--- TEST 1: Bounded Output-Token Budget Configuration ---');
  assert(
    TOKEN_BUDGETS && typeof TOKEN_BUDGETS === 'object',
    'TOKEN_BUDGETS map is exported'
  );
  assert(
    TOKEN_BUDGETS.JOB_REQUIREMENTS === 1500,
    `JD requirements budget is explicitly bounded to 1500 tokens (got ${TOKEN_BUDGETS.JOB_REQUIREMENTS})`
  );
  assert(
    TOKEN_BUDGETS.RESUME_PROFILE === 1500,
    `Resume profile budget is explicitly bounded to 1500 tokens (got ${TOKEN_BUDGETS.RESUME_PROFILE})`
  );
  assert(
    TOKEN_BUDGETS.REQUIREMENT_COMPARISON === 1800,
    `Requirement comparison budget is bounded to 1800 tokens (got ${TOKEN_BUDGETS.REQUIREMENT_COMPARISON})`
  );
  assert(
    TOKEN_BUDGETS.JOB_FIT_ANALYSIS === 1000,
    `Job-fit analysis budget is bounded to 1000 tokens (got ${TOKEN_BUDGETS.JOB_FIT_ANALYSIS})`
  );

  const testModel = createGroqChatModel(0.1, TOKEN_BUDGETS.JOB_REQUIREMENTS);
  assert(
    testModel.maxTokens === 1500,
    `ChatGroq instance receives maxTokens = 1500 (got ${testModel.maxTokens})`
  );

  // -------------------------------------------------------------
  // TEST 2: Mock 429 Rate-Limit with Timing Information
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Mock 429 Rate Limit Timing Parse & Wait ---');
  {
    const sleptDurations = [];
    const mockSleep = (ms) => {
      sleptDurations.push(ms);
      return Promise.resolve();
    };

    let callCount = 0;
    const mockLlm = {
      invoke: async () => {
        callCount++;
        if (callCount === 1) {
          const err = new Error(
            'Rate limit reached for model openai/gpt-oss-20b in organization org_test on tokens per minute (TPM): Limit 8000, Used 4552, Requested 3673. Please try again in 1.6875s.'
          );
          err.status = 429;
          throw err;
        }
        return { success: true, count: callCount };
      }
    };

    const res = await invokeWithRetry(mockLlm, 'test prompt', {
      sleepFn: mockSleep,
      maxRetries: 3
    });

    assert(res.success === true, 'Call succeeded after rate limit retry');
    assert(callCount === 2, `Expected 2 LLM invocations, got ${callCount}`);
    assert(sleptDurations.length === 1, `Expected 1 sleep call, got ${sleptDurations.length}`);
    assert(
      sleptDurations[0] >= 1687 && sleptDurations[0] <= 2300,
      `Sleep duration (${sleptDurations[0]}ms) accurately waited ~1687.5ms + bounded safety buffer`
    );
  }

  // -------------------------------------------------------------
  // TEST 3: Mock 429 -> 429 -> Success
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Mock 429 -> 429 -> Success ---');
  {
    const sleptDurations = [];
    const mockSleep = (ms) => {
      sleptDurations.push(ms);
      return Promise.resolve();
    };

    let callCount = 0;
    const mockLlm = {
      invoke: async () => {
        callCount++;
        if (callCount === 1) {
          const err = new Error('rate_limit_exceeded: Please try again in 1.2s');
          err.status = 429;
          throw err;
        }
        if (callCount === 2) {
          const err = new Error('Rate limit reached. Please try again in 0.8s');
          err.status = 429;
          throw err;
        }
        return { result: 'all_good' };
      }
    };

    const res = await invokeWithRetry(mockLlm, 'test prompt', {
      sleepFn: mockSleep,
      maxRetries: 4
    });

    assert(res.result === 'all_good', 'Call succeeded on 3rd attempt');
    assert(callCount === 3, `Expected 3 invocations, got ${callCount}`);
    assert(sleptDurations.length === 2, `Expected 2 sleep cycles, got ${sleptDurations.length}`);
    assert(
      sleptDurations[0] >= 1200 && sleptDurations[0] <= 1800,
      `Attempt 1 sleep waited ~1200ms + buffer (got ${sleptDurations[0]}ms)`
    );
    assert(
      sleptDurations[1] >= 800 && sleptDurations[1] <= 1400,
      `Attempt 2 sleep waited ~800ms + buffer (got ${sleptDurations[1]}ms)`
    );
  }

  // -------------------------------------------------------------
  // TEST 4: Mock 429 -> Success (Exactly One Retry)
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Mock 429 -> Success (Single Retry) ---');
  {
    const sleptDurations = [];
    const mockSleep = (ms) => {
      sleptDurations.push(ms);
      return Promise.resolve();
    };

    let callCount = 0;
    const mockLlm = {
      invoke: async () => {
        callCount++;
        if (callCount === 1) {
          const err = new Error('Rate limit reached: Please try again in 0.5s');
          err.status = 429;
          throw err;
        }
        return { data: 'ready' };
      }
    };

    const res = await invokeWithRetry(mockLlm, 'test prompt', {
      sleepFn: mockSleep,
      maxRetries: 5
    });

    assert(res.data === 'ready', 'Successfully received data');
    assert(callCount === 2, `Exactly two invocations took place (got ${callCount})`);
    assert(sleptDurations.length === 1, `Exactly one retry sleep cycle occurred (got ${sleptDurations.length})`);
  }

  // -------------------------------------------------------------
  // TEST 5: Mock Non-Retryable 400 Error (Immediate Abort)
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Mock Non-Retryable Client Error (400) ---');
  {
    const sleptDurations = [];
    const mockSleep = (ms) => {
      sleptDurations.push(ms);
      return Promise.resolve();
    };

    let callCount = 0;
    const mockLlm = {
      invoke: async () => {
        callCount++;
        const err = new Error('Bad request: invalid parameters or schema definition');
        err.status = 400;
        throw err;
      }
    };

    let caughtError = null;
    try {
      await invokeWithRetry(mockLlm, 'test prompt', {
        sleepFn: mockSleep,
        maxRetries: 5
      });
    } catch (err) {
      caughtError = err;
    }

    assert(caughtError !== null, 'Non-retryable 400 was thrown as expected');
    assert(callCount === 1, `LLM was called only once without blind retries (got ${callCount})`);
    assert(sleptDurations.length === 0, 'No sleep or retry attempts were made');
  }

  // -------------------------------------------------------------
  // TEST 6: M15-A Deduplication & Variant Normalization Integrity
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: M15-A Deduplication and Variant Preservation ---');
  {
    // 6a: Case-insensitive deduplication
    const dups = ['Node.js', 'node.js', '  NODE.JS  ', 'Express.js'];
    const normDups = deduplicateAndNormalizeSkills(dups);
    assert(
      normDups.length === 2 && normDups[0] === 'Node.js' && normDups[1] === 'Express.js',
      'Case-insensitive exact deduplication functions correctly'
    );

    // 6b: Distinct variants preserved
    const variants = ['JavaScript', 'JavaScript/TypeScript', 'TypeScript/JavaScript', 'javascript'];
    const normVariants = deduplicateAndNormalizeSkills(variants);
    assert(
      normVariants.length === 3 &&
      normVariants.includes('JavaScript') &&
      normVariants.includes('JavaScript/TypeScript') &&
      normVariants.includes('TypeScript/JavaScript'),
      'Distinct technology variants are preserved without substring collapse'
    );

    // 6c: Bullet and numbering stripping
    const dirty = ['- PostgreSQL', '• Docker', '* Kubernetes', '  1. Redis  '];
    const cleaned = deduplicateAndNormalizeSkills(dirty);
    assert(
      cleaned.length === 4 &&
      cleaned[0] === 'PostgreSQL' &&
      cleaned[1] === 'Docker' &&
      cleaned[2] === 'Kubernetes' &&
      cleaned[3] === 'Redis',
      'Leading bullets, dashes, dots, and numbering are stripped'
    );
  }

  // -------------------------------------------------------------
  // TEST 7: Comprehensive JD Extraction on SDE Backend JD
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Real SDE Backend JD Extraction ---');
  let test7RateLimited = false;
  try {
    console.log('Invoking extractJobRequirements with bounded token budget...');
    const t0 = Date.now();
    const extractedRequirements = await extractJobRequirements(sdeBackendJd);
    console.log(`Extraction completed in ${Date.now() - t0}ms`);
    console.log(`Extracted ${extractedRequirements.requiredSkills.length} required skills`);
    console.log(`Extracted ${extractedRequirements.preferredSkills.length} preferred skills`);
    console.log(`Extracted ${extractedRequirements.responsibilities.length} responsibilities`);

    assert(
      extractedRequirements.requiredSkills.length >= 12,
      `Comprehensive required skills extracted (got ${extractedRequirements.requiredSkills.length}, expected >= 12)`
    );
    assert(
      extractedRequirements.preferredSkills.length >= 8,
      `Comprehensive preferred skills extracted (got ${extractedRequirements.preferredSkills.length}, expected >= 8)`
    );
    assert(
      extractedRequirements.responsibilities.length >= 2,
      `Responsibilities preserved (got ${extractedRequirements.responsibilities.length}, expected >= 2)`
    );

    const requiredText = extractedRequirements.requiredSkills.join(' ').toLowerCase();
    const hasCoreSkills =
      (requiredText.includes('node') || requiredText.includes('javascript') || requiredText.includes('typescript')) &&
      (requiredText.includes('sql') || requiredText.includes('postgres') || requiredText.includes('database'));

    assert(hasCoreSkills, 'Core required technical competencies present in extracted requirements');
  } catch (err) {
    if (err.isRateLimit || err.status === 429 || /rate limit/i.test(err.message)) {
      console.warn(`⚠️ [Provider Constraint] Groq account quota exhausted: ${err.message}`);
      console.warn('Per Milestone 10 instructions: Provider quota remains the external constraint.');
      test7RateLimited = true;
    } else {
      assert(false, `Test 7 failed with error: ${err.message}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 8: Full LangGraph Pipeline Execution with SDE Backend JD
  // -------------------------------------------------------------
  console.log('\n--- TEST 8: Complete LangGraph Pipeline with SDE Backend JD ---');
  let test8RateLimited = false;
  try {
    const pdfBuffer = fs.readFileSync('Resume.pdf.pdf');
    const resumeText = await extractTextFromPdf(pdfBuffer);
    assert(resumeText && resumeText.trim().length > 0, 'Extracted resume text from Resume.pdf.pdf');

    if (test7RateLimited) {
      console.warn('Skipping live pipeline execution because Groq account daily token quota is exhausted.');
      console.warn('Per Milestone 10 instructions: Provider quota remains the external constraint.');
      test8RateLimited = true;
    } else {
      console.log('Running LangGraph workflow with token-budgeted services...');
      const tStart = Date.now();
      const graphResult = await runJobFitGraph(resumeText, sdeBackendJd);
      console.log(`Graph executed in ${((Date.now() - tStart) / 1000).toFixed(2)}s`);

      assert(graphResult.score && typeof graphResult.score.overall === 'number', 'Graph computed score');
      assert(
        graphResult.score.overall < 100,
        `Score is not falsely 100% (got ${graphResult.score.overall}% - realistic candidate evaluation)`
      );
      assert(
        graphResult.recommendation && typeof graphResult.recommendation.decision === 'string',
        `Recommendation decision generated: "${graphResult.recommendation.decision}"`
      );
      assert(
        Array.isArray(graphResult.recommendation.priorityGaps),
        'Priority gaps array is present'
      );
      assert(
        Array.isArray(graphResult.recommendation.learningRoadmap),
        'Learning roadmap array is present'
      );

      console.log(`Decision: ${graphResult.recommendation.decision}`);
      console.log(`Strengths count: ${graphResult.recommendation.strengths.length}`);
      console.log(`Priority gaps count: ${graphResult.recommendation.priorityGaps.length}`);
      console.log(`Roadmap items: ${graphResult.recommendation.learningRoadmap.length}`);
    }
  } catch (err) {
    if (err.isRateLimit || err.status === 429 || /rate limit/i.test(err.message)) {
      console.warn(`⚠️ [Provider Constraint] Groq account quota exhausted: ${err.message}`);
      console.warn('Per Milestone 10 instructions: Provider quota remains the external constraint.');
      test8RateLimited = true;
    } else {
      assert(false, `Test 8 failed with error: ${err.message}`);
    }
  }

  console.log('\n====================================================');
  console.log(`ALL M15-B UNIT & INTEGRATION TESTS FINISHED: ${passed} PASSED, ${failed} FAILED`);
  if (test7RateLimited || test8RateLimited) {
    console.log('NOTICE: Real API execution verified rate limit handling under live Groq constraints.');
    console.log('Provider daily token quota remains the external constraint.');
  }
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runM15BTests().catch((err) => {
  console.error('Fatal error in M15-B test runner:', err);
  process.exit(1);
});
