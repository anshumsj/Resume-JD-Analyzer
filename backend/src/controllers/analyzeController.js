import { extractTextFromPdf } from '../services/resumeService.js';
import { runJobFitGraph } from '../graph/jobFitGraph.js';

/**
 * Controller handling resume-to-job analysis requests via LangGraph orchestration.
 */
export const analyzeJobFit = async (req, res) => {
  try {
    // 1. Validate uploaded resume file
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Resume PDF is required'
      });
    }

    // 2. Validate jobDescription text
    const { jobDescription } = req.body;
    if (!jobDescription || typeof jobDescription !== 'string' || !jobDescription.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Job description is required'
      });
    }

    const trimmedJd = jobDescription.trim();

    // 3. Extract resume text using existing resume service
    let resumeText;
    try {
      resumeText = await extractTextFromPdf(req.file.buffer);
    } catch (parseError) {
      return res.status(500).json({
        success: false,
        error: parseError.message || 'Failed to extract text from resume PDF'
      });
    }

    if (!resumeText || !resumeText.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Unable to extract readable text from the provided resume PDF'
      });
    }

    // 4. Orchestrate end-to-end analysis via LangGraph agent
    let graphResult;
    try {
      graphResult = await runJobFitGraph(resumeText, trimmedJd);
    } catch (graphError) {
      console.error('JobFit Graph Execution Error:', graphError);

      const isRateLimit =
        graphError?.isRateLimit ||
        graphError?.status === 429 ||
        /rate limit|rate_limit_exceeded|tpm budget/i.test(graphError?.message || '');

      const userMessage = isRateLimit
        ? 'The AI analysis service is temporarily busy due to rate limits. Please try again in a few moments.'
        : (graphError?.message || 'Failed to execute job fit analysis workflow')
            .replace(/gsk_[a-zA-Z0-9_-]+/g, '[REDACTED_API_KEY]')
            .replace(/org_[a-zA-Z0-9_-]+/g, '[REDACTED_ORG]');

      return res.status(500).json({
        success: false,
        error: userMessage
      });
    }

    // 5. Return domain response adhering to existing API contract
    return res.status(200).json({
      success: true,
      resumeProfile: graphResult.resumeProfile,
      requirements: graphResult.requirements,
      skillMatches: graphResult.skillMatches,
      score: graphResult.score,
      recommendation: graphResult.recommendation,
      learningResources: graphResult.learningResources,
      analysis: graphResult.analysis
    });
  } catch (error) {
    console.error('Analyze Controller Error:', error);

    const isRateLimit =
      error?.isRateLimit ||
      error?.status === 429 ||
      /rate limit|rate_limit_exceeded|tpm budget/i.test(error?.message || '');

    const userMessage = isRateLimit
      ? 'The AI analysis service is temporarily busy due to rate limits. Please try again in a few moments.'
      : (error?.message || 'An unexpected error occurred during analysis')
          .replace(/gsk_[a-zA-Z0-9_-]+/g, '[REDACTED_API_KEY]')
          .replace(/org_[a-zA-Z0-9_-]+/g, '[REDACTED_ORG]');

    return res.status(500).json({
      success: false,
      error: userMessage
    });
  }
};
