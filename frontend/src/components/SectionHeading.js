/**
 * SectionHeading — consistent section header with optional description.
 *
 * Usage:
 *   import { createSectionHeading } from './components/SectionHeading.js';
 *   const heading = createSectionHeading({ title: 'Skills', description: 'Matched requirements' });
 */

/**
 * @param {Object} options
 * @param {string} options.title
 * @param {string} [options.description]
 * @param {'h2'|'h3'|'h4'} [options.level='h2']
 * @returns {HTMLDivElement}
 */
export function createSectionHeading({ title, description, level = 'h2' } = {}) {
  const container = document.createElement('div');
  container.className = 'section-heading';

  const titleEl = document.createElement(level);
  titleEl.className = 'section-heading__title';
  titleEl.textContent = title;
  container.appendChild(titleEl);

  if (description) {
    const descEl = document.createElement('p');
    descEl.className = 'section-heading__description';
    descEl.textContent = description;
    container.appendChild(descEl);
  }

  return container;
}
