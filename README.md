# JobFit AI — Resume & Job Description Alignment Agent

JobFit AI is an automated resume and job description analysis system built on a hybrid architecture: LLM extraction and semantic matching orchestrated via LangGraph, paired with a 100% deterministic scoring and recommendation engine. It parses technical resumes, extracts exhaustive job requirements, evaluates candidate fit with evidence-backed skill matches, and generates a prioritized learning roadmap for identified gaps.

---

## Architectural Overview

A core failure mode in LLM-based evaluation pipelines is non-deterministic scoring: asking a language model to directly output a score of `85/100` leads to hallucinations, prompt sensitivity, and unexplainable drift. 

JobFit AI strictly separates **semantic interpretation** from **decision making**:

```
                       ┌──────────────────────────────────────────────┐
                       │               PDF Resume Upload              │
                       │           + Job Description (Text)           │
                       └──────────────────────┬───────────────────────┘
                                              │
                                              ▼
                                 [ LangGraph State Machine ]
                                              │
                         ┌────────────────────┴────────────────────┐
                         ▼                                         ▼
               extractResumeProfile()                    extractJobRequirements()
            (Candidate skills, exp, proj)             (Required, Preferred, Duties)
                         └────────────────────┬────────────────────┘
                                              │
                                              ▼
                                 compareResumeToRequirements()
                            (Direct, Related, Partial, Missing)
                                              │
                         ┌────────────────────┴────────────────────┐
                         ▼                                         ▼
            calculateJobFitScore()               generateCandidateRecommendation()
        (Deterministic weighted math)                (Ordered gap roadmap)
                         └────────────────────┬────────────────────┘
                                              │
                                              ▼
                                    enrichLearningRoadmap()
                                  (Curated web documentation)
                                              │
                                              ▼
                                [ API Response & UI Render ]
```

1. **LLM Domain (Extraction & Semantic Mapping)**:
   - Extracts structured candidate profiles from raw PDF text (`resumeSchema`).
   - Extracts exhaustive requirements, classifying required vs. preferred competencies and responsibilities (`jobRequirementSchema`).
   - Maps candidate evidence against JD requirements into four technical relationships: `direct`, `related`, `partial`, and `missing` (`skillMatchSchema`).
2. **Deterministic Domain (Math & Business Logic)**:
   - Computes weighted candidate scores based on requirement tiers and match depth (no LLM drift).
   - Generates recommendation decisions (`apply`, `apply_with_gaps`, `low_fit`) and prioritizes skill gaps according to a priority matrix.
3. **Web Search Enrichment**:
   - Discovers authoritative documentation, guides, and tutorials for prioritized gap skills via web search.

---

## Key Technical Decisions & Engineering Highlights

### 1. LangGraph Orchestration Pipeline
Instead of chaining disjointed API routes or procedural scripts, the execution path is modeled as a compiled LangGraph state machine (`backend/src/graph/jobFitGraph.js`):
- **`extractNode`**: Concurrently extracts resume profile and job requirements.
- **`compareNode`**: Performs semantic comparison and qualitative analysis using the extracted profiles.
- **`scoreNode`**: Computes mathematical score breakdown deterministically.
- **`recommendationNode`**: Evaluates match tiers, candidate strengths, and prioritized roadmap.
- **`resourceNode`**: Enriches identified gaps with learning resources when gaps exist.

### 2. Exhaustive JD Extraction & Variant Preservation (Milestone 15-A)
Real-world job descriptions often bundle composite technical competencies into single sentences (e.g., *"PostgreSQL / relational databases, SQL, database design, indexing, transactions"*). 
- Prompt instructions enforce item-level extraction of discrete skills across the entire JD rather than truncating after the first line.
- `deduplicateAndNormalizeSkills()` performs case-insensitive deduplication while preserving distinct technology variants (e.g., maintaining `JavaScript`, `JavaScript/TypeScript`, and `TypeScript/JavaScript` as separate competencies without destructive substring collapsing).
- Strips leading bullet markers, numbering artifacts, and excessive whitespace.

### 3. Rate-Limit Awareness & Output Token Budgeting (Milestone 15-B)
When using high-capacity models like Groq's `llama-3.3-70b-versatile` or `openai/gpt-oss-20b` under strict Token-Per-Minute (TPM) limits:
- **Output Token Budgets (`TOKEN_BUDGETS`)**: Bounded explicit `maxTokens` allocation per task:
  - `JOB_REQUIREMENTS: 1500 tokens`
  - `RESUME_PROFILE: 1500 tokens`
  - `REQUIREMENT_COMPARISON: 1800 tokens`
  - `JOB_FIT_ANALYSIS: 1000 tokens`
  This eliminates unconstrained token reservations (~2,048 tokens default) and reduced prompt request spikes by over 25%, while guaranteeing sufficient budget to prevent JSON truncation.
