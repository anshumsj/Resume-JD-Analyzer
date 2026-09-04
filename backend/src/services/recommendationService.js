/**
 * Deterministic Candidate Recommendation and Learning Roadmap Service
 *
 * Consumes structured M5 requirements, M7 semantic skill matches, and M8 score breakdown
 * to generate:
 * 1. Application decision (apply | apply_with_gaps | low_fit)
 * 2. Grounded reasoning for the decision
 * 3. Primary strengths (direct skill matches)
 * 4. Prioritized skill gaps (required prioritized over preferred; distinguishing related from missing)
 * 5. Deterministic learning roadmap with actionable priorities and reasons
 */

import { calculateJobFitScore, determineRequirementCategory } from './scoringService.js';
import { RecommendationSchema } from '../utils/recommendationSchema.js';

export const DECISION_TYPES = {
  APPLY: 'apply',
  APPLY_WITH_GAPS: 'apply_with_gaps',
  LOW_FIT: 'low_fit'
};

export const RECOMMENDATION_THRESHOLDS = {
  APPLY_MIN_OVERALL: 80,
  APPLY_MIN_REQUIRED: 80,
  APPLY_MAX_REQUIRED_GAPS: 0,
  APPLY_MAX_TOTAL_GAPS: 1,
  APPLY_WITH_GAPS_MIN_OVERALL: 50,
  APPLY_WITH_GAPS_MIN_REQUIRED: 50
};

export const ROADMAP_PRIORITY_MATRIX = {
  required: {
    missing: 'high',
    partial: 'high',
    related: 'medium'
  },
  preferred: {
    missing: 'medium',
    partial: 'low',
    related: 'low'
  }
};

const CATEGORY_PRIORITY = { required: 0, preferred: 1 };
const RELATIONSHIP_SEVERITY = { missing: 0, partial: 1, related: 2 };

/**
 * Generates an explainable reason for a learning roadmap item grounded in JD requirements & evidence.
 */
export const generateLearningReason = (gap) => {
  const { skill, category, relationship, resumeEvidence } = gap;
  const isReq = category === 'required';
  const rolePrefix = isReq ? 'required by the job description' : 'listed as a preferred skill';
  const evidenceList = Array.isArray(resumeEvidence) ? resumeEvidence.filter(Boolean) : [];

  if (relationship === 'missing') {
    return `${skill} is ${rolePrefix}, and there is no explicit ${skill} evidence in the resume.`;
  }

  if (relationship === 'related') {
    const evidenceStr = evidenceList.length > 0 ? evidenceList.join('/') : 'transferable skills';
    return `${skill} is ${rolePrefix}. The candidate has related ${evidenceStr} experience with transferable concepts, but lacks direct ${skill} experience.`;
  }

  if (relationship === 'partial') {
    const evidenceStr = evidenceList.length > 0 ? evidenceList.join(', ') : 'foundational exposure';
    return `${skill} is ${rolePrefix}. The candidate demonstrated partial experience (${evidenceStr}), but requires deeper practical expertise.`;
  }

  return `${skill} is ${rolePrefix}.`;
};

/**
 * Formulates the decision reason based on decision type, strengths, and priority gaps.
 */
export const determineDecisionReason = (
  decision,
  overallScore,
  requiredScore,
  strengths = [],
  priorityGaps = []
) => {
  const topStrengths = strengths.slice(0, 4).join(', ');
  const gapSkills = priorityGaps.map(g => g.skill).slice(0, 3).join(', ');

  if (decision === DECISION_TYPES.APPLY) {
    if (priorityGaps.length === 0) {
      return `The candidate demonstrates strong, comprehensive alignment across all evaluated requirements (${strengths.length} direct matches) with no identified skill gaps.`;
    }
    return `The candidate demonstrates strong alignment across core requirements (${topStrengths || strengths.length + ' matches'}) with minimal minor gaps.`;
  }

  if (decision === DECISION_TYPES.APPLY_WITH_GAPS) {
    const strengthClause = topStrengths
      ? `solid core strengths in ${topStrengths}`
      : 'moderate overall alignment';
    const gapClause = gapSkills
      ? `notable skill gaps in ${gapSkills}`
      : 'some unverified requirements';
    return `The candidate has ${strengthClause}, but presents ${gapClause}.`;
  }

  // LOW_FIT
  const reqGaps = priorityGaps
    .filter(g => g.category === 'required')
    .map(g => g.skill)
    .slice(0, 3)
    .join(', ');
  const deficiencyClause = reqGaps
    ? `critical required skills (${reqGaps})`
    : 'essential role requirements';
  return `The candidate has major deficiencies in ${deficiencyClause} and does not meet the baseline qualifications for this role.`;
};

/**
 * Determines whether the candidate should apply, apply with gaps, or is a low fit.
 */
