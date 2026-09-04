/**
 * ResultsPreview — Candidate Fit Verdict & Summary (Milestone 13-C).
 * Answers immediately:
 * 1. How strong is my fit?
 * 2. Should I apply?
 * 3. Why did the system make that recommendation?
 * 4. What are my strongest areas?
 * 5. What should I look at next?
 */

import { createProgressBar } from './ProgressBar.js';
import { createBadge } from './Badge.js';
import { createButton } from './Button.js';
import { createDivider } from './Divider.js';
import { createSkillComparison } from './SkillComparison.js';

/**
 * Maps raw backend decision keys to human-readable labels and semantic variants.
 * @param {string} decision - 'apply' | 'apply_with_gaps' | 'low_fit'
 * @returns {{ text: string, variant: 'success' | 'warning' | 'error' }}
 */
function getRecommendationDisplay(decision) {
  switch (decision) {
    case 'apply':
      return { text: 'Strong fit', variant: 'success' };
    case 'apply_with_gaps':
      return { text: 'Apply with gaps', variant: 'warning' };
    case 'low_fit':
      return { text: 'Low fit', variant: 'error' };
    default:
      return {
        text: (decision || 'Evaluated').replace(/_/g, ' '),
        variant: 'default'
      };
  }
}

/**
 * Format score percentage safely handling null / undefined
 * @param {number|null|undefined} score
 * @returns {string}
 */
function formatPercentage(score) {
  if (typeof score === 'number' && !isNaN(score)) {
    return `${Math.round(score)}%`;
  }
  return '—';
}

/**
 * @param {Object} options
 * @param {Object} options.data - Full backend response from /api/analyze
 * @param {Function} options.onReset - Callback to return to input form
 * @returns {HTMLDivElement}
 */
