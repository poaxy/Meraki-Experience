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
    
    // Send the state change to all tabs for text replacement functionality
    chrome.tabs.query({}, (tabs) => {
      const messagePromises = tabs
        .filter(tab => tab.id && tab.url && tab.url.includes('.meraki.com'))
        .map(tab => {
          return new Promise((resolve) => {
            chrome.tabs.sendMessage(tab.id, { type: 'EXT_STATE', enabled: message.enabled }, () => {
              if (chrome.runtime.lastError) {
                // Suppress 'Could not establish connection' errors
                console.debug(`[MerakiExt] Could not send message to tab ${tab.id}:`, chrome.runtime.lastError.message);
              }
              resolve();
            });
          });
        });
      
      // Wait for all messages to be sent
      Promise.all(messagePromises).catch(error => {
        console.warn('[MerakiExt] Error sending messages to tabs:', error);
      });
    });
    
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'HANDY_IFRAME_REQUEST') {
    // Inject content script into the requesting tab
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      files: ['src/handy-content.js']
    }).then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      console.error('[MerakiExt] Error injecting handy-content.js:', error);
      sendResponse({ success: false, error: error.message });
    });
    
    return true; // Keep message channel open for async response
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('.meraki.com/')) {
    chrome.storage.sync.get(['enabled'], (result) => {
      chrome.tabs.sendMessage(tabId, { type: 'EXT_STATE', enabled: result.enabled !== false }, (response) => {
        if (chrome.runtime.lastError) {
          // no content script - this is normal for new tabs
          console.debug(`[MerakiExt] No content script in tab ${tabId} yet`);
        }
      });
    });
  }
});
