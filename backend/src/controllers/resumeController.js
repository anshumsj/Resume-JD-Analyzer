import { extractTextFromPdf } from '../services/resumeService.js';

export const extractResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Resume PDF is required'
      });
    }

    const text = await extractTextFromPdf(req.file.buffer);

    res.json({
      success: true,
      text: text
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
