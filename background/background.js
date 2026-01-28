chrome.runtime.onInstalled.addListener(() => {
  console.log('Shopping AI Guide extension installed');
});

chrome.action.onClicked.addListener((tab) => {
  console.log('Shopping AI Guide: Extension icon clicked');
  console.log('Shopping AI Guide: Tab ID:', tab.id);
  console.log('Shopping AI Guide: Tab URL:', tab.url);
  console.log('Shopping AI Guide: Executing script to toggle image selection...');

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: toggleImageSelection
  }).then(() => {
    console.log('Shopping AI Guide: Script executed successfully');
  }).catch((error) => {
    console.error('Shopping AI Guide: Script execution failed:', error);
  });
});

function toggleImageSelection() {
  console.log('Shopping AI Guide: toggleImageSelection() function called in page context');
  console.log('Shopping AI Guide: Posting TOGGLE_IMAGE_SELECTION message...');
  window.postMessage({ type: 'TOGGLE_IMAGE_SELECTION' }, '*');
  console.log('Shopping AI Guide: Message posted');
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sendToGemini' || request.action === 'sendToLLM') {
    handleSendToGemini(request.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function handleSendToGemini(data) {
  const { selectedImages, pageContext } = data;

  const formattedData = formatDataForLLM(selectedImages, pageContext);

  chrome.storage.local.set({
    lastSelection: {
      timestamp: Date.now(),
      data: formattedData
    }
  });

  return await handleGeminiAPI(formattedData);
}

function formatDataForLLM(selectedImages, pageContext) {
  const prompt = `Analyze these ${selectedImages.length} products and help me decide which to buy.

Context: ${pageContext.title}

Products:
${selectedImages.map((img, index) => `
Product ${index + 1}: ${img.title || 'Unknown Product'}
Price: ${img.price || 'Price not detected in text'} | ${img.rating || 'No rating'}
Link: ${img.productLink || 'No link'}
Details: ${img.context.substring(0, 200)}
`).join('\n')}

IMPORTANT INSTRUCTIONS:
1. **USE PRODUCT NAMES**: Refer to products by their actual names (e.g., "Sony WH-1000XM5") instead of "Product 1".
2. **PRICING IS CRITICAL**: If the "Price" above says "not detected" or is missing, YOU MUST LOOK AT THE IMAGE to find the price tag or price text. If you find it in the image, use that price. If absolutely no price is visible in text or image, estimate the price range based on the product type and brand if possible, but clearly label it as "Est.".
3. **Format**: Format your response for a NARROW panel (420px wide).

Required Format:

## 🏆 Recommendation

[1-2 sentences: Which product wins and why?]

**Best Choice:** [Product Name]
**Why:** [One key reason]
**Price:** [State the price clearly]

---

## 📊 Quick Comparison

**[Product Name 1]**
• Price: [price]
• Pros: [2-3 key pros]
• Cons: [1-2 key cons]
• Best for: [who/what]

**[Product Name 2]**
• Price: [price]
• Pros: [2-3 key pros]
• Cons: [1-2 key cons]
• Best for: [who/what]

[Repeat for each product]

---

## 🔍 Detailed Feature Comparison

• **Material & Quality:**
  - [Product Name 1]: [Assessment]
  - [Product Name 2]: [Assessment]

• **User Rating Analysis:**
  - [Product Name 1]: [Analyze rating/reviews if available]
  - [Product Name 2]: [Analyze rating/reviews if available]

• **Value for Money:**
  - [Which offers better value and why?]

---

## 💡 Final Tips

• [One important consideration]
• [One thing to watch out for]

Keep each section CONCISE. Use short bullets. Avoid wide tables or long paragraphs.`;

  return {
    prompt,
    selectedImages,
    pageContext
  };
}

async function handleGeminiAPI(formattedData) {
  try {
    // Get the API key and selected model from storage
    const data = await chrome.storage.local.get(['geminiApiKey', 'geminiModel']);
    const apiKey = data.geminiApiKey;
    const selectedModel = data.geminiModel || 'gemini-2.5-flash';

    if (!apiKey) {
      throw new Error('Gemini API key not configured. Please add your API key in the extension settings.');
    }

    console.log('Using Gemini model:', selectedModel);

    // Download images as base64
    const imagesData = await Promise.all(
      formattedData.selectedImages.map(async (img) => {
        try {
          const base64 = await fetchImageAsBase64(img.imageUrl);
          return {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64
            }
          };
        } catch (error) {
          console.error('Failed to fetch image:', img.imageUrl, error);
          return null;
        }
      })
    );

    // Filter out failed images
    const validImages = imagesData.filter(img => img !== null);

    if (validImages.length === 0) {
      throw new Error('Failed to load any product images. Please try again.');
    }

    // Create the parts array with text prompt and images
    const parts = [
      { text: formattedData.prompt },
      ...validImages
    ];

    // Call Gemini API with the selected model
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: parts
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 65536,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          ]
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();

    console.log('Gemini API response:', result);

    // Check if response was blocked or incomplete
    const candidate = result.candidates?.[0];
    if (!candidate) {
      throw new Error('No response candidate from Gemini API');
    }

    // Check finish reason
    const finishReason = candidate.finishReason;
    console.log('Finish reason:', finishReason);

    if (finishReason === 'SAFETY') {
      throw new Error('Response blocked by safety filters. Try different images or adjust safety settings.');
    } else if (finishReason === 'MAX_TOKENS') {
      console.warn('Response truncated due to max tokens limit');
    } else if (finishReason === 'RECITATION') {
      throw new Error('Response blocked due to recitation concerns');
    }

    // Extract all text parts (sometimes response is split into multiple parts)
    const responseParts = candidate.content?.parts;
    if (!responseParts || responseParts.length === 0) {
      console.error('Full API response:', JSON.stringify(result, null, 2));
      throw new Error('No response parts received from Gemini API');
    }

    // Combine all text parts
    const responseText = responseParts.map(part => part.text || '').join('');

    if (!responseText) {
      console.error('Full API response:', JSON.stringify(result, null, 2));
      throw new Error('No response text received from Gemini API');
    }

    console.log('Response text length:', responseText.length, 'characters');
    console.log('Number of parts:', responseParts.length);

    // Return the analysis result to be displayed in the panel
    return {
      success: true,
      message: 'Gemini API analysis complete',
      analysis: responseText,
      images: formattedData.selectedImages,
      finishReason: finishReason
    };
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw error;
  }
}

async function fetchImageAsBase64(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Remove the data:image/xxx;base64, prefix
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw error;
  }
}