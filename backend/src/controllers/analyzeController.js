import { extractTextFromPdf } from '../services/resumeService.js';
import {
  extractResumeProfile,
  extractJobRequirements,
  analyzeResumeJobFit
} from '../services/aiService.js';

/**
 * Controller handling resume-to-job analysis requests.
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

    // 4. Extract structured resume profile using LLM + Zod
    let resumeProfile;
    try {
      resumeProfile = await extractResumeProfile(resumeText);
    } catch (profileError) {
      const rawMsg = profileError?.message || 'Failed to extract structured resume profile';
      const sanitizedMsg = rawMsg.replace(/gsk_[a-zA-Z0-9_-]+/g, '[REDACTED_API_KEY]');
      return res.status(500).json({
        success: false,
        error: sanitizedMsg
      });
    }

    // 5. Extract structured JD requirements using LLM + Zod
    let requirements;
    try {
      requirements = await extractJobRequirements(trimmedJd);
    } catch (reqError) {
      const rawMsg = reqError?.message || 'Failed to extract job requirements';
      const sanitizedMsg = rawMsg.replace(/gsk_[a-zA-Z0-9_-]+/g, '[REDACTED_API_KEY]');
      return res.status(500).json({
        success: false,
        error: sanitizedMsg
      });
    }

    // 6. Run structured job-fit analysis with extracted resume profile & JD requirements as context
    let analysis;
    try {
      analysis = await analyzeResumeJobFit(resumeText, trimmedJd, requirements, resumeProfile);
    } catch (aiError) {
      const rawMsg = aiError?.message || 'Failed to analyze resume against job description';
      const sanitizedMsg = rawMsg.replace(/gsk_[a-zA-Z0-9_-]+/g, '[REDACTED_API_KEY]');
      return res.status(500).json({
        success: false,
        error: sanitizedMsg
      });
    }

    // 7. Return successful structured response
    return res.status(200).json({
      success: true,
      resumeProfile,
      requirements,
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
