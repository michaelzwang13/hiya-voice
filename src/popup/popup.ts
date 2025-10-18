import type { Message } from '../types/messages';

console.log('[Hiya] Popup script loaded');

// Get DOM elements
const detectFormsBtn = document.getElementById('detect-forms') as HTMLButtonElement;
const toggleVoiceBtn = document.getElementById('toggle-voice') as HTMLButtonElement;
const formsCountEl = document.getElementById('forms-count') as HTMLSpanElement;
const fieldsCountEl = document.getElementById('fields-count') as HTMLSpanElement;
const requiredCountEl = document.getElementById('required-count') as HTMLSpanElement;

// Detect forms when popup opens
detectForms();

// Event listeners
detectFormsBtn.addEventListener('click', detectForms);
toggleVoiceBtn.addEventListener('click', toggleVoice);

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
      const { formInfo } = response;
      formsCountEl.textContent = formInfo.formElement ? '1' : '0';
      fieldsCountEl.textContent = formInfo.totalFields.toString();
      requiredCountEl.textContent = formInfo.requiredFields.toString();
    }
  } catch (error) {
    console.error('[Hiya] Error detecting forms:', error);
    formsCountEl.textContent = 'Error';
    fieldsCountEl.textContent = 'Error';
    requiredCountEl.textContent = 'Error';
  }
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
