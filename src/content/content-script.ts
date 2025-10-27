import { FormDetector } from '../utils/form-detector';
import { VoiceAssistantOverlay } from '../components/overlay';
import type { Message } from '../types/messages';
import type { InsertPhrase } from '../types/form';

console.log('[Clara] Content script loaded');

const formDetector = new FormDetector();
let overlay: VoiceAssistantOverlay | null = null;
let isExtensionEnabled = true;
let activeRecognition: any = null; // Track active speech recognition
let insertPhrases: InsertPhrase[] = []; // Store insert phrases

// Check if extension is enabled and load insert phrases
chrome.storage.local.get(['extensionEnabled', 'insertPhrases'], (result) => {
  isExtensionEnabled = result.extensionEnabled !== false; // Default to true
  insertPhrases = result.insertPhrases || [];

  if (isExtensionEnabled) {
    initializeExtension();
  }
});

// Detect forms when the page loads
window.addEventListener('load', async () => {
  if (!isExtensionEnabled) return;
  await refreshFormDetection();
});

// Detect URL changes (for single-page apps like multi-page forms)
let lastUrl = location.href;
new MutationObserver(async () => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    console.log('[Clara] URL changed, refreshing form detection');
    await refreshFormDetection();
  }
}).observe(document, { subtree: true, childList: true });

// Also listen for popstate events (back/forward navigation)
window.addEventListener('popstate', async () => {
  console.log('[Clara] Navigation detected (popstate), refreshing form detection');
  await refreshFormDetection();
});

/**
 * Refreshes form detection and updates the overlay
 */
async function refreshFormDetection() {
  if (!isExtensionEnabled) return;

  const formInfo = formDetector.detectForms();
  console.log('[Clara] Form detection complete:', formInfo);

  if (overlay) {
    overlay.updateFormStatus(formInfo);

    // Don't auto-navigate to first field, just show welcome message
    if (formInfo.totalFields > 0) {
      await speak('Welcome to Clara Voice. Press Control V to start filling the form.');
    }
  }
}

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
  overlay.onAddPhrase = handleAddPhrase;
  overlay.onDeletePhrase = handleDeletePhrase;

  // Update phrases list
  overlay.updatePhrasesList(insertPhrases);

  // Detect forms if page already loaded
  if (document.readyState === 'complete') {
    refreshFormDetection();
  }
}

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  console.log('[Clara] Received message:', message);

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
 * Check if a field type should trigger voice input
 */
function shouldUseVoiceInput(fieldType: string): boolean {
  const voiceInputTypes = [
    'text', 'email', 'phone', 'number', 'url', 'textarea',
    'name', 'firstName', 'lastName', 'address', 'city',
    'state', 'zip', 'country', 'company', 'jobTitle'
  ];
  return voiceInputTypes.includes(fieldType);
}

/**
 * Handle voice input for a specific field
 */
