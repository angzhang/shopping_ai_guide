let isSelectionMode = false;
let selectedImages = [];
let selectionOverlay = null;

// Check if extension context is available
function checkExtensionContext() {
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.error('Shopping AI Guide: Extension context not available');
    return false;
  }
  return true;
}

// Initialize the content script
function initialize() {
  if (!checkExtensionContext()) {
    console.error('Shopping AI Guide: Failed to initialize - extension context unavailable');
    return;
  }

  console.log('Shopping AI Guide: Content script initialized successfully');
  console.log('Shopping AI Guide: Ready to receive messages');
  console.log('Shopping AI Guide: isSelectionMode =', isSelectionMode);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

window.addEventListener('message', (event) => {
  // Log all messages to help debug
  console.log('Shopping AI Guide: Message received:', event.data);

  if (event.data && event.data.type === 'TOGGLE_IMAGE_SELECTION') {
    console.log('Shopping AI Guide: TOGGLE_IMAGE_SELECTION message detected');
    console.log('Shopping AI Guide: Extension context available:', checkExtensionContext());
    console.log('Shopping AI Guide: Current selection mode:', isSelectionMode);

    if (checkExtensionContext()) {
      toggleSelectionMode();
    } else {
      console.error('Shopping AI Guide: Cannot toggle - extension context unavailable');
    }
  }
});

function toggleSelectionMode() {
  isSelectionMode = !isSelectionMode;
  console.log('Shopping AI Guide: Selection mode toggled to:', isSelectionMode);

  if (isSelectionMode) {
    console.log('Shopping AI Guide: Enabling selection mode...');
    enableSelectionMode();
    console.log('Shopping AI Guide: Selection mode enabled');
  } else {
    console.log('Shopping AI Guide: Disabling selection mode...');
    disableSelectionMode();
    console.log('Shopping AI Guide: Selection mode disabled');
  }
}

function enableSelectionMode() {
  console.log('Shopping AI Guide: enableSelectionMode() called');

  // Check if panel already exists
  if (selectionOverlay) {
    console.log('Shopping AI Guide: Panel already exists, showing it');
    selectionOverlay.style.display = 'flex';
    showSettingsView();
    return;
  }

  console.log('Shopping AI Guide: Creating new panel...');
  createSelectionOverlay();
  console.log('Shopping AI Guide: Panel created, checking visibility...');

  // Verify panel is in DOM
  const panel = document.getElementById('shopping-ai-panel');
  if (panel) {
    console.log('Shopping AI Guide: Panel found in DOM');
    console.log('Shopping AI Guide: Panel display:', window.getComputedStyle(panel).display);
    console.log('Shopping AI Guide: Panel visibility:', window.getComputedStyle(panel).visibility);
    console.log('Shopping AI Guide: Panel z-index:', window.getComputedStyle(panel).zIndex);
  } else {
    console.error('Shopping AI Guide: Panel NOT found in DOM after creation!');
  }

  // Don't add highlights yet - wait for user to click "Start Selecting Products"
  showSelectionUI();
}

function disableSelectionMode() {
  removeSelectionOverlay();
  removeImageHighlights();
  hideSelectionUI();
}

function createSelectionOverlay() {
  console.log('Shopping AI Guide: createSelectionOverlay() called');

  // Check if document.body exists
  if (!document.body) {
    console.error('Shopping AI Guide: document.body is null! Cannot create panel.');
    return;
  }

  console.log('Shopping AI Guide: Creating panel element...');
  selectionOverlay = document.createElement('div');
  selectionOverlay.id = 'shopping-ai-panel';
  selectionOverlay.innerHTML = `
    <div class="panel-header">
      <h3>🛍️ Shopping AI Guide</h3>
      <button id="close-panel" class="close-btn">×</button>
    </div>
    <div class="panel-content">
      <!-- Settings Section -->
      <div class="settings-section" id="settings-section">
        <div class="section-title">Settings</div>

        <div class="settings-group">
          <label class="settings-label">Gemini API Key</label>
          <div class="api-key-input-wrapper">
            <input type="password" id="panel-api-key" class="settings-input" placeholder="Enter your API key">
            <button id="toggle-panel-api-key" class="toggle-visibility-btn">👁️</button>
          </div>
          <p class="settings-help">Get your free key from <a href="https://makersuite.google.com/app/apikey" target="_blank">Google AI Studio</a></p>
          <div id="panel-api-status" class="api-status"></div>
        </div>

        <div class="settings-group">
          <label class="settings-label">Gemini Model</label>
          <select id="panel-model-select" class="settings-select">
            <option value="gemini-2.5-flash" selected>Gemini 2.5 Flash (Recommended)</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro (Most Capable)</option>
            <option value="gemini-3-pro-preview">Gemini 3 Pro Preview (Latest)</option>
            <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Fastest)</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
            <option value="gemini-1.5-flash">Gemini 1.5 Flash (Stable)</option>
            <option value="gemini-1.5-pro">Gemini 1.5 Pro (Stable)</option>
          </select>
        </div>

        <button id="start-selection-btn" class="primary-btn">Start Selecting Products</button>
      </div>

      <!-- Selection Section -->
      <div class="selection-section" id="selection-section" style="display: none;">
        <button id="back-to-settings" class="back-btn">← Settings</button>
        <div class="section-title">Selected Products</div>
        <div class="selected-info">
          <span class="selected-count">0 images selected</span>
          <button id="clear-selection" class="secondary-btn">Clear All</button>
        </div>
        <div id="selected-thumbnails" class="thumbnails-grid"></div>
        <button id="analyze-products" class="primary-btn" disabled>Analyze with Gemini AI</button>
      </div>

      <!-- Results Section -->
      <div class="results-section" id="results-section" style="display: none;">
        <button id="back-to-selection" class="back-btn">← New Analysis</button>
        <div class="section-title">Analysis Results</div>
        <div id="product-images-preview" class="product-images-preview"></div>
        <div id="analysis-content" class="analysis-content"></div>
      </div>

      <!-- Loading Section -->
      <div id="loading-section" class="loading-section" style="display: none;">
        <div class="loading-spinner"></div>
        <p>Analyzing products with Gemini AI...</p>
      </div>
    </div>
  `;

  console.log('Shopping AI Guide: Appending panel to document.body...');
  document.body.appendChild(selectionOverlay);
  console.log('Shopping AI Guide: Panel appended to document.body');
  console.log('Shopping AI Guide: Panel element:', selectionOverlay);
  console.log('Shopping AI Guide: Panel ID:', selectionOverlay.id);
  console.log('Shopping AI Guide: Panel parent:', selectionOverlay.parentElement);

  // Load saved settings
  console.log('Shopping AI Guide: Loading panel settings...');
  loadPanelSettings();

  // Event listeners
  console.log('Shopping AI Guide: Setting up event listeners...');
  document.getElementById('start-selection-btn').addEventListener('click', showSelectionView);
  document.getElementById('back-to-settings').addEventListener('click', showSettingsView);
  document.getElementById('back-to-selection').addEventListener('click', showSelectionView);
  document.getElementById('clear-selection').addEventListener('click', clearSelection);
  document.getElementById('analyze-products').addEventListener('click', sendToGemini);
  document.getElementById('close-panel').addEventListener('click', disableSelectionMode);
  document.getElementById('panel-api-key').addEventListener('input', savePanelApiKey);
  document.getElementById('panel-api-key').addEventListener('blur', validatePanelApiKey);
  document.getElementById('panel-model-select').addEventListener('change', savePanelModel);
  document.getElementById('toggle-panel-api-key').addEventListener('click', togglePanelApiKeyVisibility);

  console.log('Shopping AI Guide: Event listeners set up successfully');
  console.log('Shopping AI Guide: Panel creation completed successfully');
  console.log('Shopping AI Guide: Showing settings view...');

  // Show settings view by default
  showSettingsView();
}

function removeSelectionOverlay() {
  if (selectionOverlay) {
    selectionOverlay.remove();
    selectionOverlay = null;
  }
}

function addImageHighlights() {
  // Add highlight animation styles
  addHighlightAnimation();
  
  // Set up global click handler
  setupGlobalClickHandler();
  
  // Wait a bit for images to load, especially on dynamic sites like Pinterest
  setTimeout(() => {
    const images = document.querySelectorAll('img');
    console.log('Found', images.length, 'total images'); // Debug log
    
    let selectableCount = 0;
    images.forEach(img => {
      // Wait for image to load if not loaded yet
      if (img.naturalWidth === 0) {
        img.onload = () => {
          if (isProductImage(img)) {
            img.classList.add('selectable-image');
            setupImageSelection(img);
          }
        };
      } else {
        if (isProductImage(img)) {
          img.classList.add('selectable-image');
          setupImageSelection(img);
          selectableCount++;
        }
      }
    });
    
    console.log('Made', selectableCount, 'images selectable'); // Debug log
    
    // Also observe for new images added dynamically (Pinterest infinite scroll)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            const newImages = node.tagName === 'IMG' ? [node] : node.querySelectorAll('img');
            newImages.forEach(img => {
              if (img && !img.classList.contains('selectable-image') && isProductImage(img)) {
                img.classList.add('selectable-image');
                setupImageSelection(img);
              }
            });
          }
        });
      });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Store observer to disconnect later
    window.shoppingAIObserver = observer;
  }, 500);
}

