/**
 * FileUpload — drag-and-drop PDF upload zone.
 *
 * Usage:
 *   import { createFileUpload } from './components/FileUpload.js';
 *   const upload = createFileUpload({ accept: '.pdf', onFileSelect: (file) => {} });
 *   container.appendChild(upload.element);
 *   // Get selected file: upload.getFile()
 */

const UPLOAD_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;

const FILE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;

/**
 * @param {Object} options
 * @param {string} [options.accept='.pdf']
 * @param {string} [options.id]
 * @param {Function} [options.onFileSelect] - called with the selected File
 * @returns {{ element: HTMLDivElement, getFile: Function, setError: Function, reset: Function }}
 */
export function createFileUpload({
  accept = '.pdf',
  id,
  onFileSelect
} = {}) {
  let selectedFile = null;
  const inputId = id || `file-upload-${Math.random().toString(36).slice(2, 8)}`;

  const container = document.createElement('div');

  const zone = document.createElement('div');
  zone.className = 'file-upload';
  zone.setAttribute('role', 'button');
  zone.setAttribute('aria-label', 'Upload resume PDF');
  zone.tabIndex = 0;

  const icon = document.createElement('div');
  icon.className = 'file-upload__icon';
  icon.innerHTML = UPLOAD_ICON_SVG;

  const text = document.createElement('div');
  text.className = 'file-upload__text';
  text.innerHTML = `<strong>Click to upload</strong> or drag and drop`;

  const hint = document.createElement('div');
  hint.className = 'file-upload__hint';
  hint.textContent = 'PDF files only';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = accept;
  fileInput.className = 'file-upload__input';
  fileInput.id = inputId;
  fileInput.setAttribute('aria-label', 'Upload resume PDF file');

  zone.appendChild(icon);
  zone.appendChild(text);
  zone.appendChild(hint);
  zone.appendChild(fileInput);
  container.appendChild(zone);

  const errorEl = document.createElement('div');
  errorEl.className = 'file-upload-error-text';
  errorEl.setAttribute('role', 'alert');
  container.appendChild(errorEl);

  // --- Interactions ---

  function handleFile(file) {
    if (!file) return;

    // Validate PDF
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF file');
      return;
    }

    selectedFile = file;
    setError('');

    // Update UI to show selected file
    zone.classList.add('file-upload--selected');
    zone.classList.remove('file-upload--error');
    icon.innerHTML = FILE_ICON_SVG;

    // Replace text with filename
    const filename = document.createElement('div');
    filename.className = 'file-upload__filename';
    filename.textContent = file.name;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'file-upload__remove';
    removeBtn.textContent = 'Remove';
    removeBtn.type = 'button';
    removeBtn.setAttribute('aria-label', `Remove ${file.name}`);
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      reset();
    });
    filename.appendChild(removeBtn);

    text.replaceWith(filename);
    hint.style.display = 'none';
    zone._filenameEl = filename;

    if (onFileSelect) onFileSelect(file);
  }

  fileInput.addEventListener('change', (e) => {
    handleFile(e.target.files[0]);
  });

  // Drag and drop
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('file-upload--dragover');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('file-upload--dragover');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('file-upload--dragover');
    const file = e.dataTransfer?.files[0];
    if (file) handleFile(file);
  });

  // Keyboard: Enter/Space triggers file picker
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  function setError(msg) {
    if (msg) {
      zone.classList.add('file-upload--error');
      errorEl.textContent = msg;
    } else {
      zone.classList.remove('file-upload--error');
      errorEl.textContent = '';
    }
  }

  function reset() {
    selectedFile = null;
    fileInput.value = '';
    zone.classList.remove('file-upload--selected', 'file-upload--error');
    icon.innerHTML = UPLOAD_ICON_SVG;
    hint.style.display = '';
    errorEl.textContent = '';

    // Restore original text element
    if (zone._filenameEl) {
      const newText = document.createElement('div');
      newText.className = 'file-upload__text';
      newText.innerHTML = `<strong>Click to upload</strong> or drag and drop`;
      zone._filenameEl.replaceWith(newText);
      delete zone._filenameEl;
    }

    if (onFileSelect) onFileSelect(null);
  }

  function getFile() {
    return selectedFile;
  }

  return { element: container, getFile, setError, reset };
}
