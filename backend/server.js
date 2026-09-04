import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Configure dotenv
dotenv.config();

const app = express();

// Enable JSON parsing and CORS
app.use(cors());
app.use(express.json());

// Simple health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'jobfit-ai'
  });
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
