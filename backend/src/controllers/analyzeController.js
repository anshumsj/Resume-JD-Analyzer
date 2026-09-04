
import { extractTextFromPdf } from '../services/resumeService.js';
import {
  extractResumeProfile,
  extractJobRequirements,
  compareResumeToRequirements,
  analyzeResumeJobFit
} from '../services/aiService.js';

/**
 * Controller handling resume-to-job analysis requests with semantic requirement comparison.
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

    // 6. Run structured job-fit analysis grounded in structured requirements, profile, and comparisons
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

    // 7. Return complete structured response
    return res.status(200).json({
      success: true,
      resumeProfile,
      requirements,
      skillMatches,
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
