// Quick Tools content script for Meraki Lightning Force pages
// Check if already initialized to prevent duplicate declarations
if (typeof window.merakiExpQuickToolsInitialized === 'undefined') {
  window.merakiExpQuickToolsInitialized = true;
  
  (function () {
    // Namespace for Quick Tools functionality
    const MerakiExpQuickTools = {
      enabled: false,
      utilityBar: null,
      statusButtonOrder: null,
      
      // Initialize the Quick Tools feature
      init() {
        if (!this.isLightningForcePage()) return;
        
        this.loadState().then(() => {
          this.setupMessageListener();
          this.setupObserver();
        });
      },
      
      // Check if we're on a Lightning Force page
      isLightningForcePage() {
        return location.hostname === 'meraki.lightning.force.com';
      },
      
      // Load the enabled state from storage
      loadState() {
        return new Promise((resolve) => {
          chrome.storage.sync.get(['enableQuickTools', 'enabled', 'statusButtonOrder'], (result) => {
            this.enabled = result.enableQuickTools !== false && result.enabled !== false;
            this.statusButtonOrder = result.statusButtonOrder || null;
            resolve();
          });
        });
      },
      
      // Setup message listener for toggle changes
      setupMessageListener() {
        chrome.runtime.onMessage.addListener((message) => {
          if (message.type === 'QUICK_TOOLS_TOGGLE') {
            this.enabled = message.enabled;
            if (this.enabled) {
              this.injectQuickToolsButton();
            } else {
              this.removeQuickToolsButton();
            }
          } else if (message.type === 'EXT_STATE') {
            this.loadState();
          }
        });
      },
      
      // Setup observer to watch for utility bar changes
      setupObserver() {
        const observer = new MutationObserver(() => {
          if (this.enabled && !document.querySelector('.meraki-exp-status-button')) {
            this.injectQuickToolsButton();
          }
        });
        
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      },
      
      // Inject the Quick Tools buttons into the utility bar
      injectQuickToolsButton() {
        if (!this.enabled) return;
        
        this.utilityBar = document.querySelector('.utilitybar.slds-utility-bar');
        if (!this.utilityBar) {
          return;
        }

        this.addMinimalDragStyles();

        // Create all status buttons in the specified order
        const buttonsToCreate = this.createStatusButtons();
        buttonsToCreate.forEach((buttonConfig, index) => {
          const button = this.createStatusButton(buttonConfig, index);
          this.utilityBar.appendChild(button);
        });
      },

      // Add minimal drag and drop styles
      addMinimalDragStyles() {
        if (document.getElementById('meraki-exp-drag-styles')) return;

        const style = document.createElement('style');
        style.id = 'meraki-exp-drag-styles';
        style.textContent = `
          .meraki-exp-status-button.meraki-exp-dragging {
            opacity: 0.5 !important;
          }
          
          .meraki-exp-status-button.meraki-exp-drag-over {
            border: 2px dashed #0070d2 !important;
            background: #f0f8ff !important;
          }
        `;
        document.head.appendChild(style);
      },
      
      // Create all status buttons in the specified order
      createStatusButtons() {
        const statusButtons = [
          { text: 'Ready - Deferred Work', action: () => this.executeStatusChange('Ready - Deferred Work'), icon: 'utility:user', color: 'green' },
          { text: 'Ready - Inbound Call', action: () => this.executeStatusChange('Ready - Inbound Call'), icon: 'utility:phone', color: 'green' },
          { text: 'Approved Busy', action: () => this.executeStatusChange('Approved Busy'), icon: 'utility:ban', color: 'orange' },
          { text: 'Break', action: () => this.executeStatusChange('Break'), icon: 'utility:coffee', color: 'orange' },
          { text: 'Lunch', action: () => this.executeStatusChange('Lunch'), icon: 'utility:food_and_drinks', color: 'orange' },
          { text: 'Meeting', action: () => this.executeStatusChange('Meeting'), icon: 'utility:groups', color: 'orange' },
          { text: 'Third Party Bridge', action: () => this.executeStatusChange('Third Party Bridge'), icon: 'utility:bridge', color: 'orange' },
          { text: 'Wrap Up', action: () => this.executeStatusChange('Wrap Up'), icon: 'utility:stop', color: 'orange' },
          { text: 'Offline', action: () => this.executeStatusChange('Offline'), icon: 'utility:close', color: 'red' }
        ];

        // Use custom order if available, otherwise use default order
        if (this.statusButtonOrder) {
          const orderedButtons = [];
          this.statusButtonOrder.forEach(text => {
            const buttonConfig = statusButtons.find(btn => btn.text === text);
            if (buttonConfig) {
              orderedButtons.push(buttonConfig);
            }
          });
          // Add any missing buttons that might have been added in updates
          statusButtons.forEach(btn => {
            if (!orderedButtons.find(orderedBtn => orderedBtn.text === btn.text)) {
              orderedButtons.push(btn);
            }
          });
          return orderedButtons;
        }

        return statusButtons;
      },
      
      // === Button Creation Functions ===
      // Handles the creation and setup of individual status buttons
      
      /**
       * Creates a single status button with drag and drop capabilities
       * @param {Object} buttonConfig - Configuration object containing button properties
       * @param {number} index - The index position of the button
       * @returns {HTMLElement} The created button list item element
       */
      createStatusButton(buttonConfig, index) {
        // Create the list item container
        const listItem = document.createElement('li');
        listItem.className = 'slds-utility-bar__item meraki-exp-status-button';
        listItem.setAttribute('data-aura-rendered-by', `meraki-exp-status-${index}`);
        listItem.setAttribute('draggable', 'true');
        listItem.setAttribute('data-button-index', index);
        listItem.setAttribute('data-button-text', buttonConfig.text);
        
        // Add drag event listeners with proper binding
        listItem.addEventListener('dragstart', (e) => {
          this.handleDragStart(e, index);
        });
        listItem.addEventListener('dragover', (e) => this.handleDragOver(e));
        listItem.addEventListener('drop', (e) => {
          this.handleDrop(e, index);
        });
        listItem.addEventListener('dragenter', (e) => this.handleDragEnter(e));
        listItem.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        
        // Create the button container
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'slds-utility-bar__item oneUtilityBarItem meraki-exp-status-container';
        buttonContainer.setAttribute('data-aura-rendered-by', `meraki-exp-status-${index}`);
        
        // Create the button
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'bare slds-button slds-utility-bar__action utilityBarButton uiButton meraki-exp-status-btn';
        button.setAttribute('aria-label', buttonConfig.text);
        button.setAttribute('aria-live', 'off');
        button.setAttribute('data-aura-rendered-by', `meraki-exp-status-${index}`);
        
        // Create the icon
        const iconContainer = document.createElement('div');
        iconContainer.className = `slds-icon_container slds-icon-${buttonConfig.icon.split(':')[1]} meraki-exp-status-icon`;
        
        // Create SVG icon with appropriate color based on status type
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('focusable', 'false');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('part', 'icon');
        
        // Set icon class based on color
        if (buttonConfig.color === 'green') {
          svg.className = 'slds-icon-text-success slds-m-left_small slds-shrink-none slds-icon_x-small';
        } else if (buttonConfig.color === 'orange') {
          svg.className = 'slds-icon-text-warning slds-m-left_small slds-shrink-none slds-icon_x-small';
        } else if (buttonConfig.color === 'red') {
          svg.className = 'slds-icon-text-error slds-m-left_small slds-shrink-none slds-icon_x-small';
        } else {
          svg.className = 'slds-icon-text-default slds-m-left_small slds-shrink-none slds-icon_x-small';
        }
        
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        
        circle.setAttribute('cx', '50');
        circle.setAttribute('cy', '50');
        circle.setAttribute('r', '30');
        
        g.appendChild(circle);
        svg.appendChild(g);
        iconContainer.appendChild(svg);
        
        // Create the text label
        const textSpan = document.createElement('span');
        textSpan.className = 'itemTitle slds-utility-bar__text meraki-exp-status-text';
        textSpan.textContent = buttonConfig.text;
        textSpan.setAttribute('data-aura-rendered-by', `meraki-exp-status-${index}`);
        
        // Create the colored indicator circle
        if (buttonConfig.color !== 'none') {
          const indicatorContainer = document.createElement('div');
          indicatorContainer.className = 'meraki-exp-status-indicator';
          
          let bgColor, borderColor;
          if (buttonConfig.color === 'green') {
            bgColor = '#4bce97';
            borderColor = '#2e844a';
          } else if (buttonConfig.color === 'orange') {
            bgColor = '#ff9a3c';
            borderColor = '#e67e00';
          } else if (buttonConfig.color === 'red') {
            bgColor = '#ea001e';
            borderColor = '#ba0517';
          }
          
          indicatorContainer.style.cssText = `
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-left: 8px;
            background-color: ${bgColor};
            border: 1px solid ${borderColor};
            vertical-align: middle;
          `;
          
          button.appendChild(iconContainer);
          button.appendChild(textSpan);
          button.appendChild(indicatorContainer);
        } else {
          button.appendChild(iconContainer);
          button.appendChild(textSpan);
        }
        
        buttonContainer.appendChild(button);
        listItem.appendChild(buttonContainer);
        
        // Add click event listener
        button.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          buttonConfig.action();
        });
        
        return listItem;
      },
      
      // === Drag and Drop Event Handlers ===
      // Handles the drag and drop reordering of status buttons
      
      /**
       * Handles the start of a drag operation
       * Sets the drag data and visual feedback
       */
      handleDragStart(e, index) {
        e.dataTransfer.setData('text/plain', index.toString());
        e.dataTransfer.effectAllowed = 'move';
        e.target.closest('.meraki-exp-status-button').style.opacity = '0.5';
        e.target.closest('.meraki-exp-status-button').classList.add('meraki-exp-dragging');
      },

      /**
       * Handles drag over events to enable drop zones
       */
      handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      },

      /**
       * Handles drag enter events to show drop zone feedback
       */
      handleDragEnter(e) {
        e.preventDefault();
        const targetButton = e.target.closest('.meraki-exp-status-button');
        if (targetButton) {
          targetButton.classList.add('meraki-exp-drag-over');
        }
      },

      /**
       * Handles drag leave events to remove drop zone feedback
       */
      handleDragLeave(e) {
        const targetButton = e.target.closest('.meraki-exp-status-button');
        if (targetButton) {
          targetButton.classList.remove('meraki-exp-drag-over');
        }
      },

      /**
       * Handles drop events to complete the reordering
       */
      handleDrop(e, dropIndex) {
        e.preventDefault();
        e.stopPropagation();
        
        const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
        
        if (dragIndex === dropIndex || isNaN(dragIndex)) {
          return;
        }
        
        // Reset styles
        document.querySelectorAll('.meraki-exp-status-button').forEach(btn => {
          btn.classList.remove('meraki-exp-drag-over');
          btn.classList.remove('meraki-exp-dragging');
          btn.style.opacity = '';
        });
        
        // Reorder the buttons
        this.reorderButtons(dragIndex, dropIndex);
      },

      // === Button Reordering Functions ===
      // Handles the logic for reordering and persisting button positions
      
      /**
       * Reorders the status buttons based on drag and drop indices
       * @param {number} fromIndex - The source index of the dragged button
       * @param {number} toIndex - The target index where the button should be placed
       */
      reorderButtons(fromIndex, toIndex) {
        // Get current button order
        const buttons = Array.from(document.querySelectorAll('.meraki-exp-status-button'));
        const buttonTexts = buttons.map(btn => btn.getAttribute('data-button-text'));
        
        // Validate indices
        if (fromIndex < 0 || fromIndex >= buttonTexts.length || 
            toIndex < 0 || toIndex >= buttonTexts.length) {
          return;
        }
        
        // Reorder the array
        const [movedButton] = buttonTexts.splice(fromIndex, 1);
        buttonTexts.splice(toIndex, 0, movedButton);
        
        // Save new order to storage
        this.saveButtonOrder(buttonTexts);
        
        // Re-render buttons with new order
        this.renderButtonsInOrder(buttonTexts);
        
        // Small delay to ensure DOM is fully updated
        setTimeout(() => {
          // DOM update complete, drag and drop ready
        }, 100);
      },

      /**
       * Saves the current button order to Chrome storage
       * @param {Array} buttonOrder - Array of button text strings in the desired order
       */
      saveButtonOrder(buttonOrder) {
        chrome.storage.sync.set({ statusButtonOrder: buttonOrder }, () => {
          // Button order saved successfully
        });
      },

      /**
       * Re-renders all status buttons in the specified order
       * @param {Array} buttonOrder - Array of button text strings in the desired order
       */
      renderButtonsInOrder(buttonOrder) {
        // Remove existing buttons
        const existingButtons = document.querySelectorAll('.meraki-exp-status-button');
        existingButtons.forEach(btn => btn.remove());
        
        // Re-add buttons in new order
        buttonOrder.forEach((buttonText, index) => {
          const buttonConfig = this.createStatusButtons().find(btn => btn.text === buttonText);
          if (buttonConfig) {
            const button = this.createStatusButton(buttonConfig, index);
            this.utilityBar.appendChild(button);
          }
        });
      },
      
      // Unified function to execute status changes
      async executeStatusChange(statusText) {
        try {
          
          // Step 1: Find and click the Omni-Channel button
          const omniChannelButton = this.findOmniChannelButton();
          if (!omniChannelButton) {
            return false;
          }
          
          omniChannelButton.click();
          
          // Step 2: Wait for popup and find the dropdown arrow
          await this.sleep(1000);
          
          const popupContainer = this.findOmniChannelPopup();
          if (!popupContainer) {
            return false;
          }
          
          // Find and click the dropdown arrow within the popup
          const dropdownArrow = popupContainer.querySelector('button[aria-haspopup="true"]');
          if (!dropdownArrow) {
            return false;
          }
          
          // Check if dropdown is already open
          if (dropdownArrow.getAttribute('aria-expanded') !== 'true') {
            dropdownArrow.click();
            await this.sleep(500);
          }
          
          // Step 3: Wait for submenu and click the desired status
          await this.waitForElement('a[role="menuitem"]', 5000);
          
          const statusLink = this.findStatusLink(statusText);
          if (!statusLink) {
            return false;
          }
          
          statusLink.click();
          return true;
          
        } catch (error) {
          return false;
        }
      },

      // Helper method to find Omni-Channel button
      findOmniChannelButton() {
        let omniChannelButton = document.querySelector('button.slds-utility-bar__action[aria-label*="Omni-Channel"]');
        
        if (!omniChannelButton) {
          omniChannelButton = document.querySelector('button.slds-utility-bar__action[aria-label*="Omni"]');
        }
        
        if (!omniChannelButton) {
          const allButtons = document.querySelectorAll('button.slds-utility-bar__action');
          omniChannelButton = Array.from(allButtons).find(btn => 
            btn.textContent.includes('Omni') || btn.textContent.includes('Channel')
          );
        }
        
        return omniChannelButton;
      },

      // Helper method to find Omni-Channel popup
      findOmniChannelPopup() {
        const popupSelectors = ['.slds-popover', '.slds-modal', '[role="dialog"]', '.popup', '.modal'];
        
        for (const selector of popupSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            if (element.textContent.includes('Omni') || element.textContent.includes('Channel') || 
                element.textContent.includes('Status') || element.textContent.includes('status')) {
              return element;
            }
          }
        }
        
        return null;
      },

      // Helper method to find status link
      findStatusLink(statusText) {
        const allMenuItems = document.querySelectorAll('a[role="menuitem"]');
        return Array.from(allMenuItems).find(link => 
          link.textContent.includes(statusText)
        );
      },
      
      // Utility function to sleep/wait
      sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
      },
      
      // Wait for an element to appear on the page
      waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
          const startTime = Date.now();
          
          const checkElement = () => {
            const element = document.querySelector(selector);
            if (element) {
              resolve(element);
              return;
            }
            
            if (Date.now() - startTime > timeout) {
              reject(new Error(`Element ${selector} not found within ${timeout}ms`));
              return;
            }
            
            setTimeout(checkElement, 100);
          };
          
          checkElement();
        });
      },
      
      // Remove the Quick Tools buttons
      removeQuickToolsButton() {
        const statusButtons = document.querySelectorAll('.meraki-exp-status-button');
        statusButtons.forEach(button => button.remove());
      },
      
      // Cleanup function
      cleanup() {
        this.enabled = false;
        this.removeQuickToolsButton();
        
        const customStyles = document.getElementById('meraki-exp-drag-styles');
        if (customStyles) {
          customStyles.remove();
        }
      }
    };
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        MerakiExpQuickTools.init();
      });
    } else {
      MerakiExpQuickTools.init();
    }
    
  })();
}
