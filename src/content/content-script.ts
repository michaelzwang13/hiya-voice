import { FormDetector } from '../utils/form-detector';
import type { Message } from '../types/messages';

console.log('[Hiya] Content script loaded');

const formDetector = new FormDetector();

// Detect forms when the page loads
window.addEventListener('load', () => {
  const formInfo = formDetector.detectForms();
  console.log('[Hiya] Form detection complete:', formInfo);

  // Show a subtle notification if forms are detected
  if (formInfo.totalFields > 0) {
    showNotification(`Detected ${formInfo.totalFields} form fields. Press Alt+V to start voice assistance.`);
  }
});

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
        sendResponse({ success: true, field });
      } else {
        showNotification('All required fields are filled!');
        sendResponse({ success: false, message: 'All required fields filled' });
      }
      break;
    }

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }

  return true; // Keep the message channel open for async responses
});

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
  // Alt+V to toggle voice
  if (event.altKey && event.key.toLowerCase() === 'v') {
    event.preventDefault();
    showNotification('Voice assistant activated!');
    chrome.runtime.sendMessage({ type: 'TOGGLE_VOICE' });
  }
});

export {};
