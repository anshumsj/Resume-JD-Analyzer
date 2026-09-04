/**
 * FileUpload — drag-and-drop PDF upload zone.
 * Transforms into a compact file row when a file is selected.
 */

const UPLOAD_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><polyline points="9 15 12 12 15 15"/></svg>`;

const REMOVE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

/**
 * Format bytes to readable size (KB/MB)
 * @param {number} bytes
 * @returns {string}
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * @param {Object} options
 * @param {string} [options.accept='.pdf']
 * @param {string} [options.id]
 * @param {Function} [options.onFileSelect] - called with selected File or null
 * @returns {{ element: HTMLDivElement, getFile: Function, setError: Function, reset: Function, setDisabled: Function }}
 */
export function createFileUpload({
  accept = '.pdf',
  id,
  onFileSelect
} = {}) {
  let selectedFile = null;
  let isDisabled = false;
  const inputId = id || `file-upload-${Math.random().toString(36).slice(2, 8)}`;

  const container = document.createElement('div');
  container.className = 'file-upload-container';

  const zone = document.createElement('div');
  zone.className = 'file-upload';
  zone.setAttribute('role', 'button');
  zone.setAttribute('aria-label', 'Upload resume PDF');
  zone.tabIndex = 0;

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = accept;
  fileInput.className = 'file-upload__input';
  fileInput.id = inputId;
  fileInput.setAttribute('aria-label', 'Upload resume PDF file');
  fileInput.tabIndex = -1;

  const errorEl = document.createElement('div');
  errorEl.className = 'file-upload-error-text';
  errorEl.setAttribute('role', 'alert');
  errorEl.id = `${inputId}-error`;

  // Render the empty dropzone contents
  function renderEmptyState() {
    zone.className = 'file-upload';
    zone.innerHTML = '';

    const icon = document.createElement('div');
    icon.className = 'file-upload__icon';
    icon.innerHTML = UPLOAD_ICON_SVG;

    const mainText = document.createElement('div');
    mainText.className = 'file-upload__text';
    mainText.textContent = 'Drop your resume here';

    const browseText = document.createElement('div');
    browseText.className = 'file-upload__browse-text';
    browseText.innerHTML = `or <span class="file-upload__browse-link">browse from your computer</span>`;

    const hint = document.createElement('div');
    hint.className = 'file-upload__hint';
    hint.textContent = 'PDF only · Max 10 MB';

    zone.appendChild(icon);
    zone.appendChild(mainText);
    zone.appendChild(browseText);
    zone.appendChild(hint);
    zone.appendChild(fileInput);

    zone.setAttribute('role', 'button');
    zone.setAttribute('aria-label', 'Upload resume PDF');
    zone.tabIndex = isDisabled ? -1 : 0;
  }

  // Render the compact file row
  function renderSelectedState(file) {
    zone.className = 'file-upload file-upload--compact';
    zone.innerHTML = '';
    zone.removeAttribute('role');
    zone.removeAttribute('aria-label');
    zone.tabIndex = -1;

    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-upload__file-info';

    const badge = document.createElement('span');
    badge.className = 'file-upload__file-badge';
    badge.textContent = 'PDF';

    const details = document.createElement('div');
    details.className = 'file-upload__file-details';

    const name = document.createElement('div');
    name.className = 'file-upload__file-name';
    name.textContent = file.name;
    name.title = file.name;

    const size = document.createElement('div');
    size.className = 'file-upload__file-size';
    size.textContent = formatFileSize(file.size);

    details.appendChild(name);
    details.appendChild(size);

    fileInfo.appendChild(badge);
    fileInfo.appendChild(details);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'file-upload__remove-btn';
    removeBtn.setAttribute('aria-label', `Remove ${file.name}`);
    removeBtn.innerHTML = `Remove ${REMOVE_ICON_SVG}`;
    removeBtn.disabled = isDisabled;

    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isDisabled) return;
      reset();
    });

    zone.appendChild(fileInfo);
    zone.appendChild(removeBtn);
    zone.appendChild(fileInput);
  }

  renderEmptyState();
  container.appendChild(zone);
  container.appendChild(errorEl);

  // --- Handlers & Validation ---

  function validateAndSetFile(file) {
    if (!file) return false;

    // Check PDF extension / mime
    const isPdfName = file.name.toLowerCase().endsWith('.pdf');
    const isPdfType = file.type === 'application/pdf' || file.type === '';
    if (!isPdfName && !isPdfType) {
      setError('Only PDF resumes are supported.');
      return false;
    }

    // Check size limit: 10 MB = 10 * 1024 * 1024 bytes
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setError('Resume must be smaller than 10 MB.');
      return false;
    }

    selectedFile = file;
    setError('');
    renderSelectedState(file);
    if (onFileSelect) onFileSelect(file);
    return true;
  }

  // Click on dropzone when empty opens file picker
  zone.addEventListener('click', (e) => {
    if (isDisabled || selectedFile) return;
    fileInput.click();
  });

  // File input change
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
    // reset input value so re-selecting the same file triggers change
    fileInput.value = '';
  });

  // Drag and drop events
  zone.addEventListener('dragover', (e) => {
    if (isDisabled || selectedFile) return;
    e.preventDefault();
    zone.classList.add('file-upload--dragover');
    const mainText = zone.querySelector('.file-upload__text');
    if (mainText) mainText.textContent = 'Drop PDF to upload';
  });

  zone.addEventListener('dragleave', (e) => {
    if (isDisabled || selectedFile) return;
    zone.classList.remove('file-upload--dragover');
    const mainText = zone.querySelector('.file-upload__text');
    if (mainText) mainText.textContent = 'Drop your resume here';
  });

  zone.addEventListener('drop', (e) => {
    if (isDisabled || selectedFile) return;
    e.preventDefault();
    zone.classList.remove('file-upload--dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  });

  // Keyboard accessibility: Enter or Space triggers file picker
  zone.addEventListener('keydown', (e) => {
    if (isDisabled || selectedFile) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  function setError(msg) {
    if (msg) {
      zone.classList.add('file-upload--error');
      errorEl.textContent = msg;
      zone.setAttribute('aria-describedby', errorEl.id);
    } else {
      zone.classList.remove('file-upload--error');
      errorEl.textContent = '';
      zone.removeAttribute('aria-describedby');
    }
  }

  function reset() {
    selectedFile = null;
    fileInput.value = '';
    setError('');
    renderEmptyState();
    if (onFileSelect) onFileSelect(null);
  }

  function setDisabled(disabled) {
    isDisabled = !!disabled;
    fileInput.disabled = isDisabled;
    if (isDisabled) {
      zone.classList.add('file-upload--disabled');
      zone.tabIndex = -1;
    } else {
      zone.classList.remove('file-upload--disabled');
      if (!selectedFile) zone.tabIndex = 0;
    }
    const removeBtn = zone.querySelector('.file-upload__remove-btn');
    if (removeBtn) removeBtn.disabled = isDisabled;
  }

  function getFile() {
    return selectedFile;
  }

  return {
    element: container,
    getFile,
    setError,
    reset,
    setDisabled
  };
}
