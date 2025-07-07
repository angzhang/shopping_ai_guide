document.addEventListener('DOMContentLoaded', async () => {
  await loadStoredData();
  setupEventListeners();
});

async function loadStoredData() {
  try {
    const data = await chrome.storage.local.get(['defaultLLM', 'lastSelection']);
    
    if (data.defaultLLM) {
      document.getElementById('default-llm').value = data.defaultLLM;
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
  document.getElementById('default-llm').addEventListener('change', saveDefaultLLM);
  document.getElementById('resend-recent').addEventListener('click', resendRecent);
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

async function saveDefaultLLM() {
  const selectedLLM = document.getElementById('default-llm').value;
  
  try {
    await chrome.storage.local.set({ defaultLLM: selectedLLM });
  } catch (error) {
    console.error('Error saving default LLM:', error);
  }
}

async function resendRecent() {
  try {
    const data = await chrome.storage.local.get(['lastSelection']);
    
    if (!data.lastSelection) {
      showError('No recent selection found.');
      return;
    }
    
    const { provider, data: selectionData } = data.lastSelection;
    
    chrome.runtime.sendMessage({
      action: 'sendToLLM',
      data: {
        selectedImages: selectionData.selectedImages,
        llmProvider: provider,
        pageContext: selectionData.pageContext
      }
    }, (response) => {
      if (response.success) {
        showSuccess(`Reopened ${provider} with your previous selection!`);
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
  
  recentProvider.textContent = lastSelection.provider.charAt(0).toUpperCase() + lastSelection.provider.slice(1);
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