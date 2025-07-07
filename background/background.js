chrome.runtime.onInstalled.addListener(() => {
  console.log('Shopping AI Guide extension installed');
});

chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: toggleImageSelection
  });
});

function toggleImageSelection() {
  window.postMessage({ type: 'TOGGLE_IMAGE_SELECTION' }, '*');
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sendToLLM') {
    handleSendToLLM(request.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function handleSendToLLM(data) {
  const { selectedImages, llmProvider, pageContext } = data;
  
  const formattedData = formatDataForLLM(selectedImages, pageContext);
  
  chrome.storage.local.set({
    lastSelection: {
      timestamp: Date.now(),
      data: formattedData,
      provider: llmProvider
    }
  });
  
  return await openLLMChatTool(llmProvider, formattedData);
}

function formatDataForLLM(selectedImages, pageContext) {
  const prompt = `I'm shopping and need help comparing these products. Please analyze and compare them, and IMPORTANT: please display each product image in your response for visual reference.

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

  return {
    prompt,
    selectedImages,
    pageContext
  };
}

async function openLLMChatTool(provider, formattedData) {
  const urls = {
    chatgpt: 'https://chat.openai.com/',
    claude: 'https://claude.ai/',
    gemini: 'https://gemini.google.com/',
    copilot: 'https://copilot.microsoft.com/',
    perplexity: 'https://www.perplexity.ai/'
  };

  const url = urls[provider];
  if (!url) {
    throw new Error('Unsupported LLM provider');
  }

  try {
    // Get the original tab first (before creating new tab)
    const [originalTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Copy to clipboard in the original tab BEFORE opening new tab
    if (originalTab) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: originalTab.id },
          func: copyToClipboard,
          args: [formattedData.prompt]
        });
        console.log('Prompt copied to clipboard before opening LLM tool');
      } catch (clipboardError) {
        console.error('Clipboard copy failed:', clipboardError);
        // Store the prompt for later retrieval
        await chrome.storage.local.set({ 
          pendingPrompt: formattedData.prompt,
          promptTimestamp: Date.now()
        });
      }
    }
    
    // Small delay to ensure clipboard operation completes
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Create new tab with the LLM provider
    const newTab = await chrome.tabs.create({ url });
    
    // Try to inject a notification script into the new tab after it loads
    setTimeout(async () => {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: newTab.id },
          func: showPromptNotification,
          args: [provider]
        });
      } catch (error) {
        console.log('Could not inject notification script:', error);
      }
    }, 3000);
    
    return { success: true, message: 'Opening LLM chat tool and copying prompt to clipboard' };
  } catch (error) {
    console.error('Error opening LLM tool:', error);
    throw new Error('Failed to open LLM chat tool: ' + error.message);
  }
}

// Function to be injected into the page to copy text to clipboard
function copyToClipboard(text) {
  return new Promise((resolve, reject) => {
    // First try the modern clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        console.log('Prompt copied to clipboard successfully');
        // Show a visual confirmation
        showCopyConfirmation();
        resolve();
      }).catch(err => {
        console.warn('Modern clipboard API failed, trying fallback:', err);
        fallbackCopy(text, resolve, reject);
      });
    } else {
      // Use fallback method
      fallbackCopy(text, resolve, reject);
    }
  });
  
  function fallbackCopy(text, resolve, reject) {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.opacity = '0';
      textArea.style.pointerEvents = 'none';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        console.log('Prompt copied using fallback method');
        showCopyConfirmation();
        resolve();
      } else {
        console.error('Fallback copy failed');
        reject(new Error('Copy failed'));
      }
    } catch (err) {
      console.error('Fallback copy error:', err);
      reject(err);
    }
  }
  
  function showCopyConfirmation() {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #28a745;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    `;
    notification.textContent = '✓ Shopping prompt copied to clipboard!';
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// Function to show prompt notification in the LLM chat tool
function showPromptNotification(provider) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #667eea;
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    max-width: 300px;
    line-height: 1.4;
  `;
  notification.innerHTML = `
    <div style="margin-bottom: 8px; font-weight: 600;">🛍️ Shopping AI Guide</div>
    <div>Your product comparison prompt has been copied to clipboard. Paste it here (Ctrl+V / Cmd+V) to get started!</div>
  `;
  document.body.appendChild(notification);
  
  // Auto-dismiss after 8 seconds
  setTimeout(() => {
    notification.remove();
  }, 8000);
  
  // Allow manual dismiss by clicking
  notification.addEventListener('click', () => {
    notification.remove();
  });
}