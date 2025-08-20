// Handy content script for text replacement functionality
// Check if already initialized to prevent duplicate declarations
if (typeof window.handyInitialized === 'undefined') {
  window.handyInitialized = true;
  
  let eventListenersSetup = false;
  let replacements = {};
  let enabled = false;
  let universalReplacer = null;
  let observers = [];
  let eventListeners = [];
  let iframeInjectionInterval = null;

  // Load replacements and enabled state from storage
  const loadData = () => {
    chrome.storage.sync.get(['replacements', 'textReplacementEnabled', 'enabled'], (data) => {
      replacements = data.replacements || {};
      const textReplacementEnabled = data.textReplacementEnabled === undefined ? false : data.textReplacementEnabled;
      const mainExtensionEnabled = data.enabled === undefined ? true : data.enabled;
      
      enabled = textReplacementEnabled && mainExtensionEnabled;
      
      const UniversalReplacerClass = typeof UniversalReplacer !== 'undefined' ? UniversalReplacer : 
                                     (typeof window !== 'undefined' && window.UniversalReplacer) ? window.UniversalReplacer : null;
      
      if (!universalReplacer && UniversalReplacerClass) {
        universalReplacer = new UniversalReplacerClass(new Map(Object.entries(replacements)), enabled);
      } else if (universalReplacer) {
        universalReplacer.updateReplacements(new Map(Object.entries(replacements)));
        universalReplacer.updateEnabled(enabled);
      }
    });
  };

  // Listen for changes to storage
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
      if (changes.textReplacementEnabled || changes.replacements || changes.enabled) {
        loadData();
      }
    }
  });

  // Enhanced event listener setup with universal approach
  const setupEventListeners = () => {
    if (eventListenersSetup) {
      return;
    }
    
    try {
      const inputHandler = (e) => {
        if (universalReplacer && enabled) {
          universalReplacer.handleInput(e);
        }
      };
      document.addEventListener('input', inputHandler, true);
      eventListeners.push({ element: document, type: 'input', handler: inputHandler, useCapture: true });
      
      const keydownHandler = (e) => {
        if (e.key === ' ' || e.key === '.' || e.key === ',' || e.key === ';' || e.key === '!' || e.key === '?') {
          if (e.isTrusted === false) {
            return;
          }
          
          setTimeout(() => {
            if (universalReplacer && enabled) {
              const inputEvent = new Event('input', { bubbles: true });
              inputEvent.isTrusted = false;
              e.target.dispatchEvent(inputEvent);
              universalReplacer.handleInput(inputEvent);
            }
          }, 10);
        }
      };
      document.addEventListener('keydown', keydownHandler, true);
      eventListeners.push({ element: document, type: 'keydown', handler: keydownHandler, useCapture: true });
      
      const observer = new MutationObserver((mutations) => {
        try {
          const relevantMutations = mutations.filter(mutation => 
            mutation.type === 'childList' && 
            (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)
          );
          
          if (relevantMutations.length === 0) return;
          
          relevantMutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const editableElements = node.querySelectorAll ? Array.from(node.querySelectorAll('[contenteditable="true"], textarea, input[type="text"]')) : [];
                if (node.matches && node.matches('[contenteditable="true"], textarea, input[type="text"]')) {
                  editableElements.push(node);
                }

                const iframes = node.querySelectorAll ? Array.from(node.querySelectorAll('iframe')) : [];
                if (node.tagName === 'IFRAME') {
                  iframes.push(node);
                }
                
                iframes.forEach(iframe => {
                  injectIntoIframe(iframe);
                });
              }
            });
          });
        } catch (error) {
          // Mutation observer error
        }
      });
      
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
        observers.push(observer);
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          observer.observe(document.body, { childList: true, subtree: true });
          observers.push(observer);
        });
      }
      
      eventListenersSetup = true;
    } catch (error) {
      // Event listener setup failed
    }
  };

  // Inject content script into iframe
  const injectIntoIframe = (iframe) => {
    try {
      // Skip if iframe is already processed
      if (iframe.dataset.handyProcessed) {
        return;
      }
      
      const currentScript = document.currentScript || document.querySelector('script[src*="handy-content.js"]');
      let extensionId = '';
      
      if (currentScript && currentScript.src) {
        const match = currentScript.src.match(/chrome-extension:\/\/([^\/]+)/);
        if (match) {
          extensionId = match[1];
        }
      }
      
      if (!extensionId && chrome && chrome.runtime && chrome.runtime.id) {
        extensionId = chrome.runtime.id;
      }
      
      if (!extensionId) {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
          extensionId = chrome.runtime.id;
        }
        
        if (!extensionId) {
          return;
        }
      }
      
      // Mark iframe as processed to prevent duplicate injection
      iframe.dataset.handyProcessed = 'true';
      
      setTimeout(() => {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          if (iframeDoc && iframeDoc.readyState !== 'loading') {
            if (iframeDoc.querySelector('script[data-handy-iframe-handler]')) {
              return;
            }

            if (iframeDoc.defaultView && iframeDoc.defaultView.UniversalReplacer) {
              const handlerScript = iframeDoc.createElement('script');
              handlerScript.src = `chrome-extension://${extensionId}/src/iframe-handler.js`;
              handlerScript.setAttribute('data-handy-iframe-handler', 'true');
              iframeDoc.head.appendChild(handlerScript);
              return;
            }

            const replacerScript = iframeDoc.createElement('script');
            replacerScript.src = `chrome-extension://${extensionId}/src/universal-replacement.js`;
            replacerScript.onload = () => {
              const handlerScript = iframeDoc.createElement('script');
              handlerScript.src = `chrome-extension://${extensionId}/src/iframe-handler.js`;
              handlerScript.setAttribute('data-handy-iframe-handler', 'true');
              iframeDoc.head.appendChild(handlerScript);
            };
            iframeDoc.head.appendChild(replacerScript);
          }
        } catch (error) {
          // Cross-origin iframe, can't access - remove the processed flag
          delete iframe.dataset.handyProcessed;
        }
      }, 1000);
    } catch (error) {
      // Iframe not accessible - remove the processed flag
      if (iframe.dataset) {
        delete iframe.dataset.handyProcessed;
      }
    }
  };

  // Setup message passing for iframe communication
  const setupMessagePassing = () => {
    const messageHandler = (event) => {
      if (event.data && (event.data.source === 'handy_iframe' || event.data.source === 'handy_iframe_handler')) {
        if (event.data.type === 'HANDY_GET_DATA') {
          event.source.postMessage({
            type: 'HANDY_DATA_UPDATE',
            source: 'handy_parent',
            replacements: replacements,
            enabled: enabled
          }, '*');
        } else if (event.data.type === 'HANDY_IFRAME_READY') {
          // Iframe ready
        }
      }
    };
    
    window.addEventListener('message', messageHandler);
    eventListeners.push({ element: window, type: 'message', handler: messageHandler, useCapture: false });

    const notifyIframes = () => {
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        try {
          iframe.contentWindow.postMessage({
            type: 'HANDY_DATA_UPDATE',
            source: 'handy_parent',
            replacements: replacements,
            enabled: enabled
          }, '*');
        } catch (error) {
          // Cross-origin iframe, can't access
        }
      });
    };

    window.handyNotifyIframes = notifyIframes;
  };

  // Cleanup function
  const cleanup = () => {
    eventListeners.forEach(({ element, type, handler, useCapture }) => {
      try {
        element.removeEventListener(type, handler, useCapture);
      } catch (error) {
        // Silently handle errors
      }
    });
    eventListeners = [];
    
    observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (error) {
        // Silently handle errors
      }
    });
    observers = [];
    
    if (iframeInjectionInterval) {
      clearInterval(iframeInjectionInterval);
      iframeInjectionInterval = null;
    }
    
    eventListenersSetup = false;
  };

  // Initialize the content script
  const initialize = () => {
    const waitForUniversalReplacer = () => {
      if (typeof UniversalReplacer !== 'undefined' || (typeof window !== 'undefined' && window.UniversalReplacer)) {
        loadData();
        setupEventListeners();
        setupMessagePassing();
        injectIntoExistingIframes();
        startIframeMonitoring();
      } else {
        const setupWithRetry = (retryCount = 0) => {
          if (retryCount > 50) {
            return;
          }
          
          setTimeout(() => {
            if (typeof UniversalReplacer !== 'undefined' || (typeof window !== 'undefined' && window.UniversalReplacer)) {
              loadData();
              setupEventListeners();
              setupMessagePassing();
              injectIntoExistingIframes();
              startIframeMonitoring();
            } else {
              setupWithRetry(retryCount + 1);
            }
          }, 100);
        };
        
        setupWithRetry();
      }
    };
    
    waitForUniversalReplacer();
  };

  // Inject into existing iframes
  const injectIntoExistingIframes = () => {
    try {
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        injectIntoIframe(iframe);
      });
    } catch (error) {
      // Error injecting into existing iframes
    }
  };

  // Start iframe monitoring
  const startIframeMonitoring = () => {
    if (iframeInjectionInterval) {
      clearInterval(iframeInjectionInterval);
    }
    
    iframeInjectionInterval = setInterval(() => {
      try {
        const iframes = document.querySelectorAll('iframe:not([data-handy-processed])');
        if (iframes.length > 0) {
          iframes.forEach(iframe => {
            injectIntoIframe(iframe);
          });
        }
      } catch (error) {
        console.warn('[MerakiExt] Error monitoring iframes:', error);
      }
    }, 5000);
  };

  // Start the content script
  initialize();

  // Cleanup on page unload
  window.addEventListener('beforeunload', cleanup);
}
