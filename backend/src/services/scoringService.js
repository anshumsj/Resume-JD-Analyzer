/**
 * Deterministic Job-Fit Scoring Service
 *
 * Computes transparent, reproducible job-fit scores and recommendations based on:
 * 1. Semantic relationship classification (direct, partial, related, missing)
 * 2. Requirement category weighting (required vs preferred)
 */

export const RELATIONSHIP_SCORES = {
  direct: 1.0,
  partial: 0.6,
  related: 0.4,
  missing: 0.0
};

export const REQUIREMENT_WEIGHTS = {
  required: 1.0,
  preferred: 0.5
};

export const RECOMMENDATION_THRESHOLDS = {
  strong_fit: 80,
  good_fit: 65,
  moderate_fit: 50,
  low_fit: 0
};

/**
 * Maps a numeric overall score (0-100) to a deterministic recommendation.
 */
export const getRecommendation = (overallScore) => {
  if (overallScore >= 80) return 'strong_fit';
  if (overallScore >= 65) return 'good_fit';
  if (overallScore >= 50) return 'moderate_fit';
  return 'low_fit';
};

/**
 * Normalizes strings for robust, deterministic matching.
 * Trims whitespace, lowercases, strips standard punctuation, and collapses spaces.
 */
export const normalizeText = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/[\.\-_/\\,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Determines whether an M7 requirement belongs to required, preferred, or responsibility.
 * Avoids double-counting by strictly isolating skills from responsibilities.
 */
export const determineRequirementCategory = (
  jdReq,
  requiredSkills = [],
  preferredSkills = [],
  responsibilities = []
) => {
  const normReq = normalizeText(jdReq);
  if (!normReq) return 'unclassified';

  // 1. Exact normalized match against required skills
  for (const s of requiredSkills) {
    if (normalizeText(s) === normReq) return 'required';
  }

  // 2. Exact normalized match against preferred skills
  for (const s of preferredSkills) {
    if (normalizeText(s) === normReq) return 'preferred';
  }

  // 3. Exact normalized match against responsibilities
  for (const r of responsibilities) {
    if (normalizeText(r) === normReq) return 'responsibility';
  }

  // 4. Responsibility phrase detection (longer phrases matching duties)
  for (const r of responsibilities) {
    const normR = normalizeText(r);
    if (normR === normReq || (normReq.length > 25 && (normR.includes(normReq) || normReq.includes(normR)))) {
      return 'responsibility';
    }
  }

  // 5. Conservative substring match against required skills
  for (const s of requiredSkills) {
    const normS = normalizeText(s);
    if (normReq.includes(normS) || normS.includes(normReq)) return 'required';
  }

  // 6. Conservative substring match against preferred skills
  for (const s of preferredSkills) {
    const normS = normalizeText(s);
    if (normReq.includes(normS) || normS.includes(normReq)) return 'preferred';
  }

  return 'unclassified';
};

/**
 * Calculates deterministic job fit scores and produces an auditable breakdown.
 *
 * @param {Object} requirements - Structured JD requirements from M5
 * @param {Object} skillMatches - Semantic requirement comparisons from M7
 * @returns {Object} Deterministic score breakdown and recommendation
 */
export const calculateJobFitScore = (requirements = {}, skillMatches = {}) => {
  const requiredSkills = requirements?.requiredSkills || [];
  const preferredSkills = requirements?.preferredSkills || [];
  const responsibilities = requirements?.responsibilities || [];
  const matches = skillMatches?.requirementMatches || [];

  if (!Array.isArray(matches) || matches.length === 0) {
    return {
      overall: 0,
      requiredScore: null,
      preferredScore: null,
      recommendation: 'low_fit',
      breakdown: []
    };
  }

  const breakdown = [];
  let totalContribution = 0;
  let totalWeight = 0;

  let totalRequiredContribution = 0;
  let totalRequiredWeight = 0;

  let totalPreferredContribution = 0;
  let totalPreferredWeight = 0;

  for (const match of matches) {
    const category = determineRequirementCategory(
      match.jdRequirement,
      requiredSkills,
      preferredSkills,
      responsibilities
    );

    // Only score explicit skill requirements (required & preferred).
    // Responsibilities are excluded from weighted numerical scoring to prevent double counting.
    if (category !== 'required' && category !== 'preferred') {
      continue;
    }

    const relationship = match.relationship || 'missing';
    const relationshipScore = RELATIONSHIP_SCORES[relationship] ?? 0.0;
    const requirementWeight = REQUIREMENT_WEIGHTS[category] ?? 0.0;
    const contribution = parseFloat((relationshipScore * requirementWeight).toFixed(4));

    totalContribution += contribution;
    totalWeight += requirementWeight;

    if (category === 'required') {
      totalRequiredContribution += contribution;
      totalRequiredWeight += requirementWeight;
    } else if (category === 'preferred') {
      totalPreferredContribution += contribution;
      totalPreferredWeight += requirementWeight;
    }

    breakdown.push({
      requirement: match.jdRequirement,
      category,
      relationship,
      relationshipScore,
      requirementWeight,
      contribution,
      resumeEvidence: Array.isArray(match.resumeEvidence) ? match.resumeEvidence : []
    });
  }

  // Calculate overall weighted score (0 to 100)
  const overall = totalWeight > 0
    ? Math.round((totalContribution / totalWeight) * 100)
    : 0;

  // Calculate category-specific scores (avoid NaN and divide-by-zero)
  const requiredScore = totalRequiredWeight > 0
    ? parseFloat(((totalRequiredContribution / totalRequiredWeight) * 100).toFixed(2))
    : null;

  const preferredScore = totalPreferredWeight > 0
    ? parseFloat(((totalPreferredContribution / totalPreferredWeight) * 100).toFixed(2))
    : null;

  const recommendation = getRecommendation(overall);

  return {
    overall,
    requiredScore,
    preferredScore,
    recommendation,
    breakdown
  };
};
