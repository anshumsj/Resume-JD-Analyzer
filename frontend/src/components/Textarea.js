/**
 * Textarea — multi-line text input with label, helper text, live character counter, and error handling.
 */

/**
 * Format number with commas
 * @param {number} num
 * @returns {string}
 */
function formatNumber(num) {
  return num.toLocaleString();
}

/**
 * @param {Object} options
 * @param {string} [options.label]
 * @param {string} [options.helperText]
 * @param {string} [options.placeholder]
 * @param {string} [options.id]
 * @param {string} [options.name]
 * @param {string} [options.value='']
 * @param {number} [options.rows=7]
 * @param {number} [options.maxLength=10000]
 * @param {boolean} [options.disabled=false]
 * @param {boolean} [options.required=false]
 * @param {string} [options.error]
 * @param {Function} [options.onInput]
 * @returns {{
 *   group: HTMLDivElement,
 *   textarea: HTMLTextAreaElement,
 *   getValue: Function,
 *   setValue: Function,
 *   setError: Function,
 *   setDisabled: Function
 * }}
 */
export function createTextarea({
  label,
  helperText,
  placeholder,
  id,
  name,
  value = '',
  rows = 7,
  maxLength = 10000,
  disabled = false,
  required = false,
  error,
  onInput
} = {}) {
  const textareaId = id || `textarea-${Math.random().toString(36).slice(2, 8)}`;

  const group = document.createElement('div');
  group.className = 'textarea-group';

  // --- Header: Label + Helper ---
  if (label || helperText) {
    const header = document.createElement('div');
    header.className = 'textarea-header';

    if (label) {
      const labelEl = document.createElement('label');
      labelEl.className = 'textarea-label';
      labelEl.htmlFor = textareaId;
      labelEl.textContent = label;
      header.appendChild(labelEl);
    }

    if (helperText) {
      const helperEl = document.createElement('span');
      helperEl.className = 'textarea-helper';
      helperEl.textContent = helperText;
      header.appendChild(helperEl);
    }

    group.appendChild(header);
  }

  // --- Textarea Input ---
  const textarea = document.createElement('textarea');
  textarea.className = 'textarea';
  textarea.id = textareaId;
  textarea.rows = rows;
  if (name) textarea.name = name;
  if (placeholder) textarea.placeholder = placeholder;
  textarea.value = value;
  textarea.disabled = disabled;
  if (required) textarea.setAttribute('required', '');

  if (error) {
    textarea.classList.add('textarea--error');
    textarea.setAttribute('aria-invalid', 'true');
  }

  group.appendChild(textarea);

  // --- Footer: Error + Character Counter ---
  const footer = document.createElement('div');
  footer.className = 'textarea-footer';

  const errorEl = document.createElement('span');
  errorEl.className = 'textarea-error-text';
  errorEl.setAttribute('role', 'alert');
  errorEl.id = `${textareaId}-error`;
  if (error) {
    errorEl.textContent = error;
    textarea.setAttribute('aria-describedby', errorEl.id);
  }

  const counterEl = document.createElement('span');
  counterEl.className = 'textarea-counter';
  counterEl.id = `${textareaId}-counter`;
  counterEl.setAttribute('aria-live', 'polite');

  function updateCounter() {
    const len = textarea.value.length;
    counterEl.textContent = `${formatNumber(len)} / ${formatNumber(maxLength)}`;

    if (len > maxLength) {
      counterEl.classList.add('textarea-counter--error');
    } else {
      counterEl.classList.remove('textarea-counter--error');
    }
  }

  updateCounter();

  footer.appendChild(errorEl);
  footer.appendChild(counterEl);
  group.appendChild(footer);

  // --- Event Listeners ---
  textarea.addEventListener('input', (e) => {
    updateCounter();
    if (onInput) onInput(textarea.value);
  });

  function setError(msg) {
    if (msg) {
      textarea.classList.add('textarea--error');
      textarea.setAttribute('aria-invalid', 'true');
      errorEl.textContent = msg;
      textarea.setAttribute('aria-describedby', errorEl.id);
    } else {
      textarea.classList.remove('textarea--error');
      textarea.removeAttribute('aria-invalid');
      errorEl.textContent = '';
      textarea.removeAttribute('aria-describedby');
    }
  }

  function setDisabled(d) {
    textarea.disabled = !!d;
  }

  function getValue() {
    return textarea.value;
  }

  function setValue(val) {
    textarea.value = val || '';
    updateCounter();
  }

  return {
    group,
    textarea,
    getValue,
    setValue,
    setError,
    setDisabled
  };
}
