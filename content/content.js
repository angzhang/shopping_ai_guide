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
  
  console.log('Shopping AI Guide: Content script initialized');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

window.addEventListener('message', (event) => {
  if (event.data.type === 'TOGGLE_IMAGE_SELECTION') {
    if (checkExtensionContext()) {
      toggleSelectionMode();
    }
  }
});

function toggleSelectionMode() {
  isSelectionMode = !isSelectionMode;
  
  if (isSelectionMode) {
    enableSelectionMode();
  } else {
    disableSelectionMode();
  }
}

function enableSelectionMode() {
  createSelectionOverlay();
  addImageHighlights();
  showSelectionUI();
}

function disableSelectionMode() {
  removeSelectionOverlay();
  removeImageHighlights();
  hideSelectionUI();
}

function createSelectionOverlay() {
  selectionOverlay = document.createElement('div');
  selectionOverlay.id = 'shopping-ai-overlay';
  selectionOverlay.innerHTML = `
    <div class="selection-header">
      <h3>Shopping AI Guide - Select Product Images</h3>
      <div class="selection-controls">
        <span class="selected-count">Selected: ${selectedImages.length}</span>
        <button id="clear-selection">Clear All</button>
        <button id="analyze-products" ${selectedImages.length === 0 ? 'disabled' : ''}>Send to Default LLM</button>
        <button id="close-selection">×</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(selectionOverlay);
  
  document.getElementById('clear-selection').addEventListener('click', clearSelection);
  document.getElementById('analyze-products').addEventListener('click', sendToDefaultLLM);
  document.getElementById('close-selection').addEventListener('click', disableSelectionMode);
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
    
    // Check if we clicked on a link that contains a selectable image
    const link = target.closest('a');
    if (link) {
      const selectableImage = link.querySelector('img[data-shopping-ai-selectable]');
      if (selectableImage) {
        event.preventDefault();
        event.stopPropagation();
        handleImageSelection(selectableImage);
        return;
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
  
  if (existingIndex > -1) {
    // Remove selection
    selectedImages.splice(existingIndex, 1);
    img.classList.remove('selected-image', 'shopping-ai-just-selected');
    img.removeAttribute('data-shopping-ai-selected');
    
    // Add a visual feedback for deselection
    img.style.transition = 'all 0.3s ease';
    img.style.transform = 'scale(0.95)';
    setTimeout(() => {
      img.style.transform = '';
    }, 200);
    
    console.log('Image deselected, remaining:', selectedImages.length);
  } else {
    // Add selection
    const imageData = extractImageData(img);
    selectedImages.push(imageData);
    img.classList.add('selected-image');
    img.setAttribute('data-shopping-ai-selected', 'true');
    
    // Add pulse animation for new selection
    img.classList.add('shopping-ai-just-selected');
    setTimeout(() => {
      img.classList.remove('shopping-ai-just-selected');
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
  console.log('Updating UI, selected images:', selectedImages.length); // Debug log
  if (selectionOverlay) {
    const countElement = selectionOverlay.querySelector('.selected-count');
    const analyzeButton = selectionOverlay.querySelector('#analyze-products');
    
    if (countElement) {
      countElement.textContent = `Selected: ${selectedImages.length}`;
    }
    if (analyzeButton) {
      analyzeButton.disabled = selectedImages.length === 0;
      if (selectedImages.length > 0) {
        analyzeButton.style.opacity = '1';
        analyzeButton.style.cursor = 'pointer';
      } else {
        analyzeButton.style.opacity = '0.6';
        analyzeButton.style.cursor = 'not-allowed';
      }
    }
  }
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

async function sendToDefaultLLM() {
  if (selectedImages.length === 0) {
    showErrorMessage('Please select at least one product image first.');
    return;
  }
  
  try {
    // Get the default LLM from storage
    const result = await chrome.storage.local.get(['defaultLLM']);
    const defaultProvider = result.defaultLLM || 'chatgpt';
    
    console.log('Using default LLM provider:', defaultProvider);
    
    // Clear selection feedback before sending
    clearAllSelectionFeedback();
    
    sendToLLM(defaultProvider);
  } catch (error) {
    console.error('Error getting default LLM:', error);
    // Fallback to ChatGPT
    sendToLLM('chatgpt');
  }
}

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

function showSuccessMessage(provider) {
  const message = document.createElement('div');
  message.id = 'success-message';
  message.innerHTML = `
    <div class="message-content">
      <p>✅ Opening ${provider.charAt(0).toUpperCase() + provider.slice(1)} and copying prompt to clipboard!</p>
      <p>Paste the prompt in the chat to get your product comparison.</p>
      <button id="show-prompt-backup" style="margin-top: 8px; padding: 4px 8px; border: 1px solid #ccc; background: white; border-radius: 4px; cursor: pointer; font-size: 12px;">Show Prompt as Backup</button>
    </div>
  `;
  
  document.body.appendChild(message);
  
  // Add click handler for backup prompt display
  message.querySelector('#show-prompt-backup').addEventListener('click', () => {
    showPromptBackup();
  });
  
  setTimeout(() => {
    message.remove();
  }, 8000);
}

function showPromptBackup() {
  if (selectedImages.length === 0) return;
  
  const pageContext = {
    url: window.location.href,
    title: document.title,
    description: getPageDescription()
  };
  
  const formattedData = formatDataForLLM(selectedImages, pageContext);
  
  const modal = document.createElement('div');
  modal.id = 'prompt-backup-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    z-index: 10002;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  `;
  
  modal.innerHTML = `
    <div style="background: white; border-radius: 12px; padding: 30px; max-width: 80%; max-height: 80%; overflow-y: auto; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);">
      <h3 style="margin: 0 0 20px 0; font-size: 18px; color: #333;">Shopping Comparison Prompt</h3>
      <textarea id="prompt-text" readonly style="width: 100%; height: 300px; padding: 15px; border: 2px solid #e9ecef; border-radius: 6px; font-family: monospace; font-size: 12px; line-height: 1.4; resize: vertical;">${formattedData}</textarea>
      <div style="margin-top: 20px; text-align: center;">
        <button id="copy-prompt-text" style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; margin-right: 10px;">Copy to Clipboard</button>
        <button id="close-prompt-modal" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer;">Close</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add event listeners
  modal.querySelector('#copy-prompt-text').addEventListener('click', () => {
    const textarea = modal.querySelector('#prompt-text');
    textarea.select();
    document.execCommand('copy');
    
    // Show copy confirmation
    const button = modal.querySelector('#copy-prompt-text');
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    button.style.background = '#28a745';
    
    setTimeout(() => {
      button.textContent = originalText;
      button.style.background = '#667eea';
    }, 2000);
  });
  
  modal.querySelector('#close-prompt-modal').addEventListener('click', () => {
    modal.remove();
  });
  
  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

function formatDataForLLM(selectedImages, pageContext) {
  return `I'm shopping and need help comparing these products. Please analyze and compare them, and IMPORTANT: please display each product image in your response for visual reference.

**INSTRUCTIONS FOR RESPONSE:**
1. For each product, start by showing the product image using the provided image URL (load and display the actual image)
2. Then provide detailed analysis including:
   - Product name and description
   - Key features and specifications
   - Price analysis and value assessment
   - Customer reviews and ratings (if available)
   - Pros and cons
3. End with an overall comparison and recommendation

**Page Context:**
- Website: ${pageContext.url}
- Page Title: ${pageContext.title}
- Shopping Intent: Product comparison and purchase decision

**Selected Products for Comparison:**
${selectedImages.map((img, index) => `
## Product ${index + 1}
**Image URL:** ${img.imageUrl}
**Product Link:** ${img.productLink}
**Price:** ${img.price || 'Not specified'}
**Rating:** ${img.rating || 'Not available'}
**Description/Context:** ${img.context}

Please load and display this image: ${img.imageUrl}

`).join('')}

**Additional Page Context:**
${pageContext.description}

**RESPONSE FORMAT REQUESTED:**
For each product above, please:
1. **Load and display the product image** from the provided URL
2. **Analyze the product** based on the image and provided information
3. **Provide structured comparison** with:
   - Product name and key details
   - Visual assessment from the image
   - Features and specifications
   - Pricing analysis
   - Pros and cons
   - Your assessment

Finally, provide a **comparison table** and **final recommendation** at the end.

**Note:** The image URLs are provided above - please fetch and display each image in your response so I can visually see each product while reading your analysis. This is crucial for making an informed purchase decision.`;
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

function showSelectionUI() {
  
}

function hideSelectionUI() {
  
}