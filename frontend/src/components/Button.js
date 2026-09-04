/**
 * Button — primary, secondary, ghost variants.
 *
 * Usage:
 *   import { createButton } from './components/Button.js';
 *   const btn = createButton({ text: 'Analyze', variant: 'primary', onClick: fn });
 */

/**
 * @param {Object} options
 * @param {string} options.text - Button label text
 * @param {'primary'|'secondary'|'ghost'} [options.variant='primary']
 * @param {'button'|'submit'|'reset'} [options.type='button']
 * @param {boolean} [options.disabled=false]
 * @param {boolean} [options.loading=false]
 * @param {string} [options.size] - 'sm' for small variant
 * @param {string} [options.id]
 * @param {Function} [options.onClick]
 * @returns {HTMLButtonElement}
 */
export function createButton({
  text,
  variant = 'primary',
  type = 'button',
  disabled = false,
  loading = false,
  size,
  id,
  onClick
} = {}) {
  const btn = document.createElement('button');
  btn.type = type;
  btn.className = `btn btn--${variant}`;

  if (size === 'sm') btn.classList.add('btn--sm');
  if (loading) btn.classList.add('btn--loading');
  if (id) btn.id = id;

  btn.disabled = disabled || loading;
  btn.textContent = text;

  if (loading) {
    btn.setAttribute('aria-busy', 'true');
  }

  if (onClick) {
    btn.addEventListener('click', onClick);
  }

  return btn;
}

/**
 * Sets loading state on an existing button.
 * @param {HTMLButtonElement} btn
 * @param {boolean} loading
 * @param {string} [loadingText] - Optional text to show while loading
 */
export function setButtonLoading(btn, loading, loadingText) {
  if (loading) {
    btn._originalText = btn.textContent;
    btn.classList.add('btn--loading');
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    if (loadingText) btn.textContent = loadingText;
  } else {
    btn.classList.remove('btn--loading');
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    if (btn._originalText) {
      btn.textContent = btn._originalText;
      delete btn._originalText;
    }
  }
}
