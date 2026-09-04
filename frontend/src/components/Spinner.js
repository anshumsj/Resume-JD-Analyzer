/**
 * Spinner — loading indicator.
 *
 * Usage:
 *   import { createSpinner, createLoadingState } from './components/Spinner.js';
 *   container.appendChild(createSpinner());
 *   container.appendChild(createLoadingState('Analyzing resume...'));
 */

/**
 * @param {'sm'|'md'|'lg'} [size='md']
 * @returns {HTMLSpanElement}
 */
export function createSpinner(size = 'md') {
  const spinner = document.createElement('span');
  spinner.className = 'spinner';
  spinner.setAttribute('role', 'status');
  spinner.setAttribute('aria-label', 'Loading');

  if (size === 'sm') spinner.classList.add('spinner--sm');
  if (size === 'lg') spinner.classList.add('spinner--lg');

  // Screen-reader accessible text
  const srText = document.createElement('span');
  srText.className = 'sr-only';
  srText.textContent = 'Loading';
  srText.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0;';
  spinner.appendChild(srText);

  return spinner;
}

/**
 * Creates a centered loading state with spinner and message.
 * @param {string} [message='Loading...']
 * @returns {HTMLDivElement}
 */
export function createLoadingState(message = 'Loading...') {
  const container = document.createElement('div');
  container.className = 'loading-state';

  container.appendChild(createSpinner('lg'));

  const text = document.createElement('span');
  text.className = 'loading-state__text';
  text.textContent = message;
  container.appendChild(text);

  return container;
}
