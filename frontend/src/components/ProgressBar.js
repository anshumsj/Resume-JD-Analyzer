/**
 * ProgressBar — determinate progress indicator.
 *
 * Usage:
 *   import { createProgressBar } from './components/ProgressBar.js';
 *   const bar = createProgressBar({ label: 'Overall Score', value: 81, max: 100 });
 */

/**
 * @param {Object} options
 * @param {string} [options.label]
 * @param {number} options.value - Current value (0–max)
 * @param {number} [options.max=100]
 * @param {boolean} [options.showValue=true]
 * @param {'auto'|'success'|'warning'|'error'|'accent'} [options.color='auto'] - 'auto' picks color based on value
 * @returns {{ element: HTMLDivElement, setValue: Function }}
 */
export function createProgressBar({
  label,
  value = 0,
  max = 100,
  showValue = true,
  color = 'auto'
} = {}) {
  const container = document.createElement('div');
  container.className = 'progress';
  container.setAttribute('role', 'progressbar');
  container.setAttribute('aria-valuenow', String(value));
  container.setAttribute('aria-valuemin', '0');
  container.setAttribute('aria-valuemax', String(max));
  if (label) container.setAttribute('aria-label', label);

  let labelTextEl, labelValueEl;

  if (label || showValue) {
    const labelRow = document.createElement('div');
    labelRow.className = 'progress__label';

    labelTextEl = document.createElement('span');
    labelTextEl.className = 'progress__label-text';
    labelTextEl.textContent = label || '';
    labelRow.appendChild(labelTextEl);

    if (showValue) {
      labelValueEl = document.createElement('span');
      labelValueEl.className = 'progress__label-value';
      labelValueEl.textContent = `${value}/${max}`;
      labelRow.appendChild(labelValueEl);
    }

    container.appendChild(labelRow);
  }

  const track = document.createElement('div');
  track.className = 'progress__track';

  const fill = document.createElement('div');
  fill.className = 'progress__fill';
  applyColor(fill, value, max, color);
  fill.style.width = `${Math.min(100, (value / max) * 100)}%`;

  track.appendChild(fill);
  container.appendChild(track);

  function setValue(newValue) {
    value = newValue;
    fill.style.width = `${Math.min(100, (newValue / max) * 100)}%`;
    container.setAttribute('aria-valuenow', String(newValue));
    if (labelValueEl) labelValueEl.textContent = `${newValue}/${max}`;
    applyColor(fill, newValue, max, color);
  }

  return { element: container, setValue };
}

function applyColor(fill, value, max, color) {
  fill.classList.remove('progress__fill--success', 'progress__fill--warning', 'progress__fill--error');

  if (color === 'auto') {
    const pct = (value / max) * 100;
    if (pct >= 70) fill.classList.add('progress__fill--success');
    else if (pct >= 40) fill.classList.add('progress__fill--warning');
    else fill.classList.add('progress__fill--error');
  } else if (color !== 'accent') {
    fill.classList.add(`progress__fill--${color}`);
  }
}
