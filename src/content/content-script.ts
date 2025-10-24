import { FormDetector } from '../utils/form-detector';
import { VoiceAssistantOverlay } from '../components/overlay';
import type { Message } from '../types/messages';

console.log('[Hiya] Content script loaded');

const formDetector = new FormDetector();
let overlay: VoiceAssistantOverlay | null = null;
let isExtensionEnabled = true;

// Check if extension is enabled
chrome.storage.local.get(['extensionEnabled'], (result) => {
  isExtensionEnabled = result.extensionEnabled !== false; // Default to true

  if (isExtensionEnabled) {
    initializeExtension();
  }
});

// Detect forms when the page loads
window.addEventListener('load', () => {
  if (!isExtensionEnabled) return;

  const formInfo = formDetector.detectForms();
  console.log('[Hiya] Form detection complete:', formInfo);

  if (overlay) {
    overlay.updateFormStatus(formInfo);

    // Show first field if available
    if (formInfo.totalFields > 0) {
      formDetector.nextField();
      updateOverlayCurrentField();
    }
  }
});

/**
 * Initializes the extension overlay and events
 */
function initializeExtension() {
  if (overlay) return; // Already initialized

  overlay = new VoiceAssistantOverlay();

  // Wire up overlay events
  overlay.onNextField = handleNextField;
  overlay.onPreviousField = handlePreviousField;
  overlay.onJumpToUnfilled = handleJumpToUnfilled;
  overlay.onToggleVoice = handleToggleVoice;

  // Detect forms if page already loaded
  if (document.readyState === 'complete') {
    const formInfo = formDetector.detectForms();
    overlay.updateFormStatus(formInfo);

    if (formInfo.totalFields > 0) {
      formDetector.nextField();
      updateOverlayCurrentField();
    }
  }
}

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  console.log('[Hiya] Received message:', message);

  switch (message.type) {
    case 'DETECT_FORMS': {
      const formInfo = formDetector.detectForms();
      const state = formDetector.getFormState();
      sendResponse({
        formInfo: {
          ...formInfo,
          ...state,
        }
      });
      break;
    }

    case 'NEXT_FIELD': {
      const field = formDetector.nextField();
      if (field) {
        showNotification(`Now at: ${field.label}`);
        speak(field.label);
        sendResponse({ success: true, field });
      } else {
        sendResponse({ success: false, error: 'No fields found' });
      }
      break;
    }

    case 'PREVIOUS_FIELD': {
      const field = formDetector.previousField();
      if (field) {
        showNotification(`Now at: ${field.label}`);
        speak(field.label);
        sendResponse({ success: true, field });
      } else {
        sendResponse({ success: false, error: 'No fields found' });
      }
      break;
    }

    case 'FILL_FIELD': {
      const success = formDetector.fillCurrentField(message.payload?.value || '');
      if (success) {
        showNotification(`Filled: ${message.payload?.value}`);
      }
      sendResponse({ success });
      break;
    }

    case 'GET_FORM_STATE': {
      const state = formDetector.getFormState();
      const currentField = formDetector.getCurrentField();
      sendResponse({
        ...state,
        currentField,
      });
      break;
    }

    case 'GOTO_UNFILLED': {
      const field = formDetector.goToFirstUnfilledRequired();
      if (field) {
        showNotification(`Jumped to: ${field.label}`);
        speak(field.label);
        sendResponse({ success: true, field });
      } else {
        showNotification('All required fields are filled!');
        speak('All required fields are filled!');
        sendResponse({ success: false, message: 'All required fields filled' });
      }
      break;
    }

    case 'ENABLE_EXTENSION': {
      isExtensionEnabled = true;
      initializeExtension();
      sendResponse({ success: true });
      break;
    }

    case 'DISABLE_EXTENSION': {
      isExtensionEnabled = false;
      overlay?.destroy();
      overlay = null;
      sendResponse({ success: true });
      break;
    }

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }

  return true; // Keep the message channel open for async responses
});

/**
 * Speaks text using the Web Speech API
 */
function speak(text: string): Promise<void> {
  return new Promise((resolve) => {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0; // Normal speed
    utterance.pitch = 1.0; // Normal pitch
    utterance.volume = 1.0; // Full volume

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Plays a beep sound
 */
function playBeep() {
  const audioContext = new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.value = 800; // Frequency in Hz
  oscillator.type = 'sine';

  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.2);
}

/**
 * Starts speech recognition and returns the recognized text
 */
function startSpeechRecognition(): Promise<string> {
  return new Promise((resolve, reject) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      reject(new Error('Speech recognition not supported'));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      resolve(transcript);
    };

    recognition.onerror = (event: any) => {
      reject(new Error(event.error));
    };

    recognition.onend = () => {
      // If no result was captured, resolve with empty string
      resolve('');
    };

    recognition.start();
    showNotification('Listening... Press Enter when done speaking');
  });
}