function setupGlobalClickHandler() {
  // Remove any existing handler
  if (window.shoppingAIClickHandler) {
    document.removeEventListener('click', window.shoppingAIClickHandler, true);
  }
  
  // Create new global click handler
  window.shoppingAIClickHandler = function(event) {
    // Check if we're in selection mode
    if (!isSelectionMode) return;
    
    const target = event.target;
    
    // Check if the clicked element is a selectable image
    if (target.tagName === 'IMG' && target.hasAttribute('data-shopping-ai-selectable')) {
      event.preventDefault();
      event.stopPropagation();
      handleImageSelection(target);
      return;
    }
    
    // Check if we clicked on a wrapper div
    if (target.classList.contains('shopping-ai-wrapper')) {
      const img = target.querySelector('img');
      if (img) {
        event.preventDefault();
        event.stopPropagation();
        handleImageSelection(img);
        return;
      }
    }
    
    // Check if we clicked on a link that contains a selectable image or wrapper
    const link = target.closest('a');
    if (link) {
      const selectableImage = link.querySelector('img[data-shopping-ai-selectable]');
      const wrapper = link.querySelector('.shopping-ai-wrapper');
      if (selectableImage) {
        event.preventDefault();
        event.stopPropagation();
        handleImageSelection(selectableImage);
        return;
      } else if (wrapper) {
        const img = wrapper.querySelector('img');
        if (img) {
          event.preventDefault();
          event.stopPropagation();
          handleImageSelection(img);
          return;
        }
      }
    }
  };
  
  // Add the global click handler with capture to intercept before other handlers
  document.addEventListener('click', window.shoppingAIClickHandler, true);
}

