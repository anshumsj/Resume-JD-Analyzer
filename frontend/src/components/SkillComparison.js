/**
 * SkillComparison — Requirement-by-requirement semantic matching (Milestone 13-D).
 * Renders structured comparison items for Required and Preferred skills,
 * highlighting direct, related, partial, and missing evidence.
 */

import { createBadge } from './Badge.js';

/**
 * Maps raw relationship string to user-facing badge configuration.
 * @param {string} rel - 'direct' | 'related' | 'partial' | 'missing'
 * @returns {{ text: string, variant: string }}
 */
function getRelationshipBadge(rel) {
  switch (rel) {
    case 'direct':
      return { text: 'Direct', variant: 'direct' };
    case 'related':
      return { text: 'Related', variant: 'related' };
    case 'partial':
      return { text: 'Partial', variant: 'partial' };
    case 'missing':
      return { text: 'Missing', variant: 'missing' };
    default:
      return {
        text: (rel || 'Unknown').charAt(0).toUpperCase() + (rel || 'unknown').slice(1),
        variant: 'default'
      };
  }
}

/**
 * Creates a single comparison item card.
 * @param {Object} match
 * @param {string} match.jdRequirement
 * @param {string[]} match.resumeEvidence
 * @param {string} match.relationship
 * @returns {HTMLDivElement}
 */
function createComparisonCard(match) {
  const card = document.createElement('div');
  card.className = 'skill-comparison__card';

  // --- Top Row: Requirement Name + Relationship Badge ---
  const header = document.createElement('div');
  header.className = 'skill-comparison__card-header';

  const name = document.createElement('span');
  name.className = 'skill-comparison__req-name';
  name.textContent = match.jdRequirement;

  const badgeConfig = getRelationshipBadge(match.relationship);
  const badge = createBadge({
    text: badgeConfig.text,
    variant: badgeConfig.variant,
    dot: false
  });

  header.appendChild(name);
  header.appendChild(badge);
  card.appendChild(header);

  // --- Middle Row: Resume Evidence ---
  const evidenceBlock = document.createElement('div');
  evidenceBlock.className = 'skill-comparison__evidence-block';

  const evidenceLabel = document.createElement('span');
  evidenceLabel.className = 'skill-comparison__evidence-label';
  evidenceLabel.textContent = 'Resume evidence';

  evidenceBlock.appendChild(evidenceLabel);

  const evidenceList = Array.isArray(match.resumeEvidence) ? match.resumeEvidence : [];

  if (evidenceList.length > 0) {
    const evidenceContent = document.createElement('span');
    evidenceContent.className = 'skill-comparison__evidence-content';
    evidenceContent.textContent = evidenceList.join(' · ');
    evidenceBlock.appendChild(evidenceContent);
  } else {
    const evidenceEmpty = document.createElement('span');
    evidenceEmpty.className = 'skill-comparison__evidence-empty';
    evidenceEmpty.textContent = 'No explicit resume evidence';
    evidenceBlock.appendChild(evidenceEmpty);
  }

  card.appendChild(evidenceBlock);

  // --- Nuance line for related and partial matches ---
  if (match.relationship === 'related') {
    const nuance = document.createElement('div');
    nuance.className = 'skill-comparison__nuance';
    nuance.textContent = 'Related experience may transfer, but direct experience is not shown.';
    card.appendChild(nuance);
  } else if (match.relationship === 'partial') {
    const nuance = document.createElement('div');
    nuance.className = 'skill-comparison__nuance';
    nuance.textContent = 'Some relevant experience is present, but deeper experience is not demonstrated.';
    card.appendChild(nuance);
  }

  return card;
}

/**
 * Creates the complete Skill Comparison section.
 * @param {Object} options
 * @param {Object} options.data - Full analysis response
 * @returns {HTMLElement}
 */
