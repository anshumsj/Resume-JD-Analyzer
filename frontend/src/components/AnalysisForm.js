/**
 * AnalysisForm — encapsulating resume upload, job description input,
 * client validation, loading state, and error handling.
 */

import { createFileUpload } from './FileUpload.js';
import { createTextarea } from './Textarea.js';
import { createButton } from './Button.js';
import { createSpinner } from './Spinner.js';

/**
 * @param {Object} options
 * @param {Function} options.onSubmit - called with { file, jobDescription }
 * @returns {{
 *   element: HTMLFormElement,
 *   setLoading: Function,
 *   setError: Function,
 *   clearError: Function,
 *   reset: Function
 * }}
 */
export function createAnalysisForm({ onSubmit } = {}) {
  const form = document.createElement('form');
  form.className = 'analysis-form';
  form.noValidate = true;

  let isSubmitting = false;

  // --- 1. Page Heading ---
  const heading = document.createElement('div');
  heading.className = 'analysis-form__heading';

  const title = document.createElement('h1');
  title.className = 'analysis-form__title';
  title.textContent = 'Analyze your fit';

  const subtitle = document.createElement('p');
  subtitle.className = 'analysis-form__subtitle';
  subtitle.textContent = 'Compare your resume against a job description and see where you stand before you apply.';

  heading.appendChild(title);
  heading.appendChild(subtitle);
  form.appendChild(heading);

  // --- 2. Resume Section ---
  const resumeSection = document.createElement('section');
  resumeSection.className = 'analysis-form__section';
  resumeSection.setAttribute('aria-labelledby', 'resume-section-label');

  const resumeLabel = document.createElement('h2');
  resumeLabel.id = 'resume-section-label';
  resumeLabel.className = 'analysis-form__section-label';
  resumeLabel.textContent = 'Resume';

  const fileUpload = createFileUpload({
    accept: '.pdf',
    onFileSelect: () => {
      clearError();
      validateForm(false);
    }
  });

  resumeSection.appendChild(resumeLabel);
  resumeSection.appendChild(fileUpload.element);
  form.appendChild(resumeSection);

  // --- 3. Job Description Section ---
  const jdSection = document.createElement('section');
  jdSection.className = 'analysis-form__section';
  jdSection.setAttribute('aria-labelledby', 'jd-section-label');

  const jdTextarea = createTextarea({
    label: 'Job description',
    helperText: 'Paste the complete job description for a more accurate comparison.',
    placeholder: 'Paste the job description here...',
    rows: 8,
    maxLength: 10000,
    onInput: () => {
      clearError();
      validateForm(false);
    }
  });

  // Make the textarea label act as the section label
  const textareaLabel = jdTextarea.group.querySelector('.textarea-label');
  if (textareaLabel) textareaLabel.id = 'jd-section-label';

  jdSection.appendChild(jdTextarea.group);
  form.appendChild(jdSection);

  // --- 4. Error Banner (hidden by default) ---
  const errorBanner = document.createElement('div');
  errorBanner.className = 'analysis-form__error-banner';
  errorBanner.setAttribute('role', 'alert');
  errorBanner.style.display = 'none';

  const errorContent = document.createElement('div');
  errorContent.className = 'analysis-form__error-content';

  const errorTitle = document.createElement('div');
  errorTitle.className = 'analysis-form__error-title';
  errorTitle.textContent = "Analysis couldn't be completed";

  const errorMessage = document.createElement('div');
  errorMessage.className = 'analysis-form__error-message';
  errorMessage.textContent = 'Please try again. Your resume and job description are still here.';

  errorContent.appendChild(errorTitle);
  errorContent.appendChild(errorMessage);

  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.className = 'analysis-form__retry-btn';
  retryBtn.textContent = 'Try again';
  retryBtn.addEventListener('click', () => {
    handleFormSubmit();
  });

  errorBanner.appendChild(errorContent);
  errorBanner.appendChild(retryBtn);
  form.appendChild(errorBanner);

  // --- 5. Action Row ---
  const actions = document.createElement('div');
  actions.className = 'analysis-form__actions';

  const statusContainer = document.createElement('div');
  statusContainer.className = 'analysis-form__status';
  statusContainer.style.display = 'none';

  const statusSpinner = createSpinner({ size: 'sm' });
  const statusText = document.createElement('span');
  statusText.className = 'analysis-form__status-text';
  statusText.textContent = 'Comparing your resume with the role requirements…';

  statusContainer.appendChild(statusSpinner);
  statusContainer.appendChild(statusText);

  const submitBtn = createButton({
    text: 'Analyze fit →',
    variant: 'primary',
    type: 'submit',
    disabled: true
  });
  submitBtn.classList.add('analysis-form__submit-btn');

  actions.appendChild(statusContainer);
  actions.appendChild(submitBtn);
  form.appendChild(actions);

  // --- Form Validation Logic ---

  function validateForm(showErrors = false) {
    const file = fileUpload.getFile();
    const jd = jdTextarea.getValue().trim();
    const jdRaw = jdTextarea.getValue();

    let isValid = true;

    // Check resume file
    if (!file) {
      isValid = false;
      if (showErrors) {
        fileUpload.setError('Please upload a PDF resume.');
      }
    }

    // Check job description
    if (!jd) {
      isValid = false;
      if (showErrors) {
        jdTextarea.setError('Please paste a job description.');
      }
    } else if (jdRaw.length > 10000) {
      isValid = false;
      if (showErrors) {
        jdTextarea.setError('Job description must be 10,000 characters or fewer.');
      }
    }

    if (!isSubmitting) {
      submitBtn.disabled = !isValid;
    }

    return isValid;
  }

  // --- Submit Handler ---

  function handleFormSubmit() {
    if (isSubmitting) return;

    clearError();
    const valid = validateForm(true);
    if (!valid) return;

    const file = fileUpload.getFile();
    const jobDescription = jdTextarea.getValue().trim();

    if (onSubmit) {
      onSubmit({ file, jobDescription });
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleFormSubmit();
  });

  // --- Public Methods ---

  function setLoading(loading) {
    isSubmitting = !!loading;

    fileUpload.setDisabled(isSubmitting);
    jdTextarea.setDisabled(isSubmitting);
    submitBtn.disabled = isSubmitting;

    if (isSubmitting) {
      statusContainer.style.display = 'flex';
      submitBtn.textContent = 'Analyzing…';
      submitBtn.prepend(createSpinner({ size: 'sm' }));
    } else {
      statusContainer.style.display = 'none';
      submitBtn.textContent = 'Analyze fit →';
      validateForm(false);
    }
  }

  function showError(customMessage) {
    setLoading(false);
    errorBanner.style.display = 'flex';
    if (customMessage) {
      errorMessage.textContent = customMessage;
    } else {
      errorMessage.textContent = 'Please try again. Your resume and job description are still here.';
    }
    // Scroll error into view smoothly if not visible
    errorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function clearError() {
    errorBanner.style.display = 'none';
  }

  function reset() {
    clearError();
    fileUpload.reset();
    jdTextarea.setValue('');
    setLoading(false);
    validateForm(false);
  }

  return {
    element: form,
    setLoading,
    showError,
    clearError,
    reset
  };
}
