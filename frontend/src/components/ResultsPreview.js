/**
 * ResultsPreview — clean placeholder view for successful analysis results.
 * Stores the full 7-field response and provides return action for M13-C expansion.
 */

import { createProgressBar } from './ProgressBar.js';
import { createBadge } from './Badge.js';
import { createButton } from './Button.js';
import { createDivider } from './Divider.js';

/**
 * @param {Object} options
 * @param {Object} options.data - Full backend response from /api/analyze
 * @param {Function} options.onReset - Callback to return to input form
 * @returns {HTMLDivElement}
 */
export function createResultsPreview({ data, onReset } = {}) {
  const container = document.createElement('div');
  container.className = 'results-preview';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = 'var(--space-6)';
  container.style.width = '100%';

  // --- Top Navigation / Back Action ---
  const topNav = document.createElement('div');
  topNav.style.display = 'flex';
  topNav.style.alignItems = 'center';
  topNav.style.justifyContent = 'space-between';

  const backBtn = createButton({
    text: '← Analyze another role',
    variant: 'ghost',
    onClick: () => {
      if (onReset) onReset();
    }
  });
  backBtn.style.paddingLeft = '0';
  topNav.appendChild(backBtn);

  const statusBadge = createBadge({
    text: 'Analysis Complete',
    variant: 'success',
    dot: true
  });
  topNav.appendChild(statusBadge);
  container.appendChild(topNav);

  // --- Header Summary ---
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.flexDirection = 'column';
  header.style.gap = 'var(--space-1)';

  const title = document.createElement('h1');
  title.className = 'analysis-form__title';
  const roleTitle = data?.requirements?.jobTitle || 'Role Alignment';
  title.textContent = `${roleTitle} Fit Assessment`;

  const desc = document.createElement('p');
  desc.className = 'analysis-form__subtitle';
  desc.textContent = data?.recommendation?.reason || 'Evaluation completed across all extracted requirements.';

  header.appendChild(title);
  header.appendChild(desc);
  container.appendChild(header);

  container.appendChild(createDivider());

  // --- Score & Recommendation Row ---
  const scoreCard = document.createElement('div');
  scoreCard.style.display = 'flex';
  scoreCard.style.flexDirection = 'column';
  scoreCard.style.gap = 'var(--space-4)';
  scoreCard.style.padding = 'var(--space-5)';
  scoreCard.style.background = 'var(--color-surface)';
  scoreCard.style.border = '1px solid var(--color-border)';
  scoreCard.style.borderRadius = 'var(--radius-md)';

  const scoreHeader = document.createElement('div');
  scoreHeader.style.display = 'flex';
  scoreHeader.style.alignItems = 'center';
  scoreHeader.style.justifyContent = 'space-between';

  const scoreTitle = document.createElement('span');
  scoreTitle.style.fontSize = 'var(--text-sm)';
  scoreTitle.style.fontWeight = 'var(--font-semibold)';
  scoreTitle.style.color = 'var(--color-text)';
  scoreTitle.textContent = 'Overall Fit Score';

  const decisionBadge = createBadge({
    text: (data?.recommendation?.decision || 'evaluated').toUpperCase().replace(/_/g, ' '),
    variant: data?.recommendation?.decision === 'apply' ? 'success' :
             data?.recommendation?.decision === 'apply_with_gaps' ? 'warning' : 'default'
  });

  scoreHeader.appendChild(scoreTitle);
  scoreHeader.appendChild(decisionBadge);
  scoreCard.appendChild(scoreHeader);

  const overallScore = typeof data?.score?.overall === 'number' ? data.score.overall : 0;
  const progressBar = createProgressBar({
    value: overallScore,
    max: 100,
    showValue: true
  });
  scoreCard.appendChild(progressBar.element);

  container.appendChild(scoreCard);

  // --- Key Strengths Preview ---
  if (Array.isArray(data?.recommendation?.strengths) && data.recommendation.strengths.length > 0) {
    const strengthsSection = document.createElement('div');
    strengthsSection.style.display = 'flex';
    strengthsSection.style.flexDirection = 'column';
    strengthsSection.style.gap = 'var(--space-2)';

    const strengthsTitle = document.createElement('h3');
    strengthsTitle.style.fontSize = 'var(--text-sm)';
    strengthsTitle.style.fontWeight = 'var(--font-medium)';
    strengthsTitle.style.color = 'var(--color-text)';
    strengthsTitle.textContent = 'Candidate Strengths';

    const badgesContainer = document.createElement('div');
    badgesContainer.style.display = 'flex';
    badgesContainer.style.flexWrap = 'wrap';
    badgesContainer.style.gap = 'var(--space-2)';

    data.recommendation.strengths.forEach((strength) => {
      const badge = createBadge({ text: strength, variant: 'default' });
      badgesContainer.appendChild(badge);
    });

    strengthsSection.appendChild(strengthsTitle);
    strengthsSection.appendChild(badgesContainer);
    container.appendChild(strengthsSection);
  }

  // --- Data Preservation Note ---
  const note = document.createElement('p');
  note.style.fontSize = 'var(--text-xs)';
  note.style.color = 'var(--color-text-muted)';
  note.style.marginTop = 'var(--space-4)';
  note.textContent = `Full analysis response preserved in application state (${data?.skillMatches?.requirementMatches?.length || 0} requirements evaluated, ${data?.learningResources?.length || 0} resource skills enriched). Ready for M13-C dashboard.`;
  container.appendChild(note);

  return container;
}
