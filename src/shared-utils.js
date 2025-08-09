// Shared utilities for text replacement functionality
// Common functions used by both content.js and iframe-content.js

// Common replacement strategies
const ReplacementStrategies = {
  // Standard contenteditable replacement
  contentEditable: (target, keyword, replacement, triggerChar) => {
    try {
      const selection = window.getSelection();
      if (!selection.rangeCount) return false;

      const range = selection.getRangeAt(0);
      const textNode = range.startContainer;

      if (textNode.nodeType === Node.TEXT_NODE) {
        const originalText = textNode.textContent;
        const textToReplace = keyword + triggerChar;
        
        if (originalText.endsWith(textToReplace)) {
          const newTextNodeValue = originalText.substring(0, originalText.length - textToReplace.length) + replacement + triggerChar;
          
          // For contenteditable elements, use innerHTML to preserve formatting
          if (target.isContentEditable) {
            const currentHTML = target.innerHTML;
            const newHTML = currentHTML.substring(0, currentHTML.length - textToReplace.length) + replacement.replace(/\n/g, '<br>') + triggerChar;
            target.innerHTML = newHTML;
            
            // Move cursor to end
            const newRange = document.createRange();
            newRange.selectNodeContents(target);
            newRange.collapse(false);
            selection.removeAllRanges();
            selection.addRange(newRange);
          } else {
            textNode.textContent = newTextNodeValue;
            
            // Move the cursor to the end
            range.setStart(textNode, newTextNodeValue.length);
            range.setEnd(textNode, newTextNodeValue.length);
            selection.removeAllRanges();
            selection.addRange(range);
          }
          return true;
        }
      }
    } catch (error) {
      // Contenteditable replacement failed
    }
    return false;
  },

  // Standard input/textarea replacement
  input: (target, keyword, replacement, triggerChar) => {
    try {
      const cursorPosition = target.selectionStart;
      const text = target.value;
      const textToReplace = keyword + triggerChar;
      
      if (text.endsWith(textToReplace)) {
        const newText = text.substring(0, text.length - textToReplace.length) + replacement + triggerChar;
        target.value = newText;

        // Restore cursor position
        const newCursorPosition = cursorPosition - textToReplace.length + (replacement.length + 1);
        target.setSelectionRange(newCursorPosition, newCursorPosition);
        return true;
      }
    } catch (error) {
      // Input replacement failed
    }
    return false;
  },

  // Document-level replacement as last resort
  document: (keyword, replacement, triggerChar) => {
    try {
      const selection = window.getSelection();
      if (selection && selection.toString().endsWith(keyword + triggerChar)) {
        const range = selection.getRangeAt(0);
        const textToReplace = keyword + triggerChar;
        
        // Create a new text node with the replacement
        const newTextNode = document.createTextNode(replacement + triggerChar);
        
        // Replace the selected content
        range.deleteContents();
        range.insertNode(newTextNode);
        
        // Move cursor to end
        range.setStartAfter(newTextNode);
        range.setEndAfter(newTextNode);
        selection.removeAllRanges();
        selection.addRange(range);
        return true;
      }
    } catch (error) {
      // Document replacement failed
    }
    return false;
  }
};

// Create input handler with replacement strategies
const createInputHandler = (replacements, enabled, additionalStrategies = []) => {
  return (event) => {
    if (!enabled || !event || !event.target) return;
    
    const target = event.target;
    
    // Skip password fields and non-text inputs
    if (target.type === 'password' || 
        (target.tagName === 'INPUT' && !['text', 'search', 'url', 'tel', 'email'].includes(target.type))) {
      return;
    }

    let text = '';
    if (target.isContentEditable) {
      text = target.textContent || target.innerText || '';
    } else {
      text = target.value || '';
    }

    if (!text || text.length === 0) return;

    const triggerChar = text.slice(-1);
    const triggerRegex = /[\s.,;!?]/;
    
    if (triggerRegex.test(triggerChar)) {
      setTimeout(() => {
        processReplacement(target, text, triggerChar, replacements, additionalStrategies);
      }, 5);
    }
  };
};

// Process replacement using available strategies
const processReplacement = (target, text, triggerChar, replacements, additionalStrategies = []) => {
  const textBeforeCursor = text.substring(0, text.length - 1);
  
  // Find the longest matching keyword
  let longestMatch = '';
  for (const [keyword, replacement] of Object.entries(replacements)) {
    if (textBeforeCursor.endsWith(keyword) && keyword.length > longestMatch.length) {
      longestMatch = keyword;
    }
  }

  if (!longestMatch) return;

  const replacement = replacements[longestMatch];
  if (textBeforeCursor.endsWith(replacement)) return;

  // Try strategies in order
  const strategies = [
    ...additionalStrategies,
    () => ReplacementStrategies.contentEditable(target, longestMatch, replacement, triggerChar),
    () => ReplacementStrategies.input(target, longestMatch, replacement, triggerChar),
    () => ReplacementStrategies.document(longestMatch, replacement, triggerChar)
  ];

  for (const strategy of strategies) {
    try {
      if (strategy()) {
        // Dispatch input event to notify other listeners
        target.dispatchEvent(new Event('input', { bubbles: true }));
        break;
      }
    } catch (error) {
      // Strategy failed, try next one
    }
  }
};

// Setup event listeners for text replacement
const setupEventListeners = (handler, isIframe = false) => {
  // Standard input event listener
  document.addEventListener('input', handler, true);
  
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
        handler(inputEvent);
      }, 10);
    }
  };
  document.addEventListener('keydown', keydownHandler, true);
  
  // Mutation observer for dynamic content
  const observer = new MutationObserver((mutations) => {
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
        }
      });
    });
  });
  
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ReplacementStrategies,
    createInputHandler,
    processReplacement,
    setupEventListeners
  };
} else if (typeof window !== 'undefined') {
  window.HandySharedUtils = {
    ReplacementStrategies,
    createInputHandler,
    processReplacement,
    setupEventListeners
  };
}