async function handleVoiceInputForField(field: any) {
  // Handle radio and checkbox groups with option selection
  if (field.type === 'radio' || field.type === 'checkbox') {
    console.log('[Clara] Radio/Checkbox field detected, reading options');

    // Read out all options
    if (field.options && field.options.length > 0) {
      for (let i = 0; i < field.options.length; i++) {
        await speak(`Option ${i + 1}: ${field.options[i]}`);
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Wait before starting recognition
      await new Promise(resolve => setTimeout(resolve, 500));
      playBeep();
      await new Promise(resolve => setTimeout(resolve, 300));

      try {
        await speak('Say the option number');
        await new Promise(resolve => setTimeout(resolve, 500));

        const transcript = await startSpeechRecognition();
        console.log('[Clara] Transcript received:', transcript);

        if (transcript) {
          // Parse number from transcript (handle "one", "1", "option 1", etc.)
          const numberMatch = transcript.match(/\d+/);
          const wordToNumber: {[key: string]: number} = {
            'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
            'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
          };

          let selectedIndex = -1;
          if (numberMatch) {
            selectedIndex = parseInt(numberMatch[0]) - 1;
          } else {
            // Try to match word numbers
            const lowerTranscript = transcript.toLowerCase();
            for (const [word, num] of Object.entries(wordToNumber)) {
              if (lowerTranscript.includes(word)) {
                selectedIndex = num - 1;
                break;
              }
            }
          }

          if (selectedIndex >= 0 && selectedIndex < field.options.length) {
            const selectedOption = field.options[selectedIndex];
            formDetector.fillCurrentField(selectedOption);
            showNotification(`Selected: ${selectedOption}`);
            await speak(`Selected ${selectedOption}`);
          } else {
            showNotification('Invalid option number');
            await speak('Invalid option number');
          }
        }
      } catch (error) {
        console.error('[Clara] Speech recognition error:', error);
        showNotification('Speech recognition failed');
      }
    }
  }
  // Only trigger voice input for text-like fields
  else if (shouldUseVoiceInput(field.type)) {
    console.log('[Clara] Text field detected, starting voice input. Type:', field.type);
    // Wait a bit to ensure TTS is completely done and audio buffer is clear
    await new Promise(resolve => setTimeout(resolve, 500));

    playBeep();

    // Small delay after beep before starting recognition
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      console.log('[Clara] Starting speech recognition');
      const transcript = await startSpeechRecognition();
      console.log('[Clara] Transcript received:', transcript);
      if (transcript) {
        // Check if this is an "insert" command
        const insertMatch = transcript.toLowerCase().match(/^insert\s+(.+)$/);
        if (insertMatch) {
          const phraseName = insertMatch[1].trim();
          const phrase = findInsertPhrase(phraseName);

          if (phrase) {
            formDetector.fillCurrentField(phrase.content);
            showNotification(`Inserted phrase: ${phrase.name}`);
            await speak(`Inserted ${phrase.name}`);
          } else {
            showNotification(`Phrase "${phraseName}" not found`);
            await speak(`Phrase ${phraseName} not found. Please add it first.`);
          }
        } else {
          // Regular text input
          formDetector.fillCurrentField(transcript);
          showNotification(`Filled: ${transcript}`);
          await speak(`Filled with: ${transcript}`);
        }
      }
    } catch (error) {
      console.error('[Clara] Speech recognition error:', error);
      showNotification('Speech recognition failed');
    }
  } else {
    console.log('[Clara] Unsupported field type:', field.type);
  }
}

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
    // Cancel any existing recognition first
    if (activeRecognition) {
      try {
        activeRecognition.abort();
      } catch (e) {
        // Ignore errors when aborting
      }
      activeRecognition = null;
    }

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
      activeRecognition = null;
      resolve(transcript);
    };

    recognition.onerror = (event: any) => {
      activeRecognition = null;
      reject(new Error(event.error));
    };

    recognition.onend = () => {
      // If no result was captured, resolve with empty string
      activeRecognition = null;
      resolve('');
    };

    activeRecognition = recognition;
    recognition.start();
    showNotification('Listening... Press Enter when done speaking');
  });
}

/**
 * Shows a temporary notification overlay on the page
 */