function removeImageHighlights() {
  // Remove global click handler
  if (window.shoppingAIClickHandler) {
    document.removeEventListener('click', window.shoppingAIClickHandler, true);
    delete window.shoppingAIClickHandler;
  }

  // Clean up all wrapped images
  const wrappers = document.querySelectorAll('.shopping-ai-wrapper');
  wrappers.forEach(wrapper => {
    const img = wrapper.querySelector('img');
    if (img) {
      // Restore original image styles
      img.style.cssText = wrapper._originalStyle || '';
      // Move the image out of the wrapper
      wrapper.parentNode.insertBefore(img, wrapper);
    }
    // Remove the wrapper
    wrapper.remove();
  });

  // Disconnect the mutation observer
  if (window.shoppingAIObserver) {
    window.shoppingAIObserver.disconnect();
    delete window.shoppingAIObserver;
  }

  // Clear selected images array
  selectedImages = [];

  // Clear all selection feedback messages
  clearAllSelectionFeedback();
}

function setupImageSelection(img) {
  // If already wrapped, do nothing
  if (img.parentElement.classList.contains('shopping-ai-wrapper')) {
    return;
  }

  // Create a wrapper div
  const wrapper = document.createElement('div');
  wrapper.className = 'shopping-ai-wrapper selectable-image';
  wrapper.setAttribute('data-shopping-ai-selectable', 'true');

  // Also mark the image itself as selectable
  img.setAttribute('data-shopping-ai-selectable', 'true');

  // Copy relevant styles from the image to the wrapper
  const computedStyle = window.getComputedStyle(img);
  wrapper.style.cssText = `
    display: ${computedStyle.display};
    position: ${computedStyle.position === 'static' ? 'relative' : computedStyle.position};
    width: ${img.offsetWidth}px;
    height: ${img.offsetHeight}px;
    margin: ${computedStyle.margin};
    float: ${computedStyle.float};
  `;

  // Replace the image with the wrapper
  img.parentNode.insertBefore(wrapper, img);
  wrapper.appendChild(img);

  // Reset image styles to prevent conflicts
  img.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
  `;

  // Add a subtle animation to draw attention
  wrapper.style.animation = 'shopping-ai-highlight 2s ease-in-out';
  setTimeout(() => {
    wrapper.style.animation = '';
  }, 2000);
}

// Add highlight animation to CSS if not already present
function addHighlightAnimation() {
  const styleId = 'shopping-ai-highlight-style';
  if (document.getElementById(styleId)) return;
  
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @keyframes shopping-ai-highlight {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.8; }
    }
  `;
  document.head.appendChild(style);
}

