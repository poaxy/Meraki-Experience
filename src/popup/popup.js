// Popup script

const toggle = document.getElementById('toggle-enabled');
const toggleLabel = document.getElementById('toggle-label');
const statusMessage = document.getElementById('status-message');
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const modelMacToggle = document.getElementById('device-name-toggle');
const modelMacLabel = document.getElementById('device-name-label');
const copyLinkToggle = document.getElementById('copy-link-toggle');
const copyLinkLabel = document.getElementById('copy-link-label');
const faviconToggle = document.getElementById('favicon-toggle');
const faviconLabel = document.getElementById('favicon-label');
const textReplacementToggle = document.getElementById('text-replacement-toggle');
const textReplacementLabel = document.getElementById('text-replacement-label');
const manageTextReplacementBtn = document.getElementById('manage-text-replacement-btn');
const manageTextReplacementContainer = document.getElementById('manage-text-replacement');

function setSubFeatureTogglesEnabled(enabled) {
  if (modelMacToggle) modelMacToggle.disabled = !enabled;
  if (copyLinkToggle) copyLinkToggle.disabled = !enabled;
  if (faviconToggle) faviconToggle.disabled = !enabled;
  if (textReplacementToggle) textReplacementToggle.disabled = !enabled;
  // Add a class to visually gray out the rows
  document.querySelectorAll('.device-name-row, .copy-link-row, .text-replacement-row').forEach(row => {
    if (!enabled) {
      row.classList.add('disabled-row');
    } else {
      row.classList.remove('disabled-row');
    }
  });
}

function loadState() {
  chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
    toggle.checked = response.enabled;
    toggleLabel.textContent = response.enabled ? 'Enabled' : 'Disabled';
    setSubFeatureTogglesEnabled(response.enabled);
  });
  chrome.storage.sync.get(['useModelMac', 'enableCopyLink', 'enableGreenFavicon', 'textReplacementEnabled', 'enabled'], (result) => {
    if (modelMacToggle) {
      modelMacToggle.checked = !!result.useModelMac;
    }
    if (copyLinkToggle) {
      copyLinkToggle.checked = result.enableCopyLink !== undefined ? !!result.enableCopyLink : true;
      if (result.enableCopyLink === undefined) {
        chrome.storage.sync.set({ enableCopyLink: true });
      }
    }
    if (faviconToggle) {
      faviconToggle.checked = result.enableGreenFavicon !== undefined ? !!result.enableGreenFavicon : true;
      if (result.enableGreenFavicon === undefined) {
        chrome.storage.sync.set({ enableGreenFavicon: true });
      }
    }
    if (textReplacementToggle) {
      textReplacementToggle.checked = result.textReplacementEnabled !== undefined ? !!result.textReplacementEnabled : false;
      if (result.textReplacementEnabled === undefined) {
        chrome.storage.sync.set({ textReplacementEnabled: false });
      }
      updateManageButtonVisibility(); // Update based on both states
    }
  });
}

function updateManageButtonVisibility(enabled) {
  if (manageTextReplacementContainer) {
    // Check both the text replacement state and the main extension state
    chrome.storage.sync.get(['textReplacementEnabled', 'enabled'], (data) => {
      const textReplacementEnabled = data.textReplacementEnabled !== undefined ? !!data.textReplacementEnabled : false;
      const mainExtensionEnabled = data.enabled !== false;
      
      // Show manage button only if both text replacement AND main extension are enabled
      const shouldShow = textReplacementEnabled && mainExtensionEnabled;
      
      if (shouldShow) {
        manageTextReplacementContainer.classList.remove('hidden');
      } else {
        manageTextReplacementContainer.classList.add('hidden');
      }
    });
  }
}

if (toggle) {
  toggle.addEventListener('change', () => {
    chrome.runtime.sendMessage({ type: 'SET_STATE', enabled: toggle.checked }, () => {
      toggleLabel.textContent = toggle.checked ? 'Enabled' : 'Disabled';
      setSubFeatureTogglesEnabled(toggle.checked);
      updateManageButtonVisibility(); // Update manage button visibility based on new state
      showStatus('State saved.');
    });
  });
}

if (modelMacToggle) {
  modelMacToggle.addEventListener('change', () => {
    const enabled = modelMacToggle.checked;
    chrome.storage.sync.set({ useModelMac: enabled }, () => {
      showStatus('Use model/MAC for tabs ' + (enabled ? 'enabled' : 'disabled'));
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { type: 'USE_MODEL_MAC', enabled }, () => {
              if (chrome.runtime.lastError) {
                // Suppress 'Could not establish connection' errors
              }
            });
          }
        }
      });
    });
  });
}

if (copyLinkToggle) {
  copyLinkToggle.addEventListener('change', () => {
    const enabled = copyLinkToggle.checked;
    chrome.storage.sync.set({ enableCopyLink: enabled }, () => {
      showStatus('Copy link button ' + (enabled ? 'enabled' : 'disabled'));
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { type: 'ENABLE_COPY_LINK', enabled }, () => {
              if (chrome.runtime.lastError) {
                // Suppress 'Could not establish connection' errors
              }
            });
          }
        }
      });
    });
  });
}

if (faviconToggle) {
  faviconToggle.addEventListener('change', () => {
    const enabled = faviconToggle.checked;
    chrome.storage.sync.set({ enableGreenFavicon: enabled }, () => {
      showStatus('Old meraki icon ' + (enabled ? 'enabled' : 'disabled'));
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { type: 'ENABLE_GREEN_FAVICON', enabled }, () => {
              if (chrome.runtime.lastError) {
                // Suppress 'Could not establish connection' errors
              }
            });
          }
        }
      });
    });
  });
}

if (textReplacementToggle) {
  textReplacementToggle.addEventListener('change', () => {
    const enabled = textReplacementToggle.checked;
    chrome.storage.sync.set({ textReplacementEnabled: enabled }, () => {
      showStatus('Text replacement ' + (enabled ? 'enabled' : 'disabled'));
      updateManageButtonVisibility(); // Update based on both states
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { type: 'TEXT_REPLACEMENT_TOGGLE', enabled }, () => {
              if (chrome.runtime.lastError) {
                // Suppress 'Could not establish connection' errors
              }
            });
          }
        }
      });
    });
  });
}

if (manageTextReplacementBtn) {
  manageTextReplacementBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

function showStatus(msg) {
  statusMessage.textContent = msg;
  statusMessage.style.display = 'block';
  setTimeout(() => {
    statusMessage.style.display = 'none';
  }, 2000);
}

function setTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark-theme');
    if (themeIcon) themeIcon.src = 'moon.png';
  } else {
    document.body.classList.remove('dark-theme');
    if (themeIcon) themeIcon.src = 'sun.png';
  }
  saveTheme(theme);
}

function saveTheme(theme) {
  chrome.storage.sync.set({ popupTheme: theme });
}

function loadTheme() {
  chrome.storage.sync.get(['popupTheme'], (result) => {
    const theme = result.popupTheme || 'light';
    setTheme(theme);
    if (themeToggle) {
      themeToggle.setAttribute('data-theme', theme);
    }
  });
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const isDark = document.body.classList.contains('dark-theme');
    const newTheme = isDark ? 'light' : 'dark';
    setTheme(newTheme);
    themeToggle.setAttribute('data-theme', newTheme);
  });
}

loadState();
loadTheme();