export function createSkillComparison({ data } = {}) {
  const container = document.createElement('section');
  container.className = 'skill-comparison';
  container.setAttribute('aria-labelledby', 'skill-comparison-title');

  // --- Section Header ---
  const header = document.createElement('div');
  header.className = 'skill-comparison__header';

  const title = document.createElement('h2');
  title.id = 'skill-comparison-title';
  title.className = 'skill-comparison__title';
  title.textContent = 'Skill comparison';

  const subtitle = document.createElement('p');
  subtitle.className = 'skill-comparison__subtitle';
  subtitle.textContent = 'See how each role requirement maps to your resume.';

  header.appendChild(title);
  header.appendChild(subtitle);
  container.appendChild(header);

  const matches = data?.skillMatches?.requirementMatches || [];

  if (!Array.isArray(matches) || matches.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'skill-comparison__empty';

    const emptyTitle = document.createElement('span');
    emptyTitle.className = 'skill-comparison__empty-title';
    emptyTitle.textContent = 'No skill comparisons available.';

    const emptyDesc = document.createElement('span');
    emptyDesc.className = 'skill-comparison__empty-desc';
    emptyDesc.textContent = 'The analysis did not return any structured skill requirements.';

    emptyState.appendChild(emptyTitle);
    emptyState.appendChild(emptyDesc);
    container.appendChild(emptyState);
    return container;
  }

  // --- Grouping into Required vs Preferred ---
  const breakdown = data?.score?.breakdown || [];
  const preferredSkills = (data?.requirements?.preferredSkills || []).map((s) => s.toLowerCase());

  const requiredMatches = [];
  const preferredMatches = [];

  matches.forEach((match) => {
    const reqLower = (match.jdRequirement || '').toLowerCase();

    // Check if score.breakdown classifies it as preferred
    const breakdownItem = breakdown.find(
      (b) => (b.requirement || '').toLowerCase() === reqLower
    );

    let isPreferred = false;

    if (breakdownItem && breakdownItem.category === 'preferred') {
      isPreferred = true;
    } else if (preferredSkills.some((p) => p === reqLower || reqLower.includes(p) || p.includes(reqLower))) {
      isPreferred = true;
    }

    if (isPreferred) {
      preferredMatches.push(match);
    } else {
      requiredMatches.push(match);
    }
  });

  // --- 1. Required Skills Group ---
  if (requiredMatches.length > 0) {
    const reqGroup = document.createElement('div');
    reqGroup.className = 'skill-comparison__group';

    const reqGroupHeader = document.createElement('div');
    reqGroupHeader.className = 'skill-comparison__group-header';

    const reqGroupTitle = document.createElement('h3');
    reqGroupTitle.className = 'skill-comparison__group-title';
    reqGroupTitle.textContent = 'Required skills';

    const reqCount = document.createElement('span');
    reqCount.className = 'skill-comparison__group-count';
    reqCount.textContent = `${requiredMatches.length} requirement${requiredMatches.length === 1 ? '' : 's'}`;

    reqGroupHeader.appendChild(reqGroupTitle);
    reqGroupHeader.appendChild(reqCount);
    reqGroup.appendChild(reqGroupHeader);

    const reqList = document.createElement('div');
    reqList.className = 'skill-comparison__list';

    requiredMatches.forEach((match) => {
      reqList.appendChild(createComparisonCard(match));
    });

    reqGroup.appendChild(reqList);
    container.appendChild(reqGroup);
  }

  // --- 2. Preferred Skills Group ---
  if (preferredMatches.length > 0) {
    const prefGroup = document.createElement('div');
    prefGroup.className = 'skill-comparison__group';

    const prefGroupHeader = document.createElement('div');
    prefGroupHeader.className = 'skill-comparison__group-header';

    const prefGroupTitle = document.createElement('h3');
    prefGroupTitle.className = 'skill-comparison__group-title';
    prefGroupTitle.textContent = 'Preferred skills';

    const prefCount = document.createElement('span');
    prefCount.className = 'skill-comparison__group-count';
    prefCount.textContent = `${preferredMatches.length} requirement${preferredMatches.length === 1 ? '' : 's'}`;

    prefGroupHeader.appendChild(prefGroupTitle);
    prefGroupHeader.appendChild(prefCount);
    prefGroup.appendChild(prefGroupHeader);

    const prefList = document.createElement('div');
    prefList.className = 'skill-comparison__list';

    preferredMatches.forEach((match) => {
      prefList.appendChild(createComparisonCard(match));
    });

    prefGroup.appendChild(prefList);
    container.appendChild(prefGroup);
  }

  return container;
}
