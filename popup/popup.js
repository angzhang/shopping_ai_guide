document.addEventListener('DOMContentLoaded', async () => {
  await loadStoredData();
  setupEventListeners();
});

async function loadStoredData() {
  try {
    const data = await chrome.storage.local.get(['geminiModel', 'lastSelection', 'geminiApiKey']);

    if (data.geminiModel) {
      document.getElementById('gemini-model').value = data.geminiModel;
    } else {
      // Set default model
      document.getElementById('gemini-model').value = 'gemini-2.5-flash';
      await chrome.storage.local.set({ geminiModel: 'gemini-2.5-flash' });
    }

    if (data.geminiApiKey) {
      document.getElementById('gemini-api-key').value = data.geminiApiKey;
      showApiKeyStatus('API key loaded', 'success');
    }

    if (data.lastSelection) {
      showRecentSection(data.lastSelection);
    }
  } catch (error) {
    console.error('Error loading stored data:', error);
  }
}

function setupEventListeners() {
  document.getElementById('start-selection').addEventListener('click', startSelection);
  document.getElementById('gemini-model').addEventListener('change', saveGeminiModel);
  document.getElementById('resend-recent').addEventListener('click', resendRecent);

  // Gemini API key handlers
  const apiKeyInput = document.getElementById('gemini-api-key');
  apiKeyInput.addEventListener('input', saveGeminiApiKey);
  apiKeyInput.addEventListener('blur', validateApiKey);

  document.getElementById('toggle-api-key').addEventListener('click', toggleApiKeyVisibility);
}

async function saveGeminiApiKey() {
  const apiKey = document.getElementById('gemini-api-key').value.trim();

  try {
    await chrome.storage.local.set({ geminiApiKey: apiKey });

    if (apiKey) {
      showApiKeyStatus('API key saved', 'success');
    } else {
      hideApiKeyStatus();
    }
  } catch (error) {
    console.error('Error saving Gemini API key:', error);
    showApiKeyStatus('Failed to save API key', 'error');
  }
}

async function validateApiKey() {
  const apiKey = document.getElementById('gemini-api-key').value.trim();

  if (!apiKey) {
    hideApiKeyStatus();
    return;
  }

  // Basic validation: Gemini API keys typically start with "AIza"
  if (!apiKey.startsWith('AIza')) {
    showApiKeyStatus('Warning: API key format looks incorrect', 'error');
  } else {
    showApiKeyStatus('API key format looks valid', 'success');
  }
}

function toggleApiKeyVisibility() {
  const apiKeyInput = document.getElementById('gemini-api-key');
  const button = document.getElementById('toggle-api-key');

  if (apiKeyInput.type === 'password') {
    apiKeyInput.type = 'text';
    button.textContent = '🙈';
  } else {
    apiKeyInput.type = 'password';
    button.textContent = '👁️';
  }
}

function showApiKeyStatus(message, type) {
  const statusDiv = document.getElementById('api-key-status');
  statusDiv.textContent = message;
  statusDiv.className = `api-key-status ${type}`;
  statusDiv.style.display = 'block';

  // Auto-hide after 3 seconds for non-error messages
  if (type === 'success') {
    setTimeout(() => {
      hideApiKeyStatus();
    }, 3000);
  }
}

function hideApiKeyStatus() {
  const statusDiv = document.getElementById('api-key-status');
  statusDiv.style.display = 'none';
}

async function startSelection() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: toggleImageSelection
    });
    
    window.close();
  } catch (error) {
    console.error('Error starting selection:', error);
    showError('Failed to start image selection. Please try again.');
  }
}

function toggleImageSelection() {
  window.postMessage({ type: 'TOGGLE_IMAGE_SELECTION' }, '*');
}

async function saveGeminiModel() {
  const selectedModel = document.getElementById('gemini-model').value;

  try {
    await chrome.storage.local.set({ geminiModel: selectedModel });
    console.log('Saved Gemini model:', selectedModel);
  } catch (error) {
    console.error('Error saving Gemini model:', error);
  }
}

async function resendRecent() {
  try {
    const data = await chrome.storage.local.get(['lastSelection']);

    if (!data.lastSelection) {
      showError('No recent selection found.');
      return;
    }

    const { data: selectionData } = data.lastSelection;

    chrome.runtime.sendMessage({
      action: 'sendToGemini',
      data: {
        selectedImages: selectionData.selectedImages,
        pageContext: selectionData.pageContext
      }
    }, (response) => {
      if (response.success) {
        showSuccess('Resent to Gemini AI!');
      } else {
        showError(response.error || 'Failed to resend selection.');
      }
    });

  } catch (error) {
    console.error('Error resending recent selection:', error);
    showError('Failed to resend recent selection.');
  }
}

function showRecentSection(lastSelection) {
  const recentSection = document.getElementById('recent-section');
  const recentProvider = document.getElementById('recent-provider');
  const recentTime = document.getElementById('recent-time');

  recentProvider.textContent = 'Gemini AI';
  recentTime.textContent = formatTime(lastSelection.timestamp);

  recentSection.style.display = 'block';
  recentSection.classList.add('fade-in');
}

function formatTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (minutes < 1) {
    return 'Just now';
  } else if (minutes < 60) {
    return `${minutes} min ago`;
  } else if (hours < 24) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = message;
  errorDiv.style.cssText = `
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: #f8d7da;
    color: #721c24;
    padding: 10px 15px;
    border-radius: 6px;
    font-size: 12px;
    z-index: 1000;
    border: 1px solid #f5c6cb;
  `;
  
  document.body.appendChild(errorDiv);
  
  setTimeout(() => {
    errorDiv.remove();
  }, 3000);
}

function showSuccess(message) {
  const successDiv = document.createElement('div');
  successDiv.className = 'success-message';
  successDiv.textContent = message;
  successDiv.style.cssText = `
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: #d4edda;
    color: #155724;
    padding: 10px 15px;
    border-radius: 6px;
    font-size: 12px;
    z-index: 1000;
    border: 1px solid #c3e6cb;
  `;
  
  document.body.appendChild(successDiv);
  
  setTimeout(() => {
    successDiv.remove();
  }, 3000);
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.lastSelection) {
    showRecentSection(changes.lastSelection.newValue);
  }
});