/**
 * Shows a temporary notification overlay on the page
 */
function showNotification(message: string, duration = 3000) {
  // Remove any existing notification
  const existingNotification = document.getElementById('hiya-notification');
  if (existingNotification) {
    existingNotification.remove();
  }

  // Create notification element
  const notification = document.createElement('div');
  notification.id = 'hiya-notification';
  notification.textContent = message;

  // Style the notification
  Object.assign(notification.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    backgroundColor: '#4F46E5',
    color: 'white',
    padding: '12px 20px',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    zIndex: '999999',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '500',
    maxWidth: '300px',
    animation: 'hiya-slide-in 0.3s ease-out',
  });

  // Add animation keyframes
  if (!document.getElementById('hiya-notification-styles')) {
    const style = document.createElement('style');
    style.id = 'hiya-notification-styles';
    style.textContent = `
      @keyframes hiya-slide-in {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes hiya-slide-out {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(notification);

  // Auto-remove after duration
  setTimeout(() => {
    notification.style.animation = 'hiya-slide-out 0.3s ease-out';
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, duration);
}

// Listen for keyboard shortcuts
document.addEventListener('keydown', (event) => {
  // Alt+V to toggle overlay
  if (event.altKey && event.key.toLowerCase() === 'v') {
    event.preventDefault();
    overlay?.toggle();
  }
});

/**
 * Handler functions for overlay events
 */
async function handleNextField() {
  const field = formDetector.nextField();
  updateOverlayCurrentField();
  if (field) {
    showNotification(`Now at: ${field.label}`);
    await speak(field.label);

    // Only trigger voice input for text fields (not radio, checkbox, etc.)
    if (field.type === 'text' || field.type === 'email' || field.type === 'phone' || field.type === 'textarea') {
      playBeep();

      try {
        const transcript = await startSpeechRecognition();
        if (transcript) {
          formDetector.fillCurrentField(transcript);
          showNotification(`Filled: ${transcript}`);
          await speak(`Filled with: ${transcript}`);
        }
      } catch (error) {
        console.error('[Hiya] Speech recognition error:', error);
        showNotification('Speech recognition failed');
      }
    }
  }
}

async function handlePreviousField() {
  const field = formDetector.previousField();
  updateOverlayCurrentField();
  if (field) {
    showNotification(`Now at: ${field.label}`);
    await speak(field.label);

    // Only trigger voice input for text fields (not radio, checkbox, etc.)
    if (field.type === 'text' || field.type === 'email' || field.type === 'phone' || field.type === 'textarea') {
      playBeep();

      try {
        const transcript = await startSpeechRecognition();
        if (transcript) {
          formDetector.fillCurrentField(transcript);
          showNotification(`Filled: ${transcript}`);
          await speak(`Filled with: ${transcript}`);
        }
      } catch (error) {
        console.error('[Hiya] Speech recognition error:', error);
        showNotification('Speech recognition failed');
      }
    }
  }
}

async function handleJumpToUnfilled() {
  const field = formDetector.goToFirstUnfilledRequired();
  updateOverlayCurrentField();
  if (field) {
    showNotification(`Jumped to: ${field.label}`);
    await speak(field.label);

    // Only trigger voice input for text fields (not radio, checkbox, etc.)
    if (field.type === 'text' || field.type === 'email' || field.type === 'phone' || field.type === 'textarea') {
      playBeep();

      try {
        const transcript = await startSpeechRecognition();
        if (transcript) {
          formDetector.fillCurrentField(transcript);
          showNotification(`Filled: ${transcript}`);
          await speak(`Filled with: ${transcript}`);
        }
      } catch (error) {
        console.error('[Hiya] Speech recognition error:', error);
        showNotification('Speech recognition failed');
      }
    }
  } else {
    showNotification('All required fields are filled!');
    await speak('All required fields are filled!');
  }
}

function handleToggleVoice() {
  // TODO: Implement voice recognition
  showNotification('Voice control coming soon!');
  console.log('[Hiya] Voice toggle clicked');
}

/**
 * Updates the overlay with current field information
 */
function updateOverlayCurrentField() {
  if (!overlay) return;

  const currentField = formDetector.getCurrentField();
  const currentIndex = formDetector.getCurrentFieldIndex();
  const totalFields = formDetector.getFields().length;

  overlay.updateCurrentField(currentField, currentIndex, totalFields);

  // Also update form status (in case values changed)
  const formInfo = {
    fields: formDetector.getFields(),
    formElement: null,
    ...formDetector.getFormState(),
  };
  overlay.updateFormStatus(formInfo);
}

export {};
