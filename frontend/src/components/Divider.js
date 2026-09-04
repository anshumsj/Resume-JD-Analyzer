/**
 * Divider — horizontal separator.
 *
 * Usage:
 *   import { createDivider } from './components/Divider.js';
 *   container.appendChild(createDivider());
 */

/**
 * @param {'tight'|'loose'} [spacing] - Optional spacing variant
 * @returns {HTMLHRElement}
 */
export function createDivider(spacing) {
  const hr = document.createElement('hr');
  hr.className = 'divider';
  if (spacing === 'tight') hr.classList.add('divider--tight');
  if (spacing === 'loose') hr.classList.add('divider--loose');
  return hr;
}
