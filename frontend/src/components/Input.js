/**
 * Input — text input with label and error support.
 *
 * Usage:
 *   import { createInput } from './components/Input.js';
 *   const input = createInput({ label: 'Name', placeholder: 'Enter name' });
 *   container.appendChild(input.group);
 *   // Access value: input.input.value
 */

/**
 * @param {Object} options
 * @param {string} [options.label]
 * @param {string} [options.placeholder]
 * @param {string} [options.type='text']
 * @param {string} [options.id]
 * @param {string} [options.name]
 * @param {string} [options.value]
 * @param {boolean} [options.disabled=false]
 * @param {boolean} [options.required=false]
 * @param {string} [options.error]
 * @returns {{ group: HTMLDivElement, input: HTMLInputElement, setError: Function }}
 */
export function createInput({
  label,
  placeholder,
  type = 'text',
  id,
  name,
  value = '',
  disabled = false,
  required = false,
  error
} = {}) {
  const inputId = id || `input-${Math.random().toString(36).slice(2, 8)}`;

  const group = document.createElement('div');
  group.className = 'input-group';

  if (label) {
    const labelEl = document.createElement('label');
    labelEl.className = 'input-label';
    labelEl.htmlFor = inputId;
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

  const input = document.createElement('input');
  input.className = 'input';
  input.type = type;
  input.id = inputId;
  if (name) input.name = name;
  if (placeholder) input.placeholder = placeholder;
  input.value = value;
  input.disabled = disabled;
  if (required) input.setAttribute('required', '');
  if (label) input.setAttribute('aria-label', label);

  if (error) {
    input.classList.add('input--error');
    input.setAttribute('aria-invalid', 'true');
  }

  group.appendChild(input);

  const errorEl = document.createElement('span');
  errorEl.className = 'input-error-text';
  errorEl.setAttribute('role', 'alert');
  errorEl.id = `${inputId}-error`;
  if (error) {
    errorEl.textContent = error;
    input.setAttribute('aria-describedby', errorEl.id);
  }
  group.appendChild(errorEl);

  function setError(msg) {
    if (msg) {
      input.classList.add('input--error');
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', errorEl.id);
      errorEl.textContent = msg;
    } else {
      input.classList.remove('input--error');
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
      errorEl.textContent = '';
    }
  }

  return { group, input, setError };
}
