/**
 * LearningRoadmap — Priority gap learning roadmap with curated resources (Milestone 13-E).
 * Answers: "I have gaps. What should I learn, in what order, and where can I learn it?"
 */

import { createBadge } from './Badge.js';

/**
 * Extracts clean domain name from URL if source is missing
 * @param {string} url
 * @returns {string}
 */
function extractDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Maps roadmap priority to semantic badge configuration.
 * @param {string} priority - 'high' | 'medium' | 'low'
 * @returns {{ text: string, variant: string }}
 */
function getPriorityBadge(priority) {
  switch ((priority || '').toLowerCase()) {
    case 'high':
      return { text: 'High priority', variant: 'missing' };
    case 'medium':
      return { text: 'Medium priority', variant: 'related' };
    case 'low':
      return { text: 'Low priority', variant: 'default' };
    default:
      return {
        text: `${priority || 'Normal'} priority`,
        variant: 'default'
      };
  }
}

/**
 * Formats category label
 * @param {string} category - 'required' | 'preferred'
 * @returns {string}
 */
function formatCategoryLabel(category) {
  if (category === 'required') return 'Required · Skill gap';
  if (category === 'preferred') return 'Preferred · Skill gap';
  return 'Skill gap';
}

/**
 * Creates a single roadmap item card with matching resources.
 * @param {Object} item - Roadmap item { skill, priority, category, reason }
 * @param {number} index - 0-indexed position
 * @param {Array} learningResources - Full resources list from API
 * @returns {HTMLDivElement}
 */
function createRoadmapCard(item, index, learningResources = []) {
  const card = document.createElement('div');
  card.className = 'learning-roadmap__card';

  // --- Top Row: Index + Skill Name + Priority Badge ---
  const topRow = document.createElement('div');
  topRow.className = 'learning-roadmap__card-top';

  const cardInfo = document.createElement('div');
  cardInfo.className = 'learning-roadmap__card-info';

  const stepNum = document.createElement('span');
  stepNum.className = 'learning-roadmap__step-num';
  stepNum.textContent = String(index + 1).padStart(2, '0');

  const skillBlock = document.createElement('div');
  skillBlock.className = 'learning-roadmap__skill-block';

  const skillName = document.createElement('span');
  skillName.className = 'learning-roadmap__skill-name';
  skillName.textContent = item.skill || 'Unnamed requirement';

  const skillMeta = document.createElement('span');
  skillMeta.className = 'learning-roadmap__skill-meta';
  skillMeta.textContent = formatCategoryLabel(item.category);

  skillBlock.appendChild(skillName);
  skillBlock.appendChild(skillMeta);

  cardInfo.appendChild(stepNum);
  cardInfo.appendChild(skillBlock);

  const badgeConfig = getPriorityBadge(item.priority);
  const badge = createBadge({
    text: badgeConfig.text,
    variant: badgeConfig.variant,
    dot: false
  });

  topRow.appendChild(cardInfo);
  topRow.appendChild(badge);
  card.appendChild(topRow);

  // --- Reason Paragraph ---
  if (item.reason) {
    const reason = document.createElement('p');
    reason.className = 'learning-roadmap__reason';
    reason.textContent = item.reason;
    card.appendChild(reason);
  }

  // --- Matching Learning Resources ---
  const resourcesBlock = document.createElement('div');
  resourcesBlock.className = 'learning-roadmap__resources-block';

  const resourcesLabel = document.createElement('span');
  resourcesLabel.className = 'learning-roadmap__resources-label';
  resourcesLabel.textContent = 'Learn from';
  resourcesBlock.appendChild(resourcesLabel);

  // Find matching resources entry for this skill
  const skillLower = (item.skill || '').toLowerCase().trim();
  const matchedEntry = learningResources.find(
    (entry) => (entry?.skill || '').toLowerCase().trim() === skillLower
  );

  const rawResources = Array.isArray(matchedEntry?.resources) ? matchedEntry.resources : [];
  const validResources = rawResources.filter((r) => r && (r.url || r.title));

  if (validResources.length > 0) {
    const resourceList = document.createElement('div');
    resourceList.className = 'learning-roadmap__resource-list';

    validResources.forEach((res) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'learning-roadmap__resource-item';

      const link = document.createElement('a');
      link.className = 'learning-roadmap__resource-link';
      link.href = res.url || '#';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = res.title || 'Official learning resource';

      const arrow = document.createElement('span');
      arrow.className = 'learning-roadmap__link-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '↗';
      link.appendChild(arrow);

      itemEl.appendChild(link);

      const sourceText = res.source || extractDomain(res.url);
      if (sourceText) {
        const sourceEl = document.createElement('span');
        sourceEl.className = 'learning-roadmap__resource-source';
        sourceEl.textContent = sourceText;
        itemEl.appendChild(sourceEl);
      }

      resourceList.appendChild(itemEl);
    });

    resourcesBlock.appendChild(resourceList);
  } else {
    const emptyMsg = document.createElement('span');
    emptyMsg.className = 'learning-roadmap__resource-empty';
    emptyMsg.textContent = 'No curated resources were available for this skill.';
    resourcesBlock.appendChild(emptyMsg);
  }

  card.appendChild(resourcesBlock);

  return card;
}

/**
 * Creates the complete Learning Roadmap section.
 * @param {Object} options
 * @param {Object} options.data - Full analysis response
 * @returns {HTMLElement}
 */
export function createLearningRoadmap({ data } = {}) {
  const container = document.createElement('section');
  container.className = 'learning-roadmap';
  container.setAttribute('aria-labelledby', 'learning-roadmap-title');

  // --- Section Header ---
  const header = document.createElement('div');
  header.className = 'learning-roadmap__header';

  const title = document.createElement('h2');
  title.id = 'learning-roadmap-title';
  title.className = 'learning-roadmap__title';
  title.textContent = 'Learning roadmap';

  const subtitle = document.createElement('p');
  subtitle.className = 'learning-roadmap__subtitle';
  subtitle.textContent = 'A focused path for closing the gaps identified in this role.';

  header.appendChild(title);
  header.appendChild(subtitle);
  container.appendChild(header);

  const roadmap = data?.recommendation?.learningRoadmap || [];
  const learningResources = data?.learningResources || [];

  // --- Empty State: No Gaps ---
  if (!Array.isArray(roadmap) || roadmap.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'learning-roadmap__empty';

    const emptyTitle = document.createElement('span');
    emptyTitle.className = 'learning-roadmap__empty-title';
    emptyTitle.textContent = 'No immediate skill gaps were identified.';

    const emptyDesc = document.createElement('span');
    emptyDesc.className = 'learning-roadmap__empty-desc';
    emptyDesc.textContent = 'Your resume directly matches the requirements returned by the analysis.';

    emptyState.appendChild(emptyTitle);
    emptyState.appendChild(emptyDesc);
    container.appendChild(emptyState);
    return container;
  }

  // --- Render Roadmap Items in Order ---
  const list = document.createElement('div');
  list.className = 'learning-roadmap__list';

  roadmap.forEach((item, index) => {
    list.appendChild(createRoadmapCard(item, index, learningResources));
  });

  container.appendChild(list);

  return container;
}
