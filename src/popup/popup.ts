import type { Message } from '../types/messages';

console.log('[Hiya] Popup script loaded');

// Get DOM elements
const detectFormsBtn = document.getElementById('detect-forms') as HTMLButtonElement;
const toggleVoiceBtn = document.getElementById('toggle-voice') as HTMLButtonElement;
const prevFieldBtn = document.getElementById('prev-field') as HTMLButtonElement;
const nextFieldBtn = document.getElementById('next-field') as HTMLButtonElement;
const gotoUnfilledBtn = document.getElementById('goto-unfilled') as HTMLButtonElement;

const fieldsCountEl = document.getElementById('fields-count') as HTMLSpanElement;
const filledCountEl = document.getElementById('filled-count') as HTMLSpanElement;
const requiredCountEl = document.getElementById('required-count') as HTMLSpanElement;
const progressFillEl = document.getElementById('progress-fill') as HTMLDivElement;
const progressTextEl = document.getElementById('progress-text') as HTMLSpanElement;

const currentFieldSection = document.getElementById('current-field-section') as HTMLElement;
const currentFieldLabel = document.getElementById('current-field-label') as HTMLDivElement;
const currentFieldType = document.getElementById('current-field-type') as HTMLDivElement;

// Detect forms when popup opens
detectForms();

// Event listeners
detectFormsBtn.addEventListener('click', detectForms);
toggleVoiceBtn.addEventListener('click', toggleVoice);
prevFieldBtn.addEventListener('click', previousField);
nextFieldBtn.addEventListener('click', nextField);
gotoUnfilledBtn.addEventListener('click', gotoFirstUnfilled);

/**
 * Detects forms in the active tab
 */
async function detectForms() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.id) {
      console.error('[Hiya] No active tab found');
      return;
    }

    // Send message to content script
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'DETECT_FORMS',
    } as Message);

    console.log('[Hiya] Form detection response:', response);

    if (response?.formInfo) {
      updateFormStats(response.formInfo);
    }
  } catch (error) {
    console.error('[Hiya] Error detecting forms:', error);
    fieldsCountEl.textContent = 'Error';
    filledCountEl.textContent = 'Error';
    requiredCountEl.textContent = 'Error';
  }
}

/**
 * Updates form statistics in the popup
 */
function updateFormStats(formInfo: any) {
  fieldsCountEl.textContent = formInfo.totalFields.toString();
  filledCountEl.textContent = formInfo.filledFields.toString();
  requiredCountEl.textContent = formInfo.requiredFields.toString();

  // Update progress bar
  const percentage = formInfo.totalFields > 0
    ? Math.round((formInfo.filledFields / formInfo.totalFields) * 100)
    : 0;

  progressFillEl.style.width = `${percentage}%`;
  progressTextEl.textContent = `${percentage}%`;

  // Change progress color based on completion
  if (percentage === 100) {
    progressFillEl.style.background = 'linear-gradient(90deg, #10b981, #059669)';
  } else {
    progressFillEl.style.background = 'linear-gradient(90deg, #4f46e5, #7c3aed)';
  }
}

/**
 * Navigates to the previous field
 */
async function previousField() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.id) return;

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'PREVIOUS_FIELD',
    } as Message);

    if (response?.success && response?.field) {
      updateCurrentField(response.field);
    }
  } catch (error) {
    console.error('[Hiya] Error navigating to previous field:', error);
  }
}

/**
 * Navigates to the next field
 */
async function nextField() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.id) return;

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'NEXT_FIELD',
    } as Message);

    if (response?.success && response?.field) {
      updateCurrentField(response.field);
    }
  } catch (error) {
    console.error('[Hiya] Error navigating to next field:', error);
  }
}

/**
 * Goes to the first unfilled required field
 */
async function gotoFirstUnfilled() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.id) return;

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'GOTO_UNFILLED',
    } as Message);

    if (response?.success && response?.field) {
      updateCurrentField(response.field);
    } else {
      alert('All required fields are filled!');
    }
  } catch (error) {
    console.error('[Hiya] Error going to unfilled field:', error);
  }
}

/**
 * Updates the current field display
 */
function updateCurrentField(field: any) {
  currentFieldSection.style.display = 'block';
  currentFieldLabel.textContent = field.label || 'Unlabeled field';
  currentFieldType.textContent = `Type: ${field.type}`;
}

/**
 * Toggles voice assistant in the active tab
 */
async function toggleVoice() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.id) {
      console.error('[Hiya] No active tab found');
      return;
    }

    await chrome.tabs.sendMessage(tab.id, {
      type: 'TOGGLE_VOICE',
    } as Message);

    console.log('[Hiya] Voice toggle sent');
  } catch (error) {
    console.error('[Hiya] Error toggling voice:', error);
  }
}

export {};
