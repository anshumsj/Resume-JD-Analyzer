/**
 * AnalyzePage — Page controller for JobFit AI.
 * Orchestrates form submission, API interaction, state persistence, and view transitions.
 */

import { createAnalysisForm } from '../components/AnalysisForm.js';
import { createResultsPreview } from '../components/ResultsPreview.js';
import { analyzeResume } from '../utils/api.js';
import {
  saveAnalysisResult,
  loadAnalysisResult,
  clearAnalysisResult
} from '../utils/storage.js';

export function createAnalyzePage() {
  const container = document.createElement('div');
  container.className = 'analyze-page';
  container.style.width = '100%';

  let currentResult = null;

  // Create form component
  const formComponent = createAnalysisForm({
    onSubmit: async ({ file, jobDescription }) => {
      formComponent.setLoading(true);

      try {
        const result = await analyzeResume(file, jobDescription);
        currentResult = result;

        // Persist to localStorage defensively (failure never blocks result display)
        saveAnalysisResult(result);

        showResults(result);
      } catch (err) {
        console.error('Analysis request failed:', err);
        const isInternalOrNetwork =
          !err?.message ||
          err.message.includes('{') ||
          err.message.includes('status 5') ||
          err.message.includes('fetch') ||
          err.message.includes('NetworkError');

        const message = isInternalOrNetwork
          ? 'Unable to complete analysis right now. Please try again. Your resume and job description are still here.'
          : err.message;

        formComponent.showError(message);
      }
    }
  });

  function showForm() {
    container.innerHTML = '';
    formComponent.reset();
    container.appendChild(formComponent.element);
  }

  function showResults(data) {
    container.innerHTML = '';
    const resultsView = createResultsPreview({
      data,
      onReset: () => {
        // Clear both localStorage and in-memory state
        clearAnalysisResult();
        currentResult = null;
        showForm();
      }
    });
    container.appendChild(resultsView);
  }

  // Check for previously persisted analysis result on initialization
  const savedResult = loadAnalysisResult();
  if (savedResult) {
    currentResult = savedResult;
    showResults(savedResult);
  } else {
    // Initial render: show the form
    showForm();
  }

  return {
    element: container,
    getResult: () => currentResult
  };
}