export const determineDecision = (overallScore = 0, requiredScore = null, priorityGaps = []) => {
  const effectiveRequiredScore = requiredScore !== null && requiredScore !== undefined
    ? requiredScore
    : overallScore;

  // 1. Weak overall alignment or major required skill deficiency
  if (
    overallScore < RECOMMENDATION_THRESHOLDS.APPLY_WITH_GAPS_MIN_OVERALL ||
    effectiveRequiredScore < RECOMMENDATION_THRESHOLDS.APPLY_WITH_GAPS_MIN_REQUIRED
  ) {
    return DECISION_TYPES.LOW_FIT;
  }

  const requiredGaps = priorityGaps.filter(g => g.category === 'required');
  const missingRequiredCount = requiredGaps.filter(g => g.relationship === 'missing').length;

  // Candidate with completely missing required skills cannot receive a flat 'apply'
  if (missingRequiredCount > 0) {
    return DECISION_TYPES.APPLY_WITH_GAPS;
  }

  // 2. Strong candidate evaluation:
  // Must meet high overall and required thresholds, have no required skill gaps,
  // and at most 1 minor gap overall.
  if (
    overallScore >= RECOMMENDATION_THRESHOLDS.APPLY_MIN_OVERALL &&
    effectiveRequiredScore >= RECOMMENDATION_THRESHOLDS.APPLY_MIN_REQUIRED &&
    requiredGaps.length <= RECOMMENDATION_THRESHOLDS.APPLY_MAX_REQUIRED_GAPS &&
    priorityGaps.length <= RECOMMENDATION_THRESHOLDS.APPLY_MAX_TOTAL_GAPS
  ) {
    return DECISION_TYPES.APPLY;
  }

  // 3. Reasonable overall alignment but with meaningful required/preferred gaps
  return DECISION_TYPES.APPLY_WITH_GAPS;
};

/**
 * Normalizes input objects and extracts evaluated skill items (excluding responsibilities).
 */
const extractEvaluatedItems = (requirements = {}, skillMatches = {}, score = {}) => {
  // If score breakdown is already available, use its categorized skill items
  if (Array.isArray(score?.breakdown) && score.breakdown.length > 0) {
    return score.breakdown.map(b => ({
      skill: b.requirement,
      category: b.category,
      relationship: b.relationship,
      resumeEvidence: Array.isArray(b.resumeEvidence) ? b.resumeEvidence : []
    }));
  }

  // Otherwise, categorize matches using structured requirements
  const requiredSkills = requirements?.requiredSkills || [];
  const preferredSkills = requirements?.preferredSkills || [];
  const responsibilities = requirements?.responsibilities || [];
  const matches = skillMatches?.requirementMatches || [];

  const items = [];
  for (const match of matches) {
    const category = determineRequirementCategory(
      match.jdRequirement,
      requiredSkills,
      preferredSkills,
      responsibilities
    );

    // Filter out responsibilities so we strictly analyze skills
    if (category === 'required' || category === 'preferred') {
      items.push({
        skill: match.jdRequirement,
        category,
        relationship: match.relationship || 'missing',
        resumeEvidence: Array.isArray(match.resumeEvidence) ? match.resumeEvidence : []
      });
    }
  }

  return items;
};

/**
 * Main deterministic recommendation generator.
 *
 * @param {Object} params - Object containing requirements, skillMatches, and score
 * @returns {Object} Validated recommendation object
 */
export const generateCandidateRecommendation = (
  requirementsOrParams = {},
  maybeSkillMatches = {},
  maybeScore = {}
) => {
  let requirements;
  let skillMatches;
  let score;

  if (
    requirementsOrParams?.requirements !== undefined ||
    requirementsOrParams?.skillMatches !== undefined ||
    requirementsOrParams?.score !== undefined
  ) {
    requirements = requirementsOrParams.requirements || {};
    skillMatches = requirementsOrParams.skillMatches || {};
    score = requirementsOrParams.score || {};
  } else {
    requirements = requirementsOrParams || {};
    skillMatches = maybeSkillMatches || {};
    score = maybeScore || {};
  }

  // If score was not pre-computed, calculate it deterministically
  if (typeof score?.overall !== 'number') {
    score = calculateJobFitScore(requirements, skillMatches);
  }

  const evaluatedItems = extractEvaluatedItems(requirements, skillMatches, score);

  // 1. Identify Strengths (direct matches only; deduplicated)
  const strengthSet = new Set();
  for (const item of evaluatedItems) {
    if (item.relationship === 'direct') {
      strengthSet.add(item.skill);
    }
  }
  const strengths = Array.from(strengthSet);

  // 2. Identify Priority Gaps (non-direct matches, prioritized by required > preferred and missing > partial > related)
  const rawGaps = evaluatedItems
    .filter(item => item.relationship !== 'direct')
    .map(item => ({
      skill: item.skill,
      category: item.category,
      relationship: item.relationship,
      resumeEvidence: item.resumeEvidence
    }));

  const priorityGaps = [...rawGaps].sort((a, b) => {
    const catDiff = (CATEGORY_PRIORITY[a.category] ?? 99) - (CATEGORY_PRIORITY[b.category] ?? 99);
    if (catDiff !== 0) return catDiff;
    return (RELATIONSHIP_SEVERITY[a.relationship] ?? 99) - (RELATIONSHIP_SEVERITY[b.relationship] ?? 99);
  });

  // 3. Generate Learning Roadmap (only for gaps; never for direct matches)
  const learningRoadmap = priorityGaps.map(gap => ({
    skill: gap.skill,
    priority: ROADMAP_PRIORITY_MATRIX[gap.category]?.[gap.relationship] || 'medium',
    category: gap.category,
    reason: generateLearningReason(gap)
  }));

  // 4. Determine Application Decision & Grounded Reason
  const overallScore = typeof score?.overall === 'number' ? score.overall : 0;
  const requiredScore = typeof score?.requiredScore === 'number' ? score.requiredScore : null;

  const decision = determineDecision(overallScore, requiredScore, priorityGaps);
  const reason = determineDecisionReason(decision, overallScore, requiredScore, strengths, priorityGaps);

  const result = {
    decision,
    reason,
    strengths,
    priorityGaps,
    learningRoadmap
  };

  return RecommendationSchema.parse(result);
};
