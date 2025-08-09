document.addEventListener('DOMContentLoaded', () => {
  const keywordInput = document.getElementById('keyword-input');
  const replacementInput = document.getElementById('replacement-input');
  const saveButton = document.getElementById('save-button');
  const replacementsList = document.getElementById('replacements-list');
  const emptyState = document.getElementById('empty-state');
  const form = document.getElementById('replacement-form');
  const feedbackMessage = document.getElementById('feedback-message');
  const extensionToggle = document.getElementById('extension-toggle');
  const importButton = document.getElementById('import-button');
  const exportButton = document.getElementById('export-button');
  const importFile = document.getElementById('import-file');
  const charCounter = document.getElementById('char-counter');

  let replacements = {};
  let currentlyEditing = null;

  // Constants
  const MAX_REPLACEMENT_LENGTH = 10000;
  const MAX_KEYWORD_LENGTH = 100;
  const INVALID_KEYWORD_CHARS = /[<>"?*]/; // Removed ":", "\", and "|" from invalid characters
  const MAX_DISPLAY_LENGTH = 100; // Maximum characters to display before truncating

  const loadData = () => {
    chrome.storage.sync.get(['replacements', 'textReplacementEnabled'], (data) => {
      replacements = data.replacements || {};
      extensionToggle.checked = data.textReplacementEnabled === undefined ? false : data.textReplacementEnabled;
      renderList();
    });
  };

  const renderList = () => {
    replacementsList.innerHTML = '';
    const keywords = Object.keys(replacements);
    if (keywords.length === 0) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      keywords.sort().forEach(keyword => {
        const item = createListItem(keyword, replacements[keyword]);
        replacementsList.appendChild(item);
      });
    }
  };

  const createListItem = (keyword, replacement) => {
    const item = document.createElement('div');
    item.className = 'replacement-item';
    item.dataset.keyword = keyword;

    const textContainer = document.createElement('div');
    textContainer.className = 'replacement-text-container';

    const keywordSpan = document.createElement('span');
    keywordSpan.className = 'replacement-keyword';
    keywordSpan.textContent = keyword;

    const arrowSpan = document.createElement('span');
    arrowSpan.className = 'arrow';
    arrowSpan.textContent = ' → ';

    const replacementSpan = document.createElement('span');
    replacementSpan.className = 'replacement-value';
    
    // Truncate replacement text if it's too long
    if (replacement.length > MAX_DISPLAY_LENGTH) {
      const truncatedText = replacement.substring(0, MAX_DISPLAY_LENGTH) + '...';
      replacementSpan.textContent = truncatedText;
      replacementSpan.title = replacement; // Show full text on hover
      replacementSpan.classList.add('truncated');
    } else {
      replacementSpan.textContent = replacement;
    }

    textContainer.appendChild(keywordSpan);
    textContainer.appendChild(arrowSpan);
    textContainer.appendChild(replacementSpan);

    const actions = document.createElement('div');
    actions.className = 'actions';

    const editButton = document.createElement('button');
    editButton.className = 'edit-button';
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', () => handleEdit(item, keyword, replacement));

    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-button';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => handleDelete(keyword));

    actions.appendChild(editButton);
    actions.appendChild(deleteButton);
    item.appendChild(textContainer);
    item.appendChild(actions);

    return item;
  };

  const handleEdit = (item, oldKeyword, oldReplacement) => {
    if (currentlyEditing) {
      const previousItem = replacementsList.querySelector('.editing');
      if (previousItem) {
        const originalKeyword = previousItem.dataset.keyword;
        const originalReplacement = replacements[originalKeyword];
        cancelEdit(previousItem, originalKeyword, originalReplacement);
      }
    }

    currentlyEditing = oldKeyword;
    item.classList.add('editing');

    const textContainer = item.querySelector('.replacement-text-container');
    textContainer.innerHTML = '';

    const keywordInput = document.createElement('input');
    keywordInput.type = 'text';
    keywordInput.className = 'edit-keyword';
    keywordInput.value = oldKeyword;
    keywordInput.placeholder = 'Keyword';

    const replacementInput = document.createElement('textarea');
    replacementInput.className = 'edit-replacement';
    replacementInput.value = oldReplacement;
    replacementInput.placeholder = 'Replacement';
    replacementInput.rows = 3;

    const saveEditButton = document.createElement('button');
    saveEditButton.className = 'save-edit-button';
    saveEditButton.textContent = 'Save';
    saveEditButton.addEventListener('click', () => saveEdit(item, oldKeyword));

    const cancelEditButton = document.createElement('button');
    cancelEditButton.className = 'cancel-edit-button';
    cancelEditButton.textContent = 'Cancel';
    cancelEditButton.addEventListener('click', () => cancelEdit(item, oldKeyword, oldReplacement));

    textContainer.appendChild(keywordInput);
    textContainer.appendChild(replacementInput);
    textContainer.appendChild(saveEditButton);
    textContainer.appendChild(cancelEditButton);

    keywordInput.focus();
    keywordInput.select();
  };

  const validateKeyword = (keyword) => {
    if (!keyword || keyword.trim().length === 0) {
      return 'Keyword cannot be empty';
    }
    if (keyword.length > MAX_KEYWORD_LENGTH) {
      return `Keyword cannot be longer than ${MAX_KEYWORD_LENGTH} characters`;
    }
    if (INVALID_KEYWORD_CHARS.test(keyword)) {
      return 'Keyword contains invalid characters';
    }
    if (keyword.includes(' ')) {
      return 'Keyword cannot contain spaces';
    }
    return null;
  };

  const validateReplacement = (replacement) => {
    if (!replacement || replacement.trim().length === 0) {
      return 'Replacement cannot be empty';
    }
    if (replacement.length > MAX_REPLACEMENT_LENGTH) {
      return `Replacement cannot be longer than ${MAX_REPLACEMENT_LENGTH} characters`;
    }
    return null;
  };

  const saveEdit = (item, oldKeyword) => {
    const keywordInput = item.querySelector('.edit-keyword');
    const replacementInput = item.querySelector('.edit-replacement');
    
    const newKeyword = keywordInput.value.trim();
    const newReplacement = replacementInput.value.trim();

    const keywordError = validateKeyword(newKeyword);
    const replacementError = validateReplacement(newReplacement);

    if (keywordError) {
      showFeedback(keywordError, 'error');
      return;
    }

    if (replacementError) {
      showFeedback(replacementError, 'error');
      return;
    }

    if (newKeyword !== oldKeyword && replacements[newKeyword]) {
      showFeedback('A replacement with this keyword already exists', 'error');
      return;
    }

    // Remove old keyword and add new one
    delete replacements[oldKeyword];
    replacements[newKeyword] = newReplacement;

    chrome.storage.sync.set({ replacements }, () => {
      currentlyEditing = null;
      renderList();
      showFeedback('Replacement updated successfully', 'success');
    });
  };

  const cancelEdit = (item, keyword, replacement) => {
    currentlyEditing = null;
    item.classList.remove('editing');
    
    const textContainer = item.querySelector('.replacement-text-container');
    textContainer.innerHTML = '';

    const keywordSpan = document.createElement('span');
    keywordSpan.className = 'replacement-keyword';
    keywordSpan.textContent = keyword;

    const arrowSpan = document.createElement('span');
    arrowSpan.className = 'arrow';
    arrowSpan.textContent = ' → ';

    const replacementSpan = document.createElement('span');
    replacementSpan.className = 'replacement-value';
    
    // Truncate replacement text if it's too long
    if (replacement.length > MAX_DISPLAY_LENGTH) {
      const truncatedText = replacement.substring(0, MAX_DISPLAY_LENGTH) + '...';
      replacementSpan.textContent = truncatedText;
      replacementSpan.title = replacement; // Show full text on hover
      replacementSpan.classList.add('truncated');
    } else {
      replacementSpan.textContent = replacement;
    }

    textContainer.appendChild(keywordSpan);
    textContainer.appendChild(arrowSpan);
    textContainer.appendChild(replacementSpan);

    const actions = document.createElement('div');
    actions.className = 'actions';

    const editButton = document.createElement('button');
    editButton.className = 'edit-button';
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', () => handleEdit(item, keyword, replacement));

    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-button';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => handleDelete(keyword));

    actions.appendChild(editButton);
    actions.appendChild(deleteButton);
    item.appendChild(actions);
  };

  const handleDelete = (keyword) => {
    if (confirm(`Are you sure you want to delete the replacement for "${keyword}"?`)) {
      delete replacements[keyword];
      chrome.storage.sync.set({ replacements }, () => {
        renderList();
        showFeedback('Replacement deleted successfully', 'success');
      });
    }
  };

  const showFeedback = (message, type) => {
    feedbackMessage.textContent = message;
    feedbackMessage.className = `show ${type}`;
    setTimeout(() => {
      feedbackMessage.classList.remove('show');
    }, 3000);
  };

  const validateInputs = () => {
    const keyword = keywordInput.value.trim();
    const replacement = replacementInput.value.trim();
    
    const keywordError = validateKeyword(keyword);
    const replacementError = validateReplacement(replacement);

    if (keywordError || replacementError) {
      saveButton.disabled = true;
      return false;
    }

    if (replacements[keyword]) {
      saveButton.disabled = true;
      return false;
    }

    saveButton.disabled = false;
    return true;
  };

  // Event listeners
  keywordInput.addEventListener('input', validateInputs);
  replacementInput.addEventListener('input', validateInputs);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const keyword = keywordInput.value.trim();
    const replacement = replacementInput.value.trim();

    const keywordError = validateKeyword(keyword);
    const replacementError = validateReplacement(replacement);

    if (keywordError) {
      showFeedback(keywordError, 'error');
      return;
    }

    if (replacementError) {
      showFeedback(replacementError, 'error');
      return;
    }

    if (replacements[keyword]) {
      showFeedback('A replacement with this keyword already exists', 'error');
      return;
    }

    replacements[keyword] = replacement;
    chrome.storage.sync.set({ replacements }, () => {
      keywordInput.value = '';
      replacementInput.value = '';
      charCounter.textContent = '0 / 10000';
      renderList();
      showFeedback('Replacement added successfully', 'success');
      validateInputs();
    });
  });

  extensionToggle.addEventListener('change', () => {
    const enabled = extensionToggle.checked;
    chrome.storage.sync.set({ textReplacementEnabled: enabled }, () => {
      showFeedback(`Text replacement ${enabled ? 'enabled' : 'disabled'}`, 'success');
    });
  });

  importButton.addEventListener('click', () => {
    importFile.click();
  });

  importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        
        if (!importedData.replacements || typeof importedData.replacements !== 'object') {
          showFeedback('Invalid file format', 'error');
          return;
        }

        // Validate imported data
        const validReplacements = {};
        let hasErrors = false;

        for (const [keyword, replacement] of Object.entries(importedData.replacements)) {
          const keywordError = validateKeyword(keyword);
          const replacementError = validateReplacement(replacement);

          if (keywordError || replacementError) {
            hasErrors = true;
            continue;
          }

          validReplacements[keyword] = replacement;
        }

        if (hasErrors) {
          showFeedback('Some replacements were skipped due to validation errors', 'error');
        }

        replacements = { ...replacements, ...validReplacements };
        chrome.storage.sync.set({ replacements }, () => {
          renderList();
          showFeedback(`Imported ${Object.keys(validReplacements).length} replacements`, 'success');
        });

      } catch (error) {
        showFeedback('Error reading file', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  });

  exportButton.addEventListener('click', () => {
    const data = { replacements };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'text-replacements.json';
    a.click();
    URL.revokeObjectURL(url);
    showFeedback('Replacements exported successfully', 'success');
  });

  // Character counter
  replacementInput.addEventListener('input', () => {
    const length = replacementInput.value.length;
    charCounter.textContent = `${length} / 10000`;
    charCounter.className = length > 10000 ? 'error' : '';
  });

  // Load initial data
  loadData();
});
