import type { Message } from '../types/messages';

console.log('[Hiya] Background service worker loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Hiya] Extension installed');
    // Open welcome page or set default settings
    chrome.storage.local.set({
      templates: [],
      settings: {
        voiceEnabled: true,
        ttsEnabled: true,
      },
    });
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  console.log('[Hiya] Command received:', command);

  if (command === 'toggle-voice') {
    // Send message to active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_VOICE' });
      }
    });
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message: Message, _sender, _sendResponse) => {
  console.log('[Hiya] Background received message:', message);

  switch (message.type) {
    case 'TOGGLE_VOICE':
      // Forward to active tab's content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_VOICE' });
        }
      });
      break;

    default:
      console.log('[Hiya] Unknown message type:', message.type);
  }

  return true;
});

export {};
