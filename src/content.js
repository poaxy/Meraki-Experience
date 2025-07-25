// Content script

// DEBUG: Log script startup and domain
console.log('[MerakiExt] Content script loaded on', location.hostname);

(function () {
  const DASHBOARD_SUFFIX = ' - Meraki Dashboard';

  let enabled = true;
  let useModelMac = false;
  let enableCopyLink = false;
  let enableGreenFavicon = true;
  let faviconObserver = null;

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

  // === Only run copy link feature on documentation.meraki.com ===
  function addDocSectionLinkButtons() {
    if (!isDocs()) return;
    if (!enableCopyLink) return;
    if (window.__merakiDocLinkButtonsInjected) return;
    window.__merakiDocLinkButtonsInjected = true;
    const sections = document.querySelectorAll('div.mt-section');
    console.log('[MerakiExt] addDocSectionLinkButtons: sections found:', sections.length);
    sections.forEach(section => {
      const headers = section.querySelectorAll('h2.editable, h3.editable, h4.editable, h5.editable, h6.editable');
      console.log('[MerakiExt] Section', section, 'headers found:', headers.length);
      headers.forEach(header => {
        if (!header.querySelector('.meraki-doc-link-btn')) {
          // Find the id to use for this header
          let id = null;
          // 1. If the header itself has an id, use it
          if (header.id) {
            id = header.id;
          } else {
            // 2. Look for a span[id] immediately before the header
            let prev = header.previousElementSibling;
            while (prev) {
              if (prev.tagName === 'SPAN' && prev.id) {
                id = prev.id;
                break;
              }
              // If there's a text node or comment, skip
              prev = prev.previousElementSibling;
            }
            // 3. If not found, look for a span[id] immediately after the header
            if (!id) {
              let next = header.nextElementSibling;
              while (next) {
                if (next.tagName === 'SPAN' && next.id) {
                  id = next.id;
                  break;
                }
                next = next.nextElementSibling;
              }
            }
          }
          // 4. If still not found, fallback to the first span[id] in the section (legacy behavior)
          if (!id) {
            const spanWithId = section.querySelector('span[id]');
            if (spanWithId) id = spanWithId.id;
          }
          // If still no id, do not add the button (hide/disable for this header)
          if (!id) {
            console.log('[MerakiExt] No id found for header:', header);
            return;
          }
          const btn = document.createElement('button');
          btn.className = 'meraki-doc-link-btn';
          btn.title = 'Copy direct link to this section';
          btn.setAttribute('aria-label', 'Copy direct link to this section');
          btn.style.marginLeft = '8px';
          btn.style.background = 'none';
          btn.style.border = 'none';
          btn.style.cursor = 'pointer';
          btn.style.verticalAlign = 'middle';
          btn.style.padding = '0';
          btn.style.display = 'inline-flex';
          btn.style.alignItems = 'center';
          const svgNS = 'http://www.w3.org/2000/svg';
          const svg = document.createElementNS(svgNS, 'svg');
          svg.setAttribute('width', '20');
          svg.setAttribute('height', '20');
          svg.setAttribute('viewBox', '0 0 28 28');
          svg.style.display = 'inline-block';
          svg.style.verticalAlign = 'middle';
          const circle = document.createElementNS(svgNS, 'circle');
          circle.setAttribute('cx', '14');
          circle.setAttribute('cy', '14');
          circle.setAttribute('r', '13');
          circle.setAttribute('fill', '#27ae60');
          circle.setAttribute('stroke', '#219150');
          circle.setAttribute('stroke-width', '2');
          svg.appendChild(circle);
          const path = document.createElementNS(svgNS, 'path');
          path.setAttribute('d', 'M10 14a4 4 0 0 1 4-4h2a4 4 0 1 1 0 8h-2');
          path.setAttribute('fill', 'none');
          path.setAttribute('stroke', '#fff');
          path.setAttribute('stroke-width', '2');
          path.setAttribute('stroke-linecap', 'round');
          path.setAttribute('stroke-linejoin', 'round');
          svg.appendChild(path);
          btn.appendChild(svg);
          const tooltip = document.createElement('span');
          tooltip.textContent = 'Link copied';
          tooltip.style.position = 'absolute';
          tooltip.style.background = '#222';
          tooltip.style.color = '#fff';
          tooltip.style.padding = '1px 5px';
          tooltip.style.borderRadius = '4px';
          tooltip.style.fontSize = '0.78em';
          tooltip.style.top = '-28px';
          tooltip.style.left = '0';
          tooltip.style.opacity = '0';
          tooltip.style.pointerEvents = 'none';
          tooltip.style.transition = 'opacity 0.2s';
          btn.style.position = 'relative';
          btn.appendChild(tooltip);
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
          header.appendChild(btn);
          console.log('[MerakiExt] Injected copy link button for header:', header, 'with id:', id);
        }
      });
    });
  }

  function removeDocSectionLinkButtons() {
    if (!isDocs()) return;
    document.querySelectorAll('.meraki-doc-link-btn').forEach(btn => btn.remove());
    window.__merakiDocLinkButtonsInjected = false;
  }

  let retryCount = 0;
  const MAX_RETRIES = 10;
  const RETRY_DELAY = 500;

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
      const modelAndMac = enabled ? extractModelAndMacRaw() : null;
      if (enabled && !modelAndMac && retryCount < MAX_RETRIES) {
        retryCount++;
        setTimeout(tryUpdateWithRetry, RETRY_DELAY);
      }
    }
  }

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
  });

  function queryInitialStateAndStart() {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
      enabled = response && typeof response.enabled === 'boolean' ? response.enabled : true;
      chrome.storage.sync.get(['useModelMac', 'enableCopyLink', 'enableGreenFavicon'], (result) => {
        useModelMac = !!result.useModelMac;
        enableCopyLink = result.enableCopyLink !== undefined ? !!result.enableCopyLink : true;
        if (result.enableCopyLink === undefined) {
          chrome.storage.sync.set({ enableCopyLink: true });
        }
        enableGreenFavicon = result.enableGreenFavicon !== undefined ? !!result.enableGreenFavicon : true;
        if (result.enableGreenFavicon === undefined) {
          chrome.storage.sync.set({ enableGreenFavicon: true });
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
    console.log('[MerakiExt] Setting up MutationObserver for tryUpdateWithRetry on', location.hostname);
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
})();

