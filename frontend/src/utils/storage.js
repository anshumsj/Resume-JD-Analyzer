/**
 * storage.js — Client-side persistence and validation for JobFit analysis results.
 *
 * Provides safe, versioned localStorage persistence for completed analyses,
 * enabling full results restoration across page refreshes while defensively
 * handling corrupt, malformed, or unavailable storage.
 */

export const STORAGE_KEY = 'jobfit:analysis:v1';

/**
 * Validates that an object conforms to the expected 7-field analysis contract.
 *
 * @param {any} data
 * @returns {boolean}
 */
export function isValidAnalysisResult(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return false;
  }

  const hasResumeProfile =
    data.resumeProfile &&
    typeof data.resumeProfile === 'object' &&
    !Array.isArray(data.resumeProfile);

  const hasRequirements =
    data.requirements &&
    typeof data.requirements === 'object' &&
    !Array.isArray(data.requirements) &&
    Array.isArray(data.requirements.requiredSkills);

  const hasSkillMatches =
    data.skillMatches &&
    typeof data.skillMatches === 'object' &&
    !Array.isArray(data.skillMatches) &&
    Array.isArray(data.skillMatches.requirementMatches);

  const hasScore =
    data.score &&
    typeof data.score === 'object' &&
    !Array.isArray(data.score) &&
    typeof data.score.overall === 'number';

  const hasRecommendation =
    data.recommendation &&
    typeof data.recommendation === 'object' &&
    !Array.isArray(data.recommendation) &&
    typeof data.recommendation.decision === 'string';

  const hasLearningResources = Array.isArray(data.learningResources);

  const hasAnalysis =
    data.analysis &&
    typeof data.analysis === 'object' &&
    !Array.isArray(data.analysis);

  return Boolean(
    hasResumeProfile &&
    hasRequirements &&
    hasSkillMatches &&
    hasScore &&
    hasRecommendation &&
    hasLearningResources &&
    hasAnalysis
  );
}

/**
 * Persists a completed analysis result to localStorage.
 * Only the 7 core contract fields are saved; file objects and transient states are omitted.
 * Defensive against QuotaExceededError, security errors, and private-browsing restrictions.
 *
 * @param {Object} result - The successful response object from /api/analyze
 * @returns {boolean} True if saved successfully, false otherwise
 */
export function saveAnalysisResult(result) {
  if (!isValidAnalysisResult(result)) {
    console.warn('saveAnalysisResult: Provided data does not meet analysis contract. Skipping persistence.');
    return false;
  }

  try {
    const payload = {
      resumeProfile: result.resumeProfile,
      requirements: result.requirements,
      skillMatches: result.skillMatches,
      score: result.score,
      recommendation: result.recommendation,
      learningResources: result.learningResources,
      analysis: result.analysis,
      savedAt: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    // Storage quota exceeded, disabled storage, or private window restriction
    console.warn('saveAnalysisResult: Failed to write to localStorage:', err?.message || err);
    return false;
  }
}

/**
 * Loads and validates a previously saved analysis result from localStorage.
 * If data is absent, corrupt, or fails structural validation, the key is purged
 * and null is returned so the app cleanly renders the empty input form.
 *
 * @returns {Object|null} Valid analysis object or null
 */
export function loadAnalysisResult() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (isValidAnalysisResult(parsed)) {
      return parsed;
    }

    // Invalid structure: clean up poisoned storage entry
    console.warn('loadAnalysisResult: Stored analysis is malformed. Purging invalid storage entry.');
    clearAnalysisResult();
    return null;
  } catch (err) {
    // JSON parse error or storage access denied
    console.warn('loadAnalysisResult: Exception reading or parsing localStorage. Purging entry:', err?.message || err);
    clearAnalysisResult();
    return null;
  }
}

/**
 * Clears the persisted analysis result from localStorage.
 * Safe against environments where localStorage is restricted.
 *
 * @returns {boolean} True if cleared successfully
 */
export function clearAnalysisResult() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (err) {
    console.warn('clearAnalysisResult: Failed to remove item from localStorage:', err?.message || err);
    return false;
  }
}