function isProductImage(img) {
  const src = img.src.toLowerCase();
  const alt = (img.alt || '').toLowerCase();
  const className = (img.className || '').toLowerCase();
  const currentDomain = window.location.hostname.toLowerCase();
  
  // Pinterest-specific detection
  if (currentDomain.includes('pinterest')) {
    // Pinterest images are usually large and in specific containers
    if (img.width > 100 && img.height > 100) {
      const parent = img.closest('[data-test-id="pin"], [data-test-id="pinrep"], .Pinnable, .pinImageDim');
      if (parent) return true;
    }
    // Also check for Pinterest's image classes
    if (className.includes('pin') || className.includes('image')) {
      return img.width > 80 && img.height > 80;
    }
  }
  
  // General exclusions (stricter)
  const excludeKeywords = ['logo', 'banner', 'nav', 'header', 'footer', 'icon', 'avatar', 'profile'];
  if (excludeKeywords.some(keyword => src.includes(keyword) || alt.includes(keyword) || className.includes(keyword))) {
    return false;
  }
  
  // Size filter - be more permissive
  if (img.width < 80 || img.height < 80) {
    return false;
  }
  
  // Skip very small images relative to viewport
  if (img.width < 50 || img.height < 50) {
    return false;
  }
  
  // Product keywords (expanded)
  const productKeywords = ['product', 'item', 'buy', 'shop', 'price', 'cart', 'thumbnail', 'photo', 'image', 'pic'];
  
  // Check if it matches product keywords OR is reasonably sized
  const hasProductKeywords = productKeywords.some(keyword => 
    src.includes(keyword) || alt.includes(keyword) || className.includes(keyword)
  );
  
  // For shopping sites, be more inclusive with larger images
  const shoppingSites = ['amazon', 'ebay', 'etsy', 'shopify', 'walmart', 'target', 'pinterest', 'aliexpress'];
  const isShoppingSite = shoppingSites.some(site => currentDomain.includes(site));
  
  if (isShoppingSite && img.width > 120 && img.height > 120) {
    return true;
  }
  
  return hasProductKeywords || (img.width > 150 && img.height > 150);
}

function handleImageSelection(img) {
  // Make sure we have an image element
  if (!img || img.tagName !== 'IMG') {
    console.error('Invalid image element');
    return;
  }
  
  console.log('Image selected:', img.src); // Debug log
  
  // Check if already selected
  const existingIndex = selectedImages.findIndex(item => item.imageUrl === img.src);
  
  const wrapper = img.closest('.shopping-ai-wrapper');
  
  if (existingIndex > -1) {
    // Remove selection
    selectedImages.splice(existingIndex, 1);
    img.classList.remove('selected-image', 'shopping-ai-just-selected');
    img.removeAttribute('data-shopping-ai-selected');
    
    // Remove selection from wrapper if it exists
    if (wrapper) {
      wrapper.classList.remove('selected-image', 'shopping-ai-just-selected');
      wrapper.removeAttribute('data-shopping-ai-selected');
    }
    
    // Add a visual feedback for deselection
    const targetElement = wrapper || img;
    targetElement.style.transition = 'all 0.3s ease';
    targetElement.style.transform = 'scale(0.95)';
    setTimeout(() => {
      targetElement.style.transform = '';
    }, 200);
    
    console.log('Image deselected, remaining:', selectedImages.length);
  } else {
    // Add selection
    const imageData = extractImageData(img);
    selectedImages.push(imageData);
    img.classList.add('selected-image');
    img.setAttribute('data-shopping-ai-selected', 'true');
    
    // Add selection to wrapper if it exists
    if (wrapper) {
      wrapper.classList.add('selected-image');
      wrapper.setAttribute('data-shopping-ai-selected', 'true');
    }
    
    // Add pulse animation for new selection
    const targetElement = wrapper || img;
    targetElement.classList.add('shopping-ai-just-selected');
    setTimeout(() => {
      targetElement.classList.remove('shopping-ai-just-selected');
    }, 600);
    
    // Force a reflow to ensure styles are applied
    img.offsetHeight;
    
    console.log('Image added, total selected:', selectedImages.length);
  }
  
  updateSelectionUI();
  
  // Also show a temporary selection indicator
  showSelectionFeedback(img, existingIndex === -1);
}

