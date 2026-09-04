/**
 * Badge — status/label indicator.
 *
 * Usage:
 *   import { createBadge } from './components/Badge.js';
 *   const badge = createBadge({ text: 'Direct', variant: 'direct' });
 */

/**
 * @param {Object} options
 * @param {string} options.text
 * @param {'default'|'accent'|'success'|'warning'|'error'|'direct'|'related'|'partial'|'missing'} [options.variant='default']
 * @param {boolean} [options.dot=false] - Show dot indicator before text
 * @returns {HTMLSpanElement}
 */
export function createBadge({ text, variant = 'default', dot = false } = {}) {
  const badge = document.createElement('span');
  badge.className = `badge badge--${variant}`;

  if (dot) {
    const dotEl = document.createElement('span');
    dotEl.className = 'badge__dot';
    dotEl.setAttribute('aria-hidden', 'true');
    badge.appendChild(dotEl);
  }

  const textNode = document.createTextNode(text);
  badge.appendChild(textNode);

  return badge;
}
