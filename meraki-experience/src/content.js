// Content script

(function () {
  const DASHBOARD_SUFFIX = ' - Meraki Dashboard';

  let enabled = true;
  let useModelMac = false;
  let enableCopyLink = false;

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

  function updateTitle() {
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

  // === Meraki Documentation Deep Link Feature ===
  function addDocSectionLinkButtons() {
    if (!enableCopyLink) return;
    if (!/^(https?:\/\/)?documentation\.meraki\.com\//.test(window.location.href)) return;
    if (window.__merakiDocLinkButtonsInjected) return;
    window.__merakiDocLinkButtonsInjected = true;
    const sections = document.querySelectorAll('div.mt-section');
    sections.forEach(section => {
      const headers = section.querySelectorAll('h2.editable, h3.editable, h4.editable, h5.editable, h6.editable');
      headers.forEach(header => {
        if (!header.querySelector('.meraki-doc-link-btn')) {
          const spanWithId = section.querySelector('span[id]');
          if (!spanWithId) return;
          const btn = document.createElement('button');
          btn.className = 'meraki-doc-link-btn';
          btn.title = 'Copy direct link to this section';
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
            const id = spanWithId.id;
            if (!id) return;
            const baseUrl = window.location.origin + window.location.pathname;
            const newUrl = `${baseUrl}#${id}`;
            navigator.clipboard.writeText(newUrl).then(() => {
              tooltip.style.opacity = '1';
              setTimeout(() => { tooltip.style.opacity = '0'; }, 1200);
            });
          });
          header.appendChild(btn);
        }
      });
    });
  }

  function removeDocSectionLinkButtons() {
    document.querySelectorAll('.meraki-doc-link-btn').forEach(btn => btn.remove());
    window.__merakiDocLinkButtonsInjected = false;
  }

  let retryCount = 0;
  const MAX_RETRIES = 10;
  const RETRY_DELAY = 500;

  function tryUpdateWithRetry() {
    updateTitle();
    if (enableCopyLink) addDocSectionLinkButtons();
    else removeDocSectionLinkButtons();
    const modelAndMac = enabled ? extractModelAndMacRaw() : null;
    if (enabled && !modelAndMac && retryCount < MAX_RETRIES) {
      retryCount++;
      setTimeout(tryUpdateWithRetry, RETRY_DELAY);
    }
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'EXT_STATE') {
      enabled = message.enabled;
      if (enabled) {
        retryCount = 0;
        tryUpdateWithRetry();
      }
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
  });

  function queryInitialStateAndStart() {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
      enabled = response && typeof response.enabled === 'boolean' ? response.enabled : true;
      chrome.storage.sync.get(['useModelMac', 'enableCopyLink'], (result) => {
        useModelMac = !!result.useModelMac;
        enableCopyLink = !!result.enableCopyLink;
        retryCount = 0;
        tryUpdateWithRetry();
        startObserver();
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
})();

