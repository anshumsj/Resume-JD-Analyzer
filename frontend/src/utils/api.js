/**
 * API Client — thin wrapper for backend communication.
 * Uses the Vite dev proxy (/api → http://localhost:8000) in development.
 */

const API_BASE = '/api';

/**
 * Check backend health.
 * @returns {Promise<{status: string, service: string}>}
 */
export async function checkHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

/**
 * Submit resume PDF and job description for analysis.
 * @param {File} resumeFile - PDF file
 * @param {string} jobDescription - Job description text
 * @returns {Promise<Object>} - Full analysis response
 */
export async function analyzeResume(resumeFile, jobDescription) {
  const formData = new FormData();
  formData.append('resume', resumeFile);
  formData.append('jobDescription', jobDescription);

  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    body: formData
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.error || `Analysis failed with status ${res.status}`);
  }

  return data;
}
