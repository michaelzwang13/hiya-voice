console.log('[Clara] Popup script loaded');

// Get DOM elements
const extensionToggle = document.getElementById('extension-toggle') as HTMLInputElement;
const statusText = document.getElementById('status-text') as HTMLSpanElement;
const toggleSection = document.querySelector('.toggle-section') as HTMLDivElement;

// Load saved state
chrome.storage.local.get(['extensionEnabled'], (result) => {
  const isEnabled = result.extensionEnabled !== false; // Default to true
  extensionToggle.checked = isEnabled;
  updateStatus(isEnabled);
});

// Toggle event listener
extensionToggle.addEventListener('change', async () => {
  const isEnabled = extensionToggle.checked;

  // Save state
  await chrome.storage.local.set({ extensionEnabled: isEnabled });

  // Update UI
  updateStatus(isEnabled);

  // Notify content script
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      await chrome.tabs.sendMessage(tab.id, {
        type: isEnabled ? 'ENABLE_EXTENSION' : 'DISABLE_EXTENSION',
      });
    }
  } catch (error) {
    console.log('[Clara] Could not send message to content script:', error);
  }
});

/**
 * Updates the status text and styling
 */
function updateStatus(isEnabled: boolean) {
  statusText.textContent = isEnabled ? 'Enabled' : 'Disabled';

  if (isEnabled) {
    toggleSection.classList.remove('disabled');
  } else {
    toggleSection.classList.add('disabled');
  }
}

export {};
