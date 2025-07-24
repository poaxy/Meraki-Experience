// Background

const DEFAULT_STATE = { enabled: true };

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set(DEFAULT_STATE);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STATE') {
    chrome.storage.sync.get(['enabled'], (result) => {
      sendResponse({ enabled: result.enabled !== false });
    });
    return true; // async
  }
  if (message.type === 'SET_STATE') {
    chrome.storage.sync.set({ enabled: message.enabled });
    sendResponse({ success: true });
    return true;
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('.meraki.com/')) {
    chrome.storage.sync.get(['enabled'], (result) => {
      chrome.tabs.sendMessage(tabId, { type: 'EXT_STATE', enabled: result.enabled !== false }, (response) => {
        if (chrome.runtime.lastError) {
          // no content script
        }
      });
    });
  }
});