- **Dynamic Delay Parsing**: `parseRetryDelay()` inspects HTTP `Retry-After` headers and extracts timing from Groq error messages (e.g. `"Please try again in 1.6875s"` or minute/second formats).
- **Safe Backoff & Jitter**: Retries with bounded jitter (250ms–500ms safety buffer). If a provider wait exceeds 30 seconds (such as daily token limits), the request aborts gracefully rather than freezing client connections.
- **Credential Sanitization**: `sanitizeErrorMessage()` automatically redacts API keys (`gsk_...`) and organization IDs from server logs and client-facing error responses.

### 4. Deterministic Scoring Algorithm
The match score is calculated in `backend/src/services/scoringService.js`:
- **Relationship Weights**:
  - `direct`: 1.0 (100%)
  - `related`: 0.6 (60%)
  - `partial`: 0.4 (40%)
  - `missing`: 0.0 (0%)
- **Category Weights**:
  - Required skills: **80%** of the score.
  - Preferred skills: **20%** of the score.
  - When no preferred skills exist in the JD, required skills constitute 100% of the score with zero division-by-zero or `NaN` anomalies.

### 5. Vanilla JS Client with Persistent State (Milestone 15)
The frontend is constructed using pure Vanilla JavaScript (ES Modules) and modular CSS without heavy framework overhead:
- **Design System**: Strict dark-theme design tokens inspired by developer tools (Linear, Raycast, Vercel) with crisp typographic hierarchy and semantic status colors.
- **State Persistence (`storage.js`)**: Analysis results survive browser refreshes by persisting state under versioned LocalStorage keys (`JOBFIT_ANALYSIS_V1`). State is validated upon restoration and safely purged when starting a new analysis.

---

## Project Structure

```
intern_assignment/
├── README.md
├── backend/
│   ├── server.js                      # Express HTTP server setup & port binding
│   ├── package.json
│   ├── .env.example
│   ├── src/
│   │   ├── controllers/
│   │   │   └── analyzeController.js   # Request parsing, multer validation, graph execution
│   │   ├── graph/
│   │   │   ├── jobFitGraph.js         # LangGraph state machine & node orchestration
│   │   │   └── jobFitState.js         # State channel annotation schemas
│   │   ├── services/
│   │   │   ├── aiService.js           # Groq LLM integration, token budgets, retry backoff
│   │   │   ├── resumeService.js       # PDF text extraction via pdf-parse
│   │   │   ├── scoringService.js      # Deterministic mathematical fit scoring
│   │   │   ├── recommendationService.js # Decision tiers & gap roadmap priority matrix
│   │   │   └── webSearchService.js    # Learning resource discovery
│   │   └── utils/                     # Zod validation schemas
│   │       ├── jobFitSchema.js
│   │       ├── jobRequirementSchema.js
│   │       ├── recommendationSchema.js
│   │       ├── resumeSchema.js
│   │       └── skillMatchSchema.js
│   └── test_*.js                      # Automated test suites (M8–M15B)
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.js                    # SPA bootstrap & router
        ├── pages/
        │   └── AnalyzePage.js         # Form upload, state orchestration, persistent view
        ├── components/
        │   ├── AppShell.js            # Main application layout, header, footer
        │   ├── AnalysisForm.js        # File upload + JD textarea input container
        │   ├── FileUpload.js          # Drag-and-drop PDF upload component
        │   ├── FitSummary.js          # Score display & candidate verdict card
        │   ├── SkillComparison.js     # Direct/related/partial/missing breakdown
        │   ├── LearningRoadmap.js     # Priority gap list & curated documentation links
        │   └── primitives/            # Reusable UI building blocks (Badge, Button, etc.)
        └── utils/
            └── storage.js             # LocalStorage persistence & schema validation
```

---

## Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Groq API Key**: A valid API key from [Groq Console](https://console.groq.com/)

### 1. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory:

```bash
cp .env.example .env
```

Configure your environment variables:

```env
GROQ_API_KEY=gsk_your_actual_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
PORT=8000
```

Start the backend service:

```bash
npm start
```

The server will start on `http://localhost:8000`.

### 2. Frontend Setup

In a new terminal window:

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server will run at `http://localhost:5173` (or `http://localhost:5174`/`5175`).

Open the application in your browser, upload a technical resume PDF, paste a job description, and run the analysis.

---

## API Specification

### `POST /api/analyze`
Accepts a candidate resume in PDF format and target job description text.

- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `resume`: PDF file (required, max 10MB)
  - `jobDescription`: String (required, non-empty)

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "resumeProfile": {
    "candidateName": "Anshum Awasthi",
    "skills": ["JavaScript", "Node.js", "Express.js", "PostgreSQL", "Docker"],
    "experience": ["Backend Developer Intern: built microservices..."],
    "projects": ["JobFit AI: automated resume analysis pipeline..."],
    "education": ["B.Tech in Computer Science and Engineering"]
  },
  "requirements": {
    "jobTitle": "Backend Software Engineer",
    "requiredSkills": ["JavaScript / TypeScript", "Node.js", "PostgreSQL", "Redis", "Docker"],
    "preferredSkills": ["AWS", "Kubernetes", "Microservices"],
    "responsibilities": ["Design scalable REST APIs", "Maintain PostgreSQL schemas"]
  },
  "skillMatches": {
    "requirementMatches": [
      {
        "jdRequirement": "Node.js",
        "relationship": "direct",
        "resumeEvidence": ["Node.js"]
      },
      {
        "jdRequirement": "PostgreSQL",
        "relationship": "related",
        "resumeEvidence": ["MySQL"]
      },
      {
        "jdRequirement": "Kubernetes",
        "relationship": "missing",
        "resumeEvidence": []
      }
    ]
  },
  "score": {
    "overall": 76,
    "requiredScore": 82,
    "preferredScore": 50,
    "recommendation": "apply_with_gaps",
    "breakdown": [
      {
        "category": "required",
        "skill": "Node.js",
        "relationship": "direct",
        "pointsEarned": 100
      }
    ]
  },
  "recommendation": {
    "decision": "apply_with_gaps",
    "reason": "Strong foundation in core backend technologies with minor gaps in container orchestration.",
    "strengths": ["Node.js", "JavaScript / TypeScript"],
    "priorityGaps": [
      {
        "skill": "Kubernetes",
        "category": "preferred",
        "priority": "medium",
        "impact": "Required for production deployment workflows."
      }
    ],
    "learningRoadmap": [
      {
        "skill": "Kubernetes",
        "priority": "medium",
        "resources": [
          {
            "title": "Kubernetes Documentation",
            "url": "https://kubernetes.io/docs/home/",
            "source": "kubernetes.io"
          }
        ]
      }
    ]
  },
  "analysis": {
    "preliminaryAssessment": "Candidate meets primary backend development expectations with transferable database knowledge."
  }
}
```

#### Error Responses
- `400 Bad Request`: Missing PDF, invalid file format, or missing job description.
- `500 Internal Server Error`: Backend orchestration failure or rate limit saturation. Returns sanitized client-safe message (`"The AI analysis service is temporarily busy due to rate limits. Please try again in a few moments."`).

---

## Test Suites & Validation

The codebase includes comprehensive unit, integration, and end-to-end regression suites located in `backend/`:

### 1. Deterministic Engine & Full Flow Tests (`test_analyze.js`)
Tests scoring logic, candidate recommendations, web search isolation, health checks, input validation, and end-to-end API orchestration:
```bash
cd backend
node test_analyze.js
```
- **Part A (M8)**: Verifies scoring math (all direct = 100, mixed relationships = 47, no preferred skills = 100 with `null` preferred score, zero division).
- **Part B (M9)**: Verifies candidate recommendation decisions (`apply`, `apply_with_gaps`, `low_fit`) and priority gap ordering.
- **Part C (M10)**: Verifies learning resource search and confirms search results have 0% mutation effect on fit scores.
- **Part D (M12)**: Validates HTTP 400 rejection on invalid inputs and verifies complete 7-field API contracts.

### 2. Extraction Exhaustiveness & Variant Tests (`test_m15a.js`)
Tests JD requirement extraction depth against full engineering specs:
```bash
cd backend
node test_m15a.js
```
- Validates that composite skill bullets are split into discrete competencies.
- Confirms variant technologies (`JavaScript` vs `JavaScript/TypeScript`) are not destructively merged.

### 3. Rate Limit Hardening & Token Budget Tests (`test_m15b.js`)
Verifies token budgets and backoff resiliency:
```bash
cd backend
node test_m15b.js
```
- Tests explicit `maxTokens` configuration per task.
- Tests mock 429 response handling and timing extraction (`"Please try again in 1.6875s"`).
- Tests multi-attempt recovery (`429 -> 429 -> success`).
- Tests immediate non-retryable rejection on HTTP 400.

### 4. Frontend Production Build
Validates bundle compilation and asset generation:
```bash
cd frontend
npm run build
```
Builds cleanly with zero errors.

---

## Tech Stack Summary

- **Backend Runtime**: Node.js (ES Modules)
- **API Framework**: Express.js
- **Agent Orchestration**: `@langchain/langgraph`
- **Model Provider Integration**: `@langchain/groq` (Groq API)
- **Schema Validation**: `zod`
- **PDF Extraction**: `pdf-parse`
- **Frontend Architecture**: Vanilla JavaScript (ESM) + Modular CSS tokens
- **Build Tool**: Vite
