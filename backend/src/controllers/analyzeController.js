import { extractTextFromPdf } from '../services/resumeService.js';
import { analyzeResumeJobFit } from '../services/aiService.js';

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

    // 4. Call AI service for LangChain + Groq analysis
    const analysis = await analyzeResumeJobFit(resumeText, jobDescription.trim());

    // 5. Return successful response
    return res.status(200).json({
      success: true,
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
