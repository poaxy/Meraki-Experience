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

function loadState() {
  chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
    toggle.checked = response.enabled;
    toggleLabel.textContent = response.enabled ? 'Enabled' : 'Disabled';
  });
  chrome.storage.sync.get(['useModelMac', 'enableCopyLink'], (result) => {
    if (modelMacToggle) {
      modelMacToggle.checked = !!result.useModelMac;
    }
    if (copyLinkToggle) {
      // Default to true if not set
      copyLinkToggle.checked = result.enableCopyLink !== undefined ? !!result.enableCopyLink : true;
      // If not set, also set it in storage for consistency
      if (result.enableCopyLink === undefined) {
        chrome.storage.sync.set({ enableCopyLink: true });
      }
    }
  });
}

if (toggle) {
  toggle.addEventListener('change', () => {
    chrome.runtime.sendMessage({ type: 'SET_STATE', enabled: toggle.checked }, () => {
      toggleLabel.textContent = toggle.checked ? 'Enabled' : 'Disabled';
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

function showStatus(msg) {
  statusMessage.textContent = msg;
  setTimeout(() => {
    statusMessage.textContent = '';
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
    saveTheme(newTheme);
    themeToggle.setAttribute('data-theme', newTheme);
  });
}

loadState();
loadTheme();
