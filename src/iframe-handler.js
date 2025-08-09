// Iframe handler for text replacement functionality
// This script is injected into iframes to handle text replacement

(function() {
  // Check if already initialized to prevent duplicate injection
  if (window.handyIframeHandlerInitialized) {
    return;
  }
  window.handyIframeHandlerInitialized = true;

  let replacements = {};
  let enabled = true;
  let universalReplacer = null;
  let observer = null;

  // Load data from parent window
  const loadData = () => {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: 'HANDY_GET_DATA',
          source: 'handy_iframe_handler'
        }, '*');
      }
    } catch (error) {
      // Parent window not accessible
    }
  };

  // Listen for messages from parent window
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'HANDY_DATA_UPDATE') {
      replacements = event.data.replacements || {};
      enabled = event.data.enabled !== undefined ? event.data.enabled : true;
      
      if (!universalReplacer && typeof UniversalReplacer !== 'undefined') {
        universalReplacer = new UniversalReplacer(new Map(Object.entries(replacements)), enabled);
      } else if (universalReplacer) {
        universalReplacer.updateReplacements(new Map(Object.entries(replacements)));
        universalReplacer.updateEnabled(enabled);
      }
    }
  });

  // Setup event listeners for iframe
  const setupIframeEventListeners = (retryCount = 0) => {
    if (!universalReplacer || typeof UniversalReplacer === 'undefined') {
      if (retryCount < 50) {
        setTimeout(() => setupIframeEventListeners(retryCount + 1), 100);
      }
      return;
    }

    // Standard input event listener
    const inputHandler = (e) => {
      if (universalReplacer) {
        universalReplacer.handleInput(e);
      }
    };
    document.addEventListener('input', inputHandler, true);
    
    // Keydown event for better trigger detection
    const keydownHandler = (e) => {
      if (e.key === ' ' || e.key === '.' || e.key === ',' || e.key === ';' || e.key === '!' || e.key === '?') {
        if (e.isTrusted === false) {
          return;
        }
        
        setTimeout(() => {
          const inputEvent = new Event('input', { bubbles: true });
          inputEvent.isTrusted = false;
          e.target.dispatchEvent(inputEvent);
          universalReplacer.handleInput(inputEvent);
        }, 10);
      }
    };
    document.addEventListener('keydown', keydownHandler, true);
    
    // Mutation observer for dynamic content
    observer = new MutationObserver((mutations) => {
      const relevantMutations = mutations.filter(mutation => 
        mutation.type === 'childList' && mutation.addedNodes.length > 0
      );
      
      if (relevantMutations.length === 0) return;
      
      relevantMutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if new editable elements were added
            const editableElements = node.querySelectorAll ? Array.from(node.querySelectorAll('[contenteditable="true"], textarea, input[type="text"]')) : [];
            if (node.matches && node.matches('[contenteditable="true"], textarea, input[type="text"]')) {
              editableElements.push(node);
            }
          }
        });
      });
    });
    
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  };

  // Cleanup function
  const cleanup = () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (universalReplacer && universalReplacer.debounceTimer) {
      clearTimeout(universalReplacer.debounceTimer);
    }
  };

  // Initialize iframe handler
  const initializeIframeHandler = () => {
    loadData();
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupIframeEventListeners);
    } else {
      setupIframeEventListeners();
    }
    
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'HANDY_IFRAME_READY',
        source: 'handy_iframe_handler',
        url: window.location.href
      }, '*');
    }
    
    window.addEventListener('beforeunload', cleanup);
  };

  // Start the iframe handler
  initializeIframeHandler();
})();
