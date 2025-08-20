// Content script

(function () {
  const DASHBOARD_SUFFIX = ' - Meraki Dashboard';
  const MAX_RETRIES = 10;
  const RETRY_DELAY = 500;

  let enabled = true;
  let useModelMac = false;
  let enableCopyLink = false;
  let enableGreenFavicon = true;
  let enableEasyCopy = true;
  let faviconObserver = null;
  let retryCount = 0;

  function stripDashboardSuffix(title) {
    if (title.endsWith(DASHBOARD_SUFFIX)) {
      return title.slice(0, -DASHBOARD_SUFFIX.length);
    }
    return title;
  }

  function extractModelAndMacRaw() {
    const container = document.querySelector('div.react-layout#sidetabs_container');
    if (!container) return null;
    let model = null;
    let mac = null;
    const modelTestId = container.querySelector('p[data-testid="model-info"]');
    if (modelTestId && modelTestId.textContent.trim()) {
      model = modelTestId.textContent.trim();
    }
    const macTestId = container.querySelector('p[data-testid="mac-info"]');
    if (macTestId && macTestId.textContent.trim()) {
      mac = macTestId.textContent.trim();
    }
    if (!model) {
      const modelSpan = container.querySelector('span.model');
      if (modelSpan && modelSpan.textContent.trim()) {
        model = modelSpan.textContent.trim();
      }
    }
    if (!mac) {
      const macSpan = container.querySelector('span.mac');
      if (macSpan && macSpan.textContent.trim()) {
        mac = macSpan.textContent.trim();
      }
    }
    if (!model) {
      const modelP = container.querySelector('p.mds-text.mds-text-p3.mds-text-color-light.mds-text-weight-semi-bold, p.mds-text.mds-text-p3.mds-text-color-light.mds-text-weight-bold');
      if (modelP && modelP.textContent.trim()) {
        model = modelP.textContent.trim();
      } else {
        const allPs = container.querySelectorAll('p.mds-text.mds-text-p3.mds-text-color-light');
        for (const p of allPs) {
          if (p.className.includes('weight-bold') && p.textContent.trim()) {
            model = p.textContent.trim();
            break;
          }
        }
      }
    }
    if (!mac) {
      const macP = container.querySelector('p.mds-text.mds-text-p3.mds-text-weight-regular.mds-text-monospace.mds-text-color-light');
      if (macP && macP.textContent.trim()) {
        mac = macP.textContent.trim();
      }
    }
    if (model && mac) {
      let macSuffix = '';
      const macParts = mac.split(':');
      if (macParts.length > 1) {
        macSuffix = macParts[macParts.length - 1];
      } else if (mac.length >= 2) {
        macSuffix = mac.slice(-2);
      }
      return { model, macSuffix };
    }
    return null;
  }

  function extractDeviceName() {
    const container = document.querySelector('div.react-layout#sidetabs_container');
    if (!container) return null;
    const nodeTitle = container.querySelector('span.nodeTitle.notranslate');
    if (nodeTitle && nodeTitle.textContent.trim()) {
      return nodeTitle.textContent.trim();
    }
    const h1 = container.querySelector('h1.mds-heading.mds-heading-size-primary[role="heading"]');
    if (h1 && h1.textContent.trim()) {
      return h1.textContent.trim();
    }
    return null;
  }

  // Helper: check if on documentation.meraki.com
  function isDocs() {
    return location.hostname === 'documentation.meraki.com';
  }
  // Helper: check if on n*.meraki.com
  function isNDashboard() {
    return /^n\d+\.meraki\.com$/.test(location.hostname);
  }

  function addDocSectionLinkButtons() {
    if (!isDocs()) return;
    if (!enableCopyLink) return;
    if (window.__merakiDocLinkButtonsInjected) return;
    window.__merakiDocLinkButtonsInjected = true;
    
    // Add CSS styles once
    if (!document.getElementById('meraki-doc-link-styles')) {
      const style = document.createElement('style');
      style.id = 'meraki-doc-link-styles';
      style.textContent = `
        .meraki-doc-link-btn {
          margin-left: 8px;
          background: none;
          border: none;
          cursor: pointer;
          vertical-align: middle;
          padding: 0;
          display: inline-flex;
          align-items: center;
          position: relative;
        }
        .meraki-doc-link-btn svg {
          display: inline-block;
          vertical-align: middle;
        }
        .meraki-doc-link-tooltip {
          position: absolute;
          background: #222;
          color: #fff;
          padding: 1px 5px;
          border-radius: 4px;
          font-size: 0.78em;
          top: -28px;
          left: 0;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s;
        }
      `;
      document.head.appendChild(style);
    }
    
    const sections = document.querySelectorAll('div.mt-section');
    
    sections.forEach(section => {
      const headers = section.querySelectorAll('h2.editable, h3.editable, h4.editable, h5.editable, h6.editable');
      
      headers.forEach(header => {
        if (!header.querySelector('.meraki-doc-link-btn')) {
          // Find the id to use for this header
          let id = findHeaderId(header, section);
          
          // If still no id, do not add the button (hide/disable for this header)
          if (!id) {
            return;
          }
          
          const btn = createDocLinkButton(id);
          header.appendChild(btn);
        }
      });
    });
  }

  function findHeaderId(header, section) {
    // 1. If the header itself has an id, use it
    if (header.id) {
      return header.id;
    }
    
    // 2. Look for a span[id] immediately before the header
    let prev = header.previousElementSibling;
    while (prev) {
      if (prev.tagName === 'SPAN' && prev.id) {
        return prev.id;
      }
      // If there's a text node or comment, skip
      prev = prev.previousElementSibling;
    }
    
    // 3. If not found, look for a span[id] immediately after the header
    let next = header.nextElementSibling;
    while (next) {
      if (next.tagName === 'SPAN' && next.id) {
        return next.id;
      }
      next = next.nextElementSibling;
    }
    
    // 4. If still not found, fallback to the first span[id] in the section (legacy behavior)
    const spanWithId = section.querySelector('span[id]');
    return spanWithId ? spanWithId.id : null;
  }

  function createDocLinkButton(id) {
    const btn = document.createElement('button');
    btn.className = 'meraki-doc-link-btn';
    btn.title = 'Copy direct link to this section';
    btn.setAttribute('aria-label', 'Copy direct link to this section');
    
    // Create SVG icon
    const svg = createDocLinkIcon();
    btn.appendChild(svg);
    
    // Create tooltip
    const tooltip = createDocLinkTooltip();
    btn.appendChild(tooltip);
    
    // Add click event
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!id) return;
      const baseUrl = window.location.origin + window.location.pathname;
      const newUrl = `${baseUrl}#${id}`;
      navigator.clipboard.writeText(newUrl).then(() => {
        tooltip.style.opacity = '1';
        setTimeout(() => { tooltip.style.opacity = '0'; }, 1200);
      });
    });
    
    return btn;
  }

  function createDocLinkIcon() {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 28 28');
    
    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', '14');
    circle.setAttribute('cy', '14');
    circle.setAttribute('r', '13');
    circle.setAttribute('fill', '#27ae60');
    circle.setAttribute('stroke', '#219150');
    circle.setAttribute('stroke-width', '2');
    
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', 'M10 14a4 4 0 0 1 4-4h2a4 4 0 1 1 0 8h-2');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#fff');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    
    svg.appendChild(circle);
    svg.appendChild(path);
    return svg;
  }

  function createDocLinkTooltip() {
    const tooltip = document.createElement('span');
    tooltip.className = 'meraki-doc-link-tooltip';
    tooltip.textContent = 'Link copied';
    return tooltip;
  }

  function removeDocSectionLinkButtons() {
    if (!isDocs()) return;
    document.querySelectorAll('.meraki-doc-link-btn').forEach(btn => btn.remove());
    window.__merakiDocLinkButtonsInjected = false;
  }

  // Define updateTitle as a no-op by default
  function updateTitle() {}
  // Only assign real updateTitle on n*.meraki.com
  if (isNDashboard()) {
    updateTitle = function() {
      if (!enabled) return;
      let newTitle = null;
      if (!useModelMac) {
        const deviceName = extractDeviceName();
        if (deviceName) {
          newTitle = deviceName;
        }
      }
      if (!newTitle) {
        const modelAndMac = extractModelAndMacRaw();
        if (modelAndMac && useModelMac) {
          newTitle = `${modelAndMac.model} | ${modelAndMac.macSuffix}`;
        } else {
          newTitle = stripDashboardSuffix(document.title);
        }
      }
      if (document.title !== newTitle) {
        document.title = newTitle;
      }
    }
  }

  // Define tryUpdateWithRetry as a no-op by default
  function tryUpdateWithRetry() {}

  // Only assign real tryUpdateWithRetry on documentation.meraki.com and n*.meraki.com
  if (isDocs() || isNDashboard()) {
    tryUpdateWithRetry = function() {
      updateTitle();
      if (enableCopyLink) addDocSectionLinkButtons();
      else removeDocSectionLinkButtons();
      if (enableEasyCopy) addEasyCopyButton();
      else removeEasyCopyButton();
      const modelAndMac = enabled ? extractModelAndMacRaw() : null;
      if (enabled && !modelAndMac && retryCount < MAX_RETRIES) {
        retryCount++;
        setTimeout(tryUpdateWithRetry, RETRY_DELAY);
      }
    }
  }

  function queryInitialStateAndStart() {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
      enabled = response && typeof response.enabled === 'boolean' ? response.enabled : true;
      chrome.storage.sync.get(['useModelMac', 'enableCopyLink', 'enableGreenFavicon', 'enableEasyCopy'], (result) => {
        useModelMac = !!result.useModelMac;
        enableCopyLink = result.enableCopyLink !== undefined ? !!result.enableCopyLink : true;
        if (result.enableCopyLink === undefined) {
          chrome.storage.sync.set({ enableCopyLink: true });
        }
        enableGreenFavicon = result.enableGreenFavicon !== undefined ? !!result.enableGreenFavicon : true;
        if (result.enableGreenFavicon === undefined) {
          chrome.storage.sync.set({ enableGreenFavicon: true });
        }
        enableEasyCopy = result.enableEasyCopy !== undefined ? !!result.enableEasyCopy : true;
        if (result.enableEasyCopy === undefined) {
          chrome.storage.sync.set({ enableEasyCopy: true });
        }
        retryCount = 0;
        tryUpdateWithRetry();
        startObserver();
        setMerakiFavicon(); // Only call after state is loaded
      });
    });
  }

  const observer = new MutationObserver(() => {
    retryCount = 0;
    tryUpdateWithRetry();
  });

  function startObserver() {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      queryInitialStateAndStart();
    });
  } else {
    queryInitialStateAndStart();
  }

  // === Only run favicon and default features on n*.meraki.com ===
  function setMerakiFavicon() {
    if (!isNDashboard()) {
      // If we are not on n*.meraki.com, always disconnect the favicon observer if it exists
      if (faviconObserver) {
        faviconObserver.disconnect();
        faviconObserver = null;
      }
      return;
    }
    const expectedHref = chrome.runtime.getURL('src/assets/green.png');
    // Always remove the green favicon and disconnect observer if extension is disabled
    if (!enabled) {
      if (faviconObserver) {
        faviconObserver.disconnect();
        faviconObserver = null;
      }
      document.querySelectorAll('link[rel*="icon"]').forEach(e => {
        if (e.href === expectedHref) e.remove();
      });
      return;
    }
    // Always remove the green favicon if toggle is off
    if (!enableGreenFavicon) {
      if (faviconObserver) {
        faviconObserver.disconnect();
        faviconObserver = null;
      }
      document.querySelectorAll('link[rel*="icon"]').forEach(e => {
        if (e.href === expectedHref) e.remove();
      });
      return;
    }
    if (enableGreenFavicon && isNDashboard()) {
      if (faviconObserver) {
        faviconObserver.disconnect();
        faviconObserver = null;
      }
      const setFavicon = () => {
        const current = document.querySelector('link[rel*="icon"]');
        if (current && current.href === expectedHref) return;
        document.querySelectorAll('link[rel*="icon"]').forEach(e => e.remove());
        const link = document.createElement('link');
        link.rel = 'icon';
        link.type = 'image/png';
        link.href = expectedHref;
        document.head.appendChild(link);
      };
      if (document.head) {
        setFavicon();
      } else {
        document.addEventListener('DOMContentLoaded', setFavicon);
      }
      faviconObserver = new MutationObserver(setFavicon);
      faviconObserver.observe(document.head, { childList: true });
    } else {
      if (faviconObserver) {
        faviconObserver.disconnect();
        faviconObserver = null;
      }
    }
  }

  // === Easy Copy for Dashboard Functionality ===
  // Provides a copy button next to "Cisco Meraki" text in temporary permissions modals
  let easyCopyObserver = null;
  let easyCopyCheckTimeout = null;
  
  function addEasyCopyButton() {
    if (!isNDashboard() || !enableEasyCopy || window.__merakiEasyCopyButtonInjected) {
      return;
    }
    
    window.__merakiEasyCopyButtonInjected = true;
    
    // Add CSS styles once
    if (!document.getElementById('meraki-easy-copy-styles')) {
      const style = document.createElement('style');
      style.id = 'meraki-easy-copy-styles';
      style.textContent = `
        .meraki-exp-easy-copy-btn {
          margin-left: 8px;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          cursor: pointer;
          vertical-align: middle;
          padding: 4px 6px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          position: relative;
          border-radius: 6px;
          transition: all 0.2s ease;
          min-width: 28px;
          height: 28px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .meraki-exp-easy-copy-btn:hover {
          background: #e9ecef;
          border-color: #dee2e6;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
          transform: translateY(-1px);
        }
        .meraki-exp-easy-copy-btn:active {
          transform: translateY(0);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .meraki-exp-easy-copy-btn svg {
          display: block;
          width: 14px;
          height: 14px;
          color: #6c757d;
        }
        .meraki-exp-easy-copy-btn:hover svg {
          color: #495057;
        }
        .meraki-exp-easy-copy-tooltip {
          position: absolute;
          background: #343a40;
          color: #fff;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          top: -40px;
          left: 50%;
          transform: translateX(-50%);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
          white-space: nowrap;
          z-index: 1000;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .meraki-exp-easy-copy-tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 4px solid transparent;
          border-top-color: #343a40;
        }
        .meraki-exp-easy-copy-tooltip.show {
          opacity: 1;
        }
        
        /* Dark theme support */
        @media (prefers-color-scheme: dark) {
          .meraki-exp-easy-copy-btn {
            background: #495057;
            border-color: #6c757d;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
          }
          .meraki-exp-easy-copy-btn:hover {
            background: #6c757d;
            border-color: #868e96;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
          }
          .meraki-exp-easy-copy-btn svg {
            color: #adb5bd;
          }
          .meraki-exp-easy-copy-btn:hover svg {
            color: #ced4da;
          }
          .meraki-exp-easy-copy-tooltip {
            background: #212529;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
          }
          .meraki-exp-easy-copy-tooltip::after {
            border-top-color: #212529;
          }
        }
        
        /* Manual dark theme class support */
        body.dark-theme .meraki-exp-easy-copy-btn {
          background: #495057;
          border-color: #6c757d;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }
        body.dark-theme .meraki-exp-easy-copy-btn:hover {
          background: #6c757d;
          border-color: #868e96;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
        }
        body.dark-theme .meraki-exp-easy-copy-btn svg {
          color: #adb5bd;
        }
        body.dark-theme .meraki-exp-easy-copy-btn:hover svg {
          color: #ced4da;
        }
        body.dark-theme .meraki-exp-easy-copy-tooltip {
          background: #212529;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }
        body.dark-theme .meraki-exp-easy-copy-tooltip::after {
          border-top-color: #212529;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Start intelligent monitoring for the modal
    startIntelligentEasyCopyMonitoring();
  }

  /**
   * Starts intelligent monitoring for modal dialogs containing the target text
   * Uses a combination of delayed checks, mutation observers, and event listeners
   */
  function startIntelligentEasyCopyMonitoring() {
    // Initial check with a reasonable delay to catch modals that might already be there
    easyCopyCheckTimeout = setTimeout(() => {
      tryAddEasyCopyButton();
    }, 1000); // 1 second delay
    
    // Set up a focused observer to watch for modal additions
    if (easyCopyObserver) {
      easyCopyObserver.disconnect();
    }
    
    easyCopyObserver = new MutationObserver((mutations) => {
      // Only process relevant mutations
      const relevantMutations = mutations.filter(mutation => 
        mutation.type === 'childList' && 
        mutation.addedNodes.length > 0 &&
        // Check if any added node is or contains a modal
        Array.from(mutation.addedNodes).some(node => 
          node.nodeType === Node.ELEMENT_NODE && 
          (isModalNode(node) || containsModal(node))
        )
      );
      
      if (relevantMutations.length > 0) {
        // Debounce the check to avoid multiple rapid calls
        if (easyCopyCheckTimeout) {
          clearTimeout(easyCopyCheckTimeout);
        }
        easyCopyCheckTimeout = setTimeout(() => {
          tryAddEasyCopyButton();
        }, 300); // 300ms debounce
      }
    });
    
    // Observe only the body for modal additions (more targeted)
    easyCopyObserver.observe(document.body, {
      childList: true,
      subtree: false // Don't watch subtree initially
    });
    
    // Set up intelligent event listening for admin-related interactions
    setupAdminInteractionMonitoring();
    
    // Set up a single, longer interval check as a fallback (much less frequent)
    const checkInterval = setInterval(() => {
      if (!enableEasyCopy || !isNDashboard()) {
        clearInterval(checkInterval);
        return;
      }
      // Only check if we haven't found the button yet
      if (!document.querySelector('.meraki-exp-easy-copy-btn')) {
        tryAddEasyCopyButton();
      } else {
        // Button found, we can stop the interval
        clearInterval(checkInterval);
      }
    }, 10000); // Check every 10 seconds instead of 2
    
    // Store the interval ID for cleanup
    window.__merakiEasyCopyCheckInterval = checkInterval;
  }

  /**
   * Sets up event listeners to detect when users interact with admin features
   * This allows us to start more focused monitoring when needed
   */
  function setupAdminInteractionMonitoring() {
    // Listen for clicks on admin-related elements
    document.addEventListener('click', (e) => {
      if (!enableEasyCopy || !isNDashboard()) return;
      
      const target = e.target;
      const isAdminClick = target.closest && (
        target.closest('[aria-label*="Admin"]') ||
        target.closest('button[aria-label*="Admin"]') ||
        target.closest('.dashboard-header-admin-menu-button') ||
        target.textContent && target.textContent.includes('Admin')
      );
      
      if (isAdminClick) {
        // Start more focused monitoring after admin interaction
        startFocusedModalMonitoring();
      }
    }, true);
  }

  /**
   * Starts focused monitoring when admin interaction is detected
   * More aggressive monitoring is acceptable here since user is actively using admin features
   */
  function startFocusedModalMonitoring() {
    // This function is called when admin interaction is detected
    // We can be more aggressive here since the user is actively using admin features
    
    // Immediate check
    tryAddEasyCopyButton();
    
    // Check again after a short delay
    setTimeout(() => {
      tryAddEasyCopyButton();
    }, 500);
    
    // Set up a focused observer for the next few seconds
    const focusedObserver = new MutationObserver((mutations) => {
      const hasModalChanges = mutations.some(mutation => 
        mutation.type === 'childList' && 
        mutation.addedNodes.length > 0 &&
        Array.from(mutation.addedNodes).some(node => 
          node.nodeType === Node.ELEMENT_NODE && 
          (isModalNode(node) || containsModal(node))
        )
      );
      
      if (hasModalChanges) {
        tryAddEasyCopyButton();
        // Stop focused monitoring after finding the modal
        focusedObserver.disconnect();
      }
    });
    
    focusedObserver.observe(document.body, {
      childList: true,
      subtree: false
    });
    
    // Stop focused monitoring after 5 seconds to avoid being too aggressive
    setTimeout(() => {
      focusedObserver.disconnect();
    }, 5000);
  }

  /**
   * Checks if a node is a modal dialog
   */
  function isModalNode(node) {
    return node.classList && node.classList.contains('mds-rebuild-modal');
  }

  /**
   * Checks if a node contains a modal dialog
   */
  function containsModal(node) {
    return node.querySelector && node.querySelector('.mds-rebuild-modal');
  }

  /**
   * Attempts to add the easy copy button if the target text is found
   */
  function tryAddEasyCopyButton() {
    const targetText = findCiscoMerakiText();
    if (targetText && !targetText.querySelector('.meraki-exp-easy-copy-btn')) {
      const btn = createEasyCopyButton();
      targetText.appendChild(btn);
    }
  }

  /**
   * Searches for the "Cisco Meraki" text in the document
   * Uses multiple strategies to find the target element
   */
  function findCiscoMerakiText() {
    // First try to find the exact element we're looking for
    const targetText = document.querySelector('p.mds-text.mds-text-p3.mds-text-weight-semi-bold.mds-text-color-regular');
    
    // Check if this element contains "Cisco Meraki" text
    if (targetText && targetText.textContent.trim() === 'Cisco Meraki') {
      return targetText;
    }
    
    // If not found, search more broadly for the text in the modal
    const modal = document.querySelector('.mds-rebuild-modal');
    
    if (modal) {
      // Try multiple selectors to find the text
      const selectors = [
        'p.mds-text.mds-text-p3.mds-text-weight-semi-bold.mds-text-color-regular',
        'p.mds-text.mds-text-p3.mds-text-weight-semi-bold',
        'p.mds-text.mds-text-weight-semi-bold',
        'p.mds-text'
      ];
      
      for (const selector of selectors) {
        const elements = modal.querySelectorAll(selector);
        
        for (const element of elements) {
          const text = element.textContent.trim();
          if (text === 'Cisco Meraki') {
            // Find the closest paragraph with the right classes
            const closestP = element.closest('p.mds-text.mds-text-p3.mds-text-weight-semi-bold.mds-text-color-regular');
            if (closestP) {
              return closestP;
            }
            // If no close paragraph found, return the element itself
            return element;
          }
        }
      }
      
      // Also check for any text containing "Cisco Meraki"
      const allTextElements = modal.querySelectorAll('p, span, div');
      for (const element of allTextElements) {
        if (element.textContent && element.textContent.includes('Cisco Meraki')) {
          // Find the closest paragraph with the right classes
          const closestP = element.closest('p.mds-text.mds-text-p3.mds-text-weight-semi-bold.mds-text-color-regular');
          if (closestP) {
            return closestP;
          }
          // If no close paragraph found, return the element itself
          return element;
        }
      }
    }
    
    // Fallback: search the entire document for the text
    const allElements = document.querySelectorAll('p, span, div');
    for (const element of allElements) {
      if (element.textContent && element.textContent.trim() === 'Cisco Meraki') {
        // Find the closest paragraph with the right classes
        const closestP = element.closest('p.mds-text.mds-text-p3.mds-text-weight-semi-bold.mds-text-color-regular');
        if (closestP) {
          return closestP;
        }
        // If no close paragraph found, return the element itself
        return element;
      }
    }
    
    return null;
  }

  /**
   * Creates the easy copy button with copy icon and tooltip
   */
  function createEasyCopyButton() {
    const btn = document.createElement('button');
    btn.className = 'meraki-exp-easy-copy-btn';
    btn.title = 'Copy to clipboard';
    btn.setAttribute('aria-label', 'Copy to clipboard');
    
    // Create SVG icon (copy icon)
    const svg = createEasyCopyIcon();
    btn.appendChild(svg);
    
    // Create tooltip
    const tooltip = createEasyCopyTooltip();
    btn.appendChild(tooltip);
    
    // Add click event
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const textToCopy = 'Cisco Meraki';
      navigator.clipboard.writeText(textToCopy).then(() => {
        tooltip.textContent = 'Copied!';
        tooltip.classList.add('show');
        setTimeout(() => {
          tooltip.classList.remove('show');
          tooltip.textContent = 'Copy to clipboard';
        }, 1200);
      }).catch(() => {
        tooltip.textContent = 'Failed to copy';
        tooltip.classList.add('show');
        setTimeout(() => {
          tooltip.classList.remove('show');
          tooltip.textContent = 'Copy to clipboard';
        }, 1200);
      });
    });
    
    return btn;
  }

  /**
   * Creates the copy icon SVG
   */
  function createEasyCopyIcon() {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '14');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    
    // Create the main document rectangle
    const rect1 = document.createElementNS(svgNS, 'rect');
    rect1.setAttribute('x', '9');
    rect1.setAttribute('y', '9');
    rect1.setAttribute('width', '13');
    rect1.setAttribute('height', '13');
    rect1.setAttribute('rx', '2');
    rect1.setAttribute('ry', '2');
    
    // Create the overlapping document rectangle (copy effect)
    const rect2 = document.createElementNS(svgNS, 'rect');
    rect2.setAttribute('x', '2');
    rect2.setAttribute('y', '2');
    rect2.setAttribute('width', '13');
    rect2.setAttribute('height', '13');
    rect2.setAttribute('rx', '2');
    rect2.setAttribute('ry', '2');
    
    svg.appendChild(rect2);
    svg.appendChild(rect1);
    
    return svg;
  }

  /**
   * Creates the tooltip element
   */
  function createEasyCopyTooltip() {
    const tooltip = document.createElement('span');
    tooltip.className = 'meraki-exp-easy-copy-tooltip';
    tooltip.textContent = 'Copy to clipboard';
    return tooltip;
  }

  /**
   * Removes all easy copy buttons and cleans up resources
   */
  function removeEasyCopyButton() {
    if (!isNDashboard()) return;
    document.querySelectorAll('.meraki-exp-easy-copy-btn').forEach(btn => btn.remove());
    window.__merakiEasyCopyButtonInjected = false;
    
    // Clean up observer, interval, and timeout
    if (easyCopyObserver) {
      easyCopyObserver.disconnect();
      easyCopyObserver = null;
    }
    if (easyCopyCheckTimeout) {
      clearTimeout(easyCopyCheckTimeout);
      easyCopyCheckTimeout = null;
    }
    if (window.__merakiEasyCopyCheckInterval) {
      clearInterval(window.__merakiEasyCopyCheckInterval);
      window.__merakiEasyCopyCheckInterval = null;
    }
  }

  // === Text Replacement Functionality ===
  // Listen for messages from popup for text replacement
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'EXT_STATE') {
      enabled = message.enabled;
      if (enabled) {
        retryCount = 0;
        tryUpdateWithRetry();
      }
      setMerakiFavicon(); // Always update favicon logic on enable/disable
    }
    if (message.type === 'USE_MODEL_MAC') {
      useModelMac = message.enabled;
      retryCount = 0;
      tryUpdateWithRetry();
    }
    if (message.type === 'ENABLE_COPY_LINK') {
      enableCopyLink = message.enabled;
      retryCount = 0;
      tryUpdateWithRetry();
    }
    if (message.type === 'ENABLE_GREEN_FAVICON') {
      enableGreenFavicon = message.enabled;
      setMerakiFavicon();
    }
    if (message.type === 'EASY_COPY_TOGGLE') {
      enableEasyCopy = message.enabled;
      if (enableEasyCopy) {
        addEasyCopyButton();
      } else {
        removeEasyCopyButton();
      }
    }
    if (message.type === 'TEXT_REPLACEMENT_TOGGLE') {
      // This will be handled by the handy-content.js script
      // We just need to pass it through
    } else if (message.type === 'TEXT_REPLACEMENT_UPDATE') {
      // This will be handled by the handy-content.js script
      // We just need to pass it through
    }
  });
})();

