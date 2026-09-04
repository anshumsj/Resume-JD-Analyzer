/**
 * Textarea — multi-line text input with label and error support.
 *
 * Usage:
 *   import { createTextarea } from './components/Textarea.js';
 *   const ta = createTextarea({ label: 'Job Description', rows: 8 });
 *   container.appendChild(ta.group);
 */

/**
 * @param {Object} options
 * @param {string} [options.label]
 * @param {string} [options.placeholder]
 * @param {string} [options.id]
 * @param {string} [options.name]
 * @param {string} [options.value]
 * @param {number} [options.rows=6]
 * @param {boolean} [options.disabled=false]
 * @param {boolean} [options.required=false]
 * @param {string} [options.error]
 * @returns {{ group: HTMLDivElement, textarea: HTMLTextAreaElement, setError: Function }}
 */
export function createTextarea({
  label,
  placeholder,
  id,
  name,
  value = '',
  rows = 6,
  disabled = false,
  required = false,
  error
} = {}) {
  const textareaId = id || `textarea-${Math.random().toString(36).slice(2, 8)}`;

  const group = document.createElement('div');
  group.className = 'textarea-group';

  if (label) {
    const labelEl = document.createElement('label');
    labelEl.className = 'textarea-label';
    labelEl.htmlFor = textareaId;
    labelEl.textContent = label;
    if (required) {
      const req = document.createElement('span');
      req.textContent = ' *';
      req.style.color = 'var(--color-error)';
      req.setAttribute('aria-hidden', 'true');
      labelEl.appendChild(req);
    }
    group.appendChild(labelEl);
  }

  const textarea = document.createElement('textarea');
  textarea.className = 'textarea';
  textarea.id = textareaId;
  textarea.rows = rows;
  if (name) textarea.name = name;
  if (placeholder) textarea.placeholder = placeholder;
  textarea.value = value;
  textarea.disabled = disabled;
  if (required) textarea.setAttribute('required', '');
  if (label) textarea.setAttribute('aria-label', label);

  if (error) {
    textarea.classList.add('textarea--error');
    textarea.setAttribute('aria-invalid', 'true');
  }

  group.appendChild(textarea);

  const errorEl = document.createElement('span');
  errorEl.className = 'textarea-error-text';
  errorEl.setAttribute('role', 'alert');
  errorEl.id = `${textareaId}-error`;
  if (error) {
    errorEl.textContent = error;
    textarea.setAttribute('aria-describedby', errorEl.id);
  }
  group.appendChild(errorEl);

  function setError(msg) {
    if (msg) {
      textarea.classList.add('textarea--error');
      textarea.setAttribute('aria-invalid', 'true');
      textarea.setAttribute('aria-describedby', errorEl.id);
      errorEl.textContent = msg;
    } else {
      textarea.classList.remove('textarea--error');
      textarea.removeAttribute('aria-invalid');
      textarea.removeAttribute('aria-describedby');
      errorEl.textContent = '';
    }
  }

  return { group, textarea, setError };
}
