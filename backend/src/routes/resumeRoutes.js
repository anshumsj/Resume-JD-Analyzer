import express from 'express';
import multer from 'multer';
import { extractResume } from '../controllers/resumeController.js';

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();

// Filter to accept only PDF files
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB limit
  }
});

// Middleware to handle multer errors nicely
const uploadMiddleware = (req, res, next) => {
  const uploadSingle = upload.single('resume');
  uploadSingle(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, error: err.message });
    } else if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next();
  });
};

router.post('/extract', uploadMiddleware, extractResume);

export default router;