function showSelectionFeedback(img, isSelected) {
  // Remove any existing feedback for this image first
  removeFeedback(img);

  const container = img.parentElement;
  if (!container) return;

  // Ensure the parent container can host a positioned element
  const computedStyle = window.getComputedStyle(container);
  if (computedStyle.position === 'static') {
    img._originalParentPosition = container.style.position;
    container.style.position = 'relative';
    img._parentPositionChanged = true;
  }

  const feedback = document.createElement('div');
  feedback.className = 'shopping-ai-selection-feedback';
  feedback.dataset.imageUrl = img.src;
  feedback.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: ${isSelected ? '#28a745' : '#dc3545'};
    color: white;
    padding: 8px 12px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: bold;
    z-index: 10001;
    pointer-events: auto;
    opacity: 0;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    white-space: nowrap;
    cursor: pointer;
    border: 2px solid rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(4px);
    min-width: 80px;
    text-align: center;
    line-height: 1;
  `;
  feedback.textContent = isSelected ? '✓ Selected' : '✗ Deselected';
  feedback.title = 'Click to dismiss';

  container.appendChild(feedback);
  img._feedbackElement = feedback;

  // Animate in
  setTimeout(() => {
    feedback.style.opacity = '1';
    feedback.style.transform = 'translate(-50%, -50%) scale(1.1)';
    setTimeout(() => {
      feedback.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 150);
  }, 10);

  // Auto-dismiss logic
  const dismissTimeout = isSelected ? 3000 : 2000; // Keep selected feedback longer
  setTimeout(() => {
    if (feedback.parentNode) {
      feedback.style.opacity = '0';
      feedback.style.transform = 'translate(-50%, -50%) scale(0.8)';
      setTimeout(() => removeFeedback(img), 300);
    }
  }, dismissTimeout);

  // Manual dismiss
  feedback.addEventListener('click', () => {
    if (feedback.parentNode) {
      feedback.style.opacity = '0';
      feedback.style.transform = 'translate(-50%, -50%) scale(0.8)';
      setTimeout(() => removeFeedback(img), 300);
    }
  });
}

function removeFeedback(img) {
  // Remove the feedback element itself
  if (img._feedbackElement && img._feedbackElement.parentNode) {
    img._feedbackElement.remove();
    delete img._feedbackElement;
  }

  // Restore parent's position if we changed it
  if (img._parentPositionChanged) {
    if (img.parentElement) {
        img.parentElement.style.position = img._originalParentPosition || '';
    }
    delete img._originalParentPosition;
    delete img._parentPositionChanged;
  }
}

function extractImageData(img) {
  const productLink = findProductLink(img);
  const context = extractProductContext(img);
  const price = extractPrice(img);
  const rating = extractRating(img);
  
  return {
    imageUrl: img.src,
    productLink: productLink,
    context: context,
    price: price,
    rating: rating,
    element: img
  };
}

function findProductLink(img) {
  let current = img.parentElement;
  
  while (current && current !== document.body) {
    if (current.tagName === 'A' && current.href) {
      return current.href;
    }
    
    const link = current.querySelector('a[href]');
    if (link) {
      return link.href;
    }
    
    current = current.parentElement;
  }
  
  return window.location.href;
}

function extractProductContext(img) {
  const container = img.closest('.product, .item, [class*="product"], [class*="item"]') || 
                   img.parentElement;
  
  const text = container ? container.innerText.trim() : '';
  const title = img.alt || img.title || '';
  
  return `${title} ${text}`.substring(0, 500);
}

function extractPrice(img) {
  const container = img.closest('.product, .item, [class*="product"], [class*="item"]') || 
                   img.parentElement;
  
  if (!container) return null;
  
  const priceRegex = /[\$£€¥₹][\d,]+\.?\d*/g;
  const text = container.innerText;
  const matches = text.match(priceRegex);
  
  return matches ? matches[0] : null;
}

function extractRating(img) {
  const container = img.closest('.product, .item, [class*="product"], [class*="item"]') || 
                   img.parentElement;
  
  if (!container) return null;
  
  const ratingElement = container.querySelector('[class*="rating"], [class*="star"], [class*="review"]');
  if (ratingElement) {
    const ratingText = ratingElement.innerText;
    const ratingMatch = ratingText.match(/(\d+\.?\d*)\s*\/?\s*5|(\d+\.?\d*)\s*stars?/i);
    if (ratingMatch) {
      return ratingMatch[1] || ratingMatch[2];
    }
  }
  
  return null;
}

function updateSelectionUI() {
  console.log('Updating UI, selected images:', selectedImages.length);
  if (selectionOverlay) {
    const countElement = selectionOverlay.querySelector('.selected-count');
    const analyzeButton = selectionOverlay.querySelector('#analyze-products');
    const thumbnailsGrid = selectionOverlay.querySelector('#selected-thumbnails');

    if (countElement) {
      countElement.textContent = `${selectedImages.length} image${selectedImages.length !== 1 ? 's' : ''} selected`;
    }

    if (analyzeButton) {
      analyzeButton.disabled = selectedImages.length === 0;
    }

    // Update thumbnails grid
    if (thumbnailsGrid) {
      thumbnailsGrid.innerHTML = '';
      selectedImages.forEach(img => {
        const thumbnailItem = document.createElement('div');
        thumbnailItem.className = 'thumbnail-item';
        thumbnailItem.innerHTML = `<img src="${img.imageUrl}" alt="Product">`;
        thumbnailsGrid.appendChild(thumbnailItem);
      });
    }
  }
}

// Panel view management
function showSettingsView() {
  console.log('Shopping AI Guide: showSettingsView() called');

  const settingsSection = document.getElementById('settings-section');
  const selectionSection = document.getElementById('selection-section');
  const resultsSection = document.getElementById('results-section');
  const loadingSection = document.getElementById('loading-section');

  if (settingsSection) {
    settingsSection.style.display = 'block';
    console.log('Shopping AI Guide: Settings section shown');
  } else {
    console.error('Shopping AI Guide: settings-section not found!');
  }

  if (selectionSection) {
    selectionSection.style.display = 'none';
  }

  if (resultsSection) {
    resultsSection.style.display = 'none';
  }

  if (loadingSection) {
    loadingSection.style.display = 'none';
  }

  console.log('Shopping AI Guide: Settings view displayed');
}

function showSelectionView() {
  const apiKey = document.getElementById('panel-api-key').value.trim();

  if (!apiKey) {
    showApiStatus('Please enter your Gemini API key first', 'error');
    return;
  }

  document.getElementById('settings-section').style.display = 'none';
  document.getElementById('selection-section').style.display = 'block';
  document.getElementById('results-section').style.display = 'none';
  document.getElementById('loading-section').style.display = 'none';

  // Enable image highlights when showing selection view
  addImageHighlights();
}

function showResultsView() {
  document.getElementById('settings-section').style.display = 'none';
  document.getElementById('selection-section').style.display = 'none';
  document.getElementById('results-section').style.display = 'block';
  document.getElementById('loading-section').style.display = 'none';
}

function showLoadingView() {
  document.getElementById('settings-section').style.display = 'none';
  document.getElementById('selection-section').style.display = 'none';
  document.getElementById('results-section').style.display = 'none';
  document.getElementById('loading-section').style.display = 'block';
}

// Panel settings management
async function loadPanelSettings() {
  try {
    const result = await chrome.storage.local.get(['geminiApiKey', 'geminiModel']);

    if (result.geminiApiKey) {
      document.getElementById('panel-api-key').value = result.geminiApiKey;
      showApiStatus('API key loaded', 'success');
    }

    if (result.geminiModel) {
      document.getElementById('panel-model-select').value = result.geminiModel;
    }
  } catch (error) {
    console.error('Error loading panel settings:', error);
  }
}

async function savePanelApiKey() {
  const apiKey = document.getElementById('panel-api-key').value.trim();

  try {
    await chrome.storage.local.set({ geminiApiKey: apiKey });

    if (apiKey) {
      showApiStatus('API key saved', 'success');
    } else {
      hideApiStatus();
    }
  } catch (error) {
    console.error('Error saving API key:', error);
    showApiStatus('Failed to save API key', 'error');
  }
}

async function validatePanelApiKey() {
  const apiKey = document.getElementById('panel-api-key').value.trim();

  if (!apiKey) {
    hideApiStatus();
    return;
  }

  if (!apiKey.startsWith('AIza')) {
    showApiStatus('Warning: API key format looks incorrect', 'error');
  } else {
    showApiStatus('API key format looks valid ✓', 'success');
  }
}

async function savePanelModel() {
  const model = document.getElementById('panel-model-select').value;

  try {
    await chrome.storage.local.set({ geminiModel: model });
    console.log('Model saved:', model);
  } catch (error) {
    console.error('Error saving model:', error);
  }
}

function togglePanelApiKeyVisibility() {
  const input = document.getElementById('panel-api-key');
  const button = document.getElementById('toggle-panel-api-key');

  if (input.type === 'password') {
    input.type = 'text';
    button.textContent = '🙈';
  } else {
    input.type = 'password';
    button.textContent = '👁️';
  }
}

function showApiStatus(message, type) {
  const status = document.getElementById('panel-api-status');
  if (status) {
    status.textContent = message;
    status.className = `api-status ${type}`;
    status.style.display = 'block';

    if (type === 'success') {
      setTimeout(() => hideApiStatus(), 3000);
    }
  }
}

function hideApiStatus() {
  const status = document.getElementById('panel-api-status');
  if (status) {
    status.style.display = 'none';
  }
}

function hideResults() {
  const resultsSection = document.getElementById('results-section');
  if (resultsSection) {
    resultsSection.style.display = 'none';
  }
}

function showResults(analysis, images = null) {
  const analysisContent = document.getElementById('analysis-content');
  const imagesPreview = document.getElementById('product-images-preview');

  // Display product images if provided
  if (imagesPreview && images && images.length > 0) {
    imagesPreview.innerHTML = `
      <div class="product-images-grid">
        ${images.map((img, index) => `
          <div class="product-image-card">
            <div class="product-image-wrapper">
              <img src="${img.imageUrl}" alt="Product ${index + 1}">
            </div>
            <div class="product-number">Product ${index + 1}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  if (analysisContent) {
    analysisContent.innerHTML = formatMarkdownToHTML(analysis);
    showResultsView();

    // Scroll to top of results
    const panelContent = document.querySelector('.panel-content');
    if (panelContent) {
      panelContent.scrollTop = 0;
    }
  }
}

function formatMarkdownToHTML(text) {
  let html = text;

  // Horizontal rules (---) - must be before headers
  html = html.replace(/^---+$/gim, '<hr>');

  // Headers (with emoji support)
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Lists - handle both * and - bullets, and •
  html = html.replace(/^[•\*\-] (.*$)/gim, '<li>$1</li>');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>.*?<\/li>\s*)+/gs, '<ul>$&</ul>');

  // Line breaks to paragraphs
  html = html.split('\n\n').map(para => {
    const trimmed = para.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') ||
        trimmed.startsWith('<li') || trimmed.startsWith('<hr')) {
      return trimmed;
    }
    return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');

  return html;
}

function clearSelection() {
  selectedImages.forEach(item => {
    if (item.element) {
      item.element.classList.remove('selected-image');
    }
  });
  selectedImages = [];
  updateSelectionUI();
  clearAllSelectionFeedback();
}

function clearAllSelectionFeedback() {
  // Clear feedback using the image references for proper cleanup
  const images = document.querySelectorAll('img[data-shopping-ai-selectable]');
  images.forEach(img => {
    if (img._feedbackElement) {
      img._feedbackElement.style.opacity = '0';
      img._feedbackElement.style.transform = 'translate(-50%, -50%) scale(0.8)';
      setTimeout(() => {
        removeFeedback(img);
      }, 300);
    }
  });
  
  // Also remove any orphaned feedback elements
  const orphanedFeedbacks = document.querySelectorAll('.shopping-ai-selection-feedback');
  orphanedFeedbacks.forEach(feedback => {
    feedback.style.opacity = '0';
    feedback.style.transform = 'translate(-50%, -50%) scale(0.8)';
    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.remove();
      }
    }, 300);
  });
}

async function sendToGemini() {
  if (selectedImages.length === 0) {
    showErrorMessage('Please select at least one product image first.');
    return;
  }

  // Clear selection feedback before sending
  clearAllSelectionFeedback();

  // Show loading state
  showLoadingView();

  const pageContext = {
    url: window.location.href,
    title: document.title,
    description: getPageDescription()
  };

  // Check if chrome.runtime is available
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
    console.error('Chrome extension runtime not available');
    showErrorMessage('Extension not properly loaded. Please refresh the page and try again.');
    showSelectionView();
    return;
  }

  console.log('Sending to Gemini AI with', selectedImages.length, 'images');

  try {
    chrome.runtime.sendMessage({
      action: 'sendToGemini',
      data: {
        selectedImages: selectedImages,
        pageContext: pageContext
      }
    }, (response) => {
      // Check for chrome.runtime.lastError
      if (chrome.runtime.lastError) {
        console.error('Chrome runtime error:', chrome.runtime.lastError);
        showErrorMessage('Extension communication error: ' + chrome.runtime.lastError.message);
        showSelectionView();
        return;
      }

      if (response && response.success) {
        // Display results in the panel with images
        if (response.data && response.data.analysis) {
          showResults(response.data.analysis, selectedImages);

          // Show warning if response was truncated
          if (response.data.finishReason === 'MAX_TOKENS') {
            showWarningMessage('Analysis may be incomplete due to length limits. Try selecting fewer products for complete analysis.');
          }
        }
      } else {
        showErrorMessage(response ? response.error : 'Unknown error occurred');
        showSelectionView();
      }
    });
  } catch (error) {
    console.error('Error sending message to background:', error);
    showErrorMessage('Failed to communicate with extension background. Please try reloading the extension.');
    showSelectionView();
  }
}

// Legacy function for backward compatibility
function sendToLLM(provider) {
  const pageContext = {
    url: window.location.href,
    title: document.title,
    description: getPageDescription()
  };
  
  // Check if chrome.runtime is available
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
    console.error('Chrome extension runtime not available');
    showErrorMessage('Extension not properly loaded. Please refresh the page and try again.');
    return;
  }
  
  console.log('Sending to LLM:', provider, 'with', selectedImages.length, 'images');
  
  try {
    chrome.runtime.sendMessage({
      action: 'sendToLLM',
      data: {
        selectedImages: selectedImages,
        llmProvider: provider,
        pageContext: pageContext
      }
    }, (response) => {
      // Check for chrome.runtime.lastError
      if (chrome.runtime.lastError) {
        console.error('Chrome runtime error:', chrome.runtime.lastError);
        showErrorMessage('Extension communication error: ' + chrome.runtime.lastError.message);
        return;
      }
      
      if (response && response.success) {
        showSuccessMessage(provider);
        disableSelectionMode();
      } else {
        showErrorMessage(response ? response.error : 'Unknown error occurred');
      }
    });
  } catch (error) {
    console.error('Error sending message to background:', error);
    showErrorMessage('Failed to communicate with extension background. Please try reloading the extension.');
  }
}

function getPageDescription() {
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    return metaDescription.getAttribute('content');
  }
  
  const firstParagraph = document.querySelector('p');
  if (firstParagraph) {
    return firstParagraph.innerText.substring(0, 200);
  }
  
  return '';
}

function showSuccessMessage(message = 'Success!') {
  const messageDiv = document.createElement('div');
  messageDiv.id = 'success-message';
  messageDiv.innerHTML = `
    <div class="message-content">
      <p>✅ ${message}</p>
    </div>
  `;

  document.body.appendChild(messageDiv);

  setTimeout(() => {
    messageDiv.remove();
  }, 3000);
}

function formatDataForLLM(selectedImages, pageContext) {
  return `I'm comparing these ${selectedImages.length} products and need your help making a purchase decision.

# Task
Analyze each product image, compare features and value, then recommend which to buy.

# Context
- Page: ${pageContext.title}
- URL: ${pageContext.url}

# Products to Compare
${selectedImages.map((img, index) => `
**Product ${index + 1}**
- Image: ${img.imageUrl}
- Link: ${img.productLink}
- Price: ${img.price || 'Not specified'}
- Rating: ${img.rating || 'Not available'}
- Details: ${img.context}
`).join('\n')}

# Required Output Format

For each product:
1. Display the product image (load from URL above)
2. Identify the product name and type
3. List key features visible in the image
4. Assess quality indicators
5. Analyze price-to-value ratio

Then provide:
- Comparison table highlighting key differences
- Pros/cons for each option
- Clear recommendation with reasoning
- Alternative suggestions if applicable

Please load and display each product image from the URLs above for visual reference.`;
}

function showErrorMessage(error) {
  const message = document.createElement('div');
  message.id = 'error-message';
  message.innerHTML = `
    <div class="message-content">
      <p>❌ Error: ${error}</p>
    </div>
  `;

  document.body.appendChild(message);

  setTimeout(() => {
    message.remove();
  }, 5000);
}

function showWarningMessage(warning) {
  const message = document.createElement('div');
  message.id = 'warning-message';
  message.innerHTML = `
    <div class="message-content">
      <p>⚠️ ${warning}</p>
    </div>
  `;

  document.body.appendChild(message);

  setTimeout(() => {
    message.remove();
  }, 8000);
}

function showSelectionUI() {
  
}

function hideSelectionUI() {
  
}