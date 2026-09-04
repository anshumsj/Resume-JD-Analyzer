import { extractTextFromPdf } from '../services/resumeService.js';
import {
  extractResumeProfile,
  extractJobRequirements,
  compareResumeToRequirements,
  analyzeResumeJobFit
} from '../services/aiService.js';
import { calculateJobFitScore } from '../services/scoringService.js';
import { generateCandidateRecommendation } from '../services/recommendationService.js';

/**
 * Controller handling resume-to-job analysis requests with semantic comparison and deterministic scoring.
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

    // 4. Extract structured resume profile & structured JD requirements concurrently
    let resumeProfile;
    let requirements;
    try {
      [resumeProfile, requirements] = await Promise.all([
        extractResumeProfile(resumeText),
        extractJobRequirements(trimmedJd)
      ]);
    } catch (extractionError) {
      const rawMsg = extractionError?.message || 'Failed to extract structured profile or requirements';
      const sanitizedMsg = rawMsg.replace(/gsk_[a-zA-Z0-9_-]+/g, '[REDACTED_API_KEY]');
      return res.status(500).json({
        success: false,
        error: sanitizedMsg
      });
    }

    // 5. Perform semantic requirement comparison
    let skillMatches;
    try {
      skillMatches = await compareResumeToRequirements(resumeProfile, requirements, resumeText);
    } catch (comparisonError) {
      const rawMsg = comparisonError?.message || 'Failed to perform semantic requirement comparison';
      const sanitizedMsg = rawMsg.replace(/gsk_[a-zA-Z0-9_-]+/g, '[REDACTED_API_KEY]');
      return res.status(500).json({
        success: false,
        error: sanitizedMsg
      });
    }

    // 6. Calculate deterministic job-fit score and auditable breakdown
    const score = calculateJobFitScore(requirements, skillMatches);

    // 7. Generate deterministic candidate recommendation & learning roadmap
    const recommendation = generateCandidateRecommendation({
      requirements,
      skillMatches,
      score
    });

    // 8. Run structured qualitative job-fit analysis grounded in all structured contexts
    let analysis;
    try {
      analysis = await analyzeResumeJobFit(
        resumeText,
        trimmedJd,
        requirements,
        resumeProfile,
        skillMatches
      );
    } catch (aiError) {
      const rawMsg = aiError?.message || 'Failed to analyze resume against job description';
      const sanitizedMsg = rawMsg.replace(/gsk_[a-zA-Z0-9_-]+/g, '[REDACTED_API_KEY]');
      return res.status(500).json({
        success: false,
        error: sanitizedMsg
      });
    }

    // 9. Return complete response including deterministic score and recommendation
    return res.status(200).json({
      success: true,
      resumeProfile,
      requirements,
      skillMatches,
      score,
      recommendation,
      analysis
    });
  } catch (error) {
    const rawMsg = error?.message || 'An unexpected error occurred during analysis';
    const sanitizedMsg = rawMsg.replace(/gsk_[a-zA-Z0-9_-]+/g, '[REDACTED_API_KEY]');
    return res.status(500).json({
      success: false,
      error: sanitizedMsg
    });
  }
};
