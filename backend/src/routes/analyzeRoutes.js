import express from 'express';
import { uploadResumeMiddleware } from '../utils/multerConfig.js';
import { analyzeJobFit } from '../controllers/analyzeController.js';

const router = express.Router();

// POST /api/analyze
router.post('/', uploadResumeMiddleware, analyzeJobFit);

export default router;