function showNotification(message: string, duration = 3000) {
  // Remove any existing notification
  const existingNotification = document.getElementById('clara-notification');
  if (existingNotification) {
    existingNotification.remove();
  }

  // Create notification element
  const notification = document.createElement('div');
  notification.id = 'clara-notification';
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
    animation: 'clara-slide-in 0.3s ease-out',
  });

  // Add animation keyframes
  if (!document.getElementById('clara-notification-styles')) {
    const style = document.createElement('style');
    style.id = 'clara-notification-styles';
    style.textContent = `
      @keyframes clara-slide-in {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes clara-slide-out {
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
    notification.style.animation = 'clara-slide-out 0.3s ease-out';
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, duration);
}

// Listen for keyboard shortcuts
document.addEventListener('keydown', async (event) => {
  if (!isExtensionEnabled) return;

  // Control+V (or Command+V on Mac) to start voice filling (jump to first field)
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v' && !event.shiftKey) {
    event.preventDefault();

    // Get current field to check if we're already on a field
    const currentField = formDetector.getCurrentField();
    const currentIndex = formDetector.getCurrentFieldIndex();

    console.log('[Clara] Ctrl+V pressed. Current field:', currentField, 'Index:', currentIndex);

    if (currentIndex === -1 || !currentField) {
      // Not on any field yet, go to first field
      console.log('[Clara] Navigating to first field');
      await handleNextField();
    }
  }

  // Control+B (or Command+B on Mac) to toggle sidebar visibility
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b' && !event.shiftKey) {
    event.preventDefault();
    console.log('[Clara] Ctrl+B pressed - toggling overlay');
    overlay?.toggle();
  }

  // Control+Shift+R (or Command+Shift+R on Mac) to manually refresh form detection
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'r') {
    event.preventDefault();
    console.log('[Clara] Manual refresh triggered');
    showNotification('Refreshing form detection...');
    await refreshFormDetection();
    showNotification('Form detection refreshed!');
  }

  // Control+Shift+J or (Command+Shift+J on Mac) to jump to next unfilled form
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'j') {[
    
  ]}

  // Arrow keys for navigation (only when we have a current field)
  const currentIndex = formDetector.getCurrentFieldIndex();
  if (currentIndex !== -1) {
    // Right arrow: Next field
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      console.log('[Clara] Arrow Right pressed - navigating to next field');
      await handleNextField();
    }

    // Left arrow: Previous field
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      console.log('[Clara] Arrow Left pressed - navigating to previous field');
      await handlePreviousField();
    }
  }
});

/**
 * Handler functions for overlay events
 */
async function handleNextField() {
  console.log('[Clara] handleNextField called');
  const field = formDetector.nextField();
  console.log('[Clara] Next field:', field);
  updateOverlayCurrentField();
  if (field) {
    showNotification(`Now at: ${field.label}`);
    console.log('[Clara] Speaking field label:', field.label);
    await speak(field.label);
    await handleVoiceInputForField(field);
  } else {
    console.log('[Clara] No field returned from nextField()');
  }
}

async function handlePreviousField() {
  const field = formDetector.previousField();
  updateOverlayCurrentField();
  if (field) {
    showNotification(`Now at: ${field.label}`);
    await speak(field.label);
    await handleVoiceInputForField(field);
  }
}

async function handleJumpToUnfilled() {
  const field = formDetector.goToFirstUnfilledRequired();
  updateOverlayCurrentField();
  if (field) {
    showNotification(`Jumped to: ${field.label}`);
    await speak(field.label);
    await handleVoiceInputForField(field);
  } else {
    showNotification('All required fields are filled!');
    await speak('All required fields are filled!');
  }
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

/**
 * Handles adding a new insert phrase
 */
function handleAddPhrase(name: string, content: string) {
  const newPhrase: InsertPhrase = {
    id: Date.now().toString(),
    name: name.toLowerCase(), // Store in lowercase for easier matching
    content
  };

  insertPhrases.push(newPhrase);

  // Save to chrome storage
  chrome.storage.local.set({ insertPhrases }, () => {
    console.log('[Clara] Phrase added:', newPhrase);
    overlay?.updatePhrasesList(insertPhrases);
    showNotification(`Phrase "${name}" added!`);
  });
}

/**
 * Handles deleting an insert phrase
 */
function handleDeletePhrase(id: string) {
  insertPhrases = insertPhrases.filter(phrase => phrase.id !== id);

  // Save to chrome storage
  chrome.storage.local.set({ insertPhrases }, () => {
    console.log('[Clara] Phrase deleted:', id);
    overlay?.updatePhrasesList(insertPhrases);
    showNotification('Phrase deleted');
  });
}

/**
 * Finds an insert phrase by name (case-insensitive)
 */
function findInsertPhrase(name: string): InsertPhrase | undefined {
  const normalizedName = name.toLowerCase().trim();
  return insertPhrases.find(phrase => phrase.name === normalizedName);
}

export {};