export function createResultsPreview({ data, onReset } = {}) {
  const container = document.createElement('div');
  container.className = 'results-verdict';

  // --- 1. Top Navigation ---
  const nav = document.createElement('div');
  nav.className = 'results-verdict__nav';

  const backBtn = createButton({
    text: '← Analyze another role',
    variant: 'ghost',
    onClick: () => {
      if (onReset) onReset();
    }
  });
  backBtn.classList.add('results-verdict__back-btn');
  nav.appendChild(backBtn);
  container.appendChild(nav);

  // --- 2. Header Context ---
  const header = document.createElement('div');
  header.className = 'results-verdict__header';

  const eyebrow = document.createElement('span');
  eyebrow.className = 'results-verdict__eyebrow';
  eyebrow.textContent = 'Analysis complete';
  header.appendChild(eyebrow);

  const jobTitle = data?.requirements?.jobTitle;
  if (jobTitle) {
    const title = document.createElement('h1');
    title.className = 'results-verdict__role-title';
    title.textContent = jobTitle;
    header.appendChild(title);
  } else {
    const title = document.createElement('h1');
    title.className = 'results-verdict__role-title';
    title.textContent = 'Candidate Fit Verdict';
    header.appendChild(title);
  }

  container.appendChild(header);

  // --- 3. Verdict Card (Visual Anchor) ---
  const card = document.createElement('div');
  card.className = 'results-verdict__card';

  // Top Row: Score + Recommendation Badge
  const summary = document.createElement('div');
  summary.className = 'results-verdict__summary';

  const scoreGroup = document.createElement('div');
  scoreGroup.className = 'results-verdict__score-group';

  const scoreRow = document.createElement('div');
  scoreRow.className = 'results-verdict__score-row';

  const overallScore = typeof data?.score?.overall === 'number' ? data.score.overall : 0;

  const scoreNum = document.createElement('span');
  scoreNum.className = 'results-verdict__score-num';
  scoreNum.textContent = String(overallScore);

  const scoreMax = document.createElement('span');
  scoreMax.className = 'results-verdict__score-max';
  scoreMax.textContent = '/100';

  scoreRow.appendChild(scoreNum);
  scoreRow.appendChild(scoreMax);

  const scoreLabel = document.createElement('span');
  scoreLabel.className = 'results-verdict__score-label';
  scoreLabel.textContent = 'Overall fit';

  scoreGroup.appendChild(scoreRow);
  scoreGroup.appendChild(scoreLabel);

  const recDisplay = getRecommendationDisplay(data?.recommendation?.decision);
  const recBadge = createBadge({
    text: recDisplay.text,
    variant: recDisplay.variant,
    dot: true
  });

  summary.appendChild(scoreGroup);
  summary.appendChild(recBadge);
  card.appendChild(summary);

  // Recommendation Reason Text
  const reasonSection = document.createElement('div');
  reasonSection.className = 'results-verdict__reason-section';

  const reasonText = document.createElement('p');
  reasonText.className = 'results-verdict__reason-text';
  reasonText.textContent = data?.recommendation?.reason || 'Evaluation completed across role requirements.';

  reasonSection.appendChild(reasonText);
  card.appendChild(reasonSection);

  // Divider
  card.appendChild(createDivider('tight'));

  // Score Visualization & Breakdown
  const progressBar = createProgressBar({
    value: overallScore,
    max: 100,
    showValue: false
  });
  card.appendChild(progressBar.element);

  const breakdown = document.createElement('div');
  breakdown.className = 'results-verdict__breakdown';

  // Required skills row
  const reqRow = document.createElement('div');
  reqRow.className = 'results-verdict__breakdown-row';

  const reqLabel = document.createElement('span');
  reqLabel.className = 'results-verdict__breakdown-label';
  reqLabel.textContent = 'Required skills';

  const reqValue = document.createElement('span');
  reqValue.className = 'results-verdict__breakdown-value';
  reqValue.textContent = formatPercentage(data?.score?.requiredScore);

  reqRow.appendChild(reqLabel);
  reqRow.appendChild(reqValue);
  breakdown.appendChild(reqRow);

  // Preferred skills row
  const prefRow = document.createElement('div');
  prefRow.className = 'results-verdict__breakdown-row';

  const prefLabel = document.createElement('span');
  prefLabel.className = 'results-verdict__breakdown-label';
  prefLabel.textContent = 'Preferred skills';

  const prefValue = document.createElement('span');
  prefValue.className = 'results-verdict__breakdown-value';
  prefValue.textContent = formatPercentage(data?.score?.preferredScore);

  prefRow.appendChild(prefLabel);
  prefRow.appendChild(prefValue);
  breakdown.appendChild(prefRow);

  card.appendChild(breakdown);
  container.appendChild(card);

  // --- 4. Strengths Section ---
  const strengthsSection = document.createElement('div');
  strengthsSection.className = 'results-verdict__strengths-section';

  const strengthsTitle = document.createElement('h2');
  strengthsTitle.className = 'results-verdict__section-title';
  strengthsTitle.textContent = "What you're strong in";
  strengthsSection.appendChild(strengthsTitle);

  const strengthsList = Array.isArray(data?.recommendation?.strengths) ? data.recommendation.strengths : [];

  if (strengthsList.length > 0) {
    const chipsContainer = document.createElement('div');
    chipsContainer.className = 'results-verdict__chips-container';

    strengthsList.forEach((strength) => {
      const chip = document.createElement('span');
      chip.className = 'results-verdict__chip';
      chip.textContent = strength;
      chipsContainer.appendChild(chip);
    });

    strengthsSection.appendChild(chipsContainer);

    const supporting = document.createElement('p');
    supporting.className = 'results-verdict__strengths-supporting';
    supporting.textContent = 'These are skills the analysis identified as direct matches with the role requirements.';
    strengthsSection.appendChild(supporting);
  } else {
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'results-verdict__empty-strengths';
    emptyMsg.textContent = 'No direct matching strengths were identified for this role.';
    strengthsSection.appendChild(emptyMsg);
  }

  container.appendChild(strengthsSection);

  // --- 5. Skill-by-Skill Comparison Section ---
  const skillComparison = createSkillComparison({ data });
  container.appendChild(skillComparison);

  // --- 6. Continuation Cue (Priority gaps & learning roadmap) ---
  const continuation = document.createElement('div');
  continuation.className = 'results-verdict__continuation';

  const contContent = document.createElement('div');
  contContent.className = 'results-verdict__continuation-content';

  const contTitle = document.createElement('span');
  contTitle.className = 'results-verdict__continuation-title';
  contTitle.textContent = 'Next: Learning Roadmap';

  const contDesc = document.createElement('span');
  contDesc.className = 'results-verdict__continuation-desc';
  contDesc.textContent = 'Priority gap analysis and curated learning resources';

  contContent.appendChild(contTitle);
  contContent.appendChild(contDesc);

  const contBadge = document.createElement('span');
  contBadge.className = 'results-verdict__continuation-badge';
  contBadge.textContent = 'Coming next';

  continuation.appendChild(contContent);
  continuation.appendChild(contBadge);

  container.appendChild(continuation);

  return container;
}
