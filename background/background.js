chrome.runtime.onInstalled.addListener(() => {
  console.log('AI Shopping Assistant extension installed');
});

chrome.action.onClicked.addListener((tab) => {
  console.log('AI Shopping Assistant: Extension icon clicked');
  console.log('AI Shopping Assistant: Tab ID:', tab.id);
  console.log('AI Shopping Assistant: Tab URL:', tab.url);
  console.log('AI Shopping Assistant: Executing script to toggle image selection...');

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: toggleImageSelection
  }).then(() => {
    console.log('AI Shopping Assistant: Script executed successfully');
  }).catch((error) => {
    console.error('AI Shopping Assistant: Script execution failed:', error);
  });
});

function toggleImageSelection() {
  console.log('AI Shopping Assistant: toggleImageSelection() function called in page context');
  console.log('AI Shopping Assistant: Posting TOGGLE_IMAGE_SELECTION message...');
  window.postMessage({ type: 'TOGGLE_IMAGE_SELECTION' }, '*');
  console.log('AI Shopping Assistant: Message posted');
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

  // Fetch product page details (description + reviews) for each product link
  const enrichedImages = await Promise.all(selectedImages.map(async (img) => {
    if (!img.productLink || img.productLink === pageContext.url) {
      return img;
    }
    try {
      const pageDetails = await fetchProductPageDetails(img.productLink);
      return { ...img, pageDetails };
    } catch (e) {
      console.warn('AI Shopping Assistant: Failed to fetch product page:', img.productLink, e);
      return img;
    }
  }));

  const formattedData = formatDataForLLM(enrichedImages, pageContext);

  chrome.storage.local.set({
    lastSelection: {
      timestamp: Date.now(),
      data: formattedData
    }
  });

  return await handleGeminiAPI(formattedData);
}

async function fetchProductPageDetails(url) {
  const response = await fetch(url, {
    headers: {
      // Mimic a browser request to avoid bot-blocking
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Remove noise elements
  ['script', 'style', 'nav', 'header', 'footer', 'iframe', 'noscript'].forEach(tag => {
    doc.querySelectorAll(tag).forEach(el => el.remove());
  });

  const result = {};

  // --- Product description ---
  const descSelectors = [
    // Amazon
    '#productDescription', '#feature-bullets', '#aplus',
    '[data-feature-name="productDescription"]',
    // Generic
    '[class*="product-description"]', '[class*="productDescription"]',
    '[class*="product-detail"]', '[class*="productDetail"]',
    '[itemprop="description"]',
  ];
  for (const sel of descSelectors) {
    const el = doc.querySelector(sel);
    if (el) {
      result.description = el.innerText?.trim() || el.textContent?.trim();
      if (result.description) break;
    }
  }

  // --- Specifications ---
  const specSelectors = [
    '#productDetails_techSpec_section_1', '#productDetails_detailBullets_sections1',
    '[class*="specifications"]', '[class*="tech-spec"]', '[class*="techSpec"]',
  ];
  for (const sel of specSelectors) {
    const el = doc.querySelector(sel);
    if (el) {
      result.specs = el.innerText?.trim() || el.textContent?.trim();
      if (result.specs) break;
    }
  }

  // --- Customer reviews ---
  // Amazon loads reviews via JS, so try the static /product-reviews/ page instead
  result.reviews = await fetchAmazonReviews(url, doc);

  return result;
}

async function fetchAmazonReviews(productUrl, productDoc) {
  // Try extracting reviews from the already-fetched product page doc first
  const reviewTexts = extractReviewsFromDoc(productDoc);
  if (reviewTexts.length > 0) {
    return reviewTexts.slice(0, 5).map(r => r.substring(0, 400)).join('\n---\n');
  }

  // For Amazon, derive the /product-reviews/<ASIN> URL and fetch it separately
  // Amazon product URLs look like: /dp/ASIN or /gp/product/ASIN
  const asinMatch = productUrl.match(/(?:\/dp\/|\/gp\/product\/)([A-Z0-9]{10})/i);
  if (asinMatch) {
    const asin = asinMatch[1];
    const reviewsUrl = `https://www.amazon.com/product-reviews/${asin}/?reviewerType=all_reviews&sortBy=recent`;
    try {
      const resp = await fetch(reviewsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        }
      });
      if (resp.ok) {
        const html = await resp.text();
        const parser = new DOMParser();
        const reviewDoc = parser.parseFromString(html, 'text/html');
        const texts = extractReviewsFromDoc(reviewDoc);
        if (texts.length > 0) {
          return texts.slice(0, 5).map(r => r.substring(0, 400)).join('\n---\n');
        }
      }
    } catch (e) {
      console.warn('AI Shopping Assistant: Failed to fetch Amazon reviews page:', e);
    }
  }

  return null;
}

function extractReviewsFromDoc(doc) {
  // Ordered from most specific to most generic
  const reviewSelectors = [
    '[data-hook="review-body"]',       // Amazon review body text
    '[data-hook="review"]',            // Amazon review container
    '#cm-cr-dp-review-list .review',   // Amazon review list items
    '.review-text-content',
    '[class*="review-body"]',
    '[class*="reviewBody"]',
    '[class*="review-text"]',
    '[class*="reviewText"]',
    '[class*="customer-review"]',
    '[itemprop="reviewBody"]',
    '[itemprop="review"]',
  ];

  for (const sel of reviewSelectors) {
    const els = doc.querySelectorAll(sel);
    const texts = [];
    els.forEach(el => {
      const text = (el.innerText || el.textContent || '').trim();
      if (text.length > 30) texts.push(text);
    });
    if (texts.length > 0) return texts;
  }
  return [];
}

function formatDataForLLM(selectedImages, pageContext) {
  const prompt = `Analyze these ${selectedImages.length} products and help me decide which to buy.

Context: ${pageContext.title}

Products:
${selectedImages.map((img, index) => {
  const pd = img.pageDetails;
  const descSection = pd?.description ? `\nDescription: ${pd.description.substring(0, 500)}` : '';
  const specsSection = pd?.specs ? `\nSpecs: ${pd.specs.substring(0, 300)}` : '';
  const reviewsSection = pd?.reviews ? `\nCustomer Reviews:\n${pd.reviews}` : '';
  return `
Product ${index + 1}: ${img.title || 'Unknown Product'}
Price: ${img.price || 'Price not detected in text'} | ${img.rating || 'No rating'}
Link: ${img.productLink || 'No link'}
Listing snippet: ${img.context.substring(0, 200)}${descSection}${specsSection}${reviewsSection}`;
}).join('\n')}

IMPORTANT INSTRUCTIONS:
1. **USE PRODUCT NAMES**: Refer to products by their actual full model names (e.g., "Sony WH-1000XM5 Wireless Headphones"). Look at the image and the Details field to determine the exact model name — do NOT use generic names like "CANON (Generic Printer)". If the title looks too generic, use what you can see in the image or details instead.
2. **PRICING IS CRITICAL**: If the "Price" above says "not detected" or is missing, YOU MUST LOOK AT THE IMAGE to find the price tag or price text. If you find it in the image, use that price. If absolutely no price is visible in text or image, estimate the price range based on the product type and brand if possible, but clearly label it as "Est.".
3. **Format**: Format your response for a NARROW panel (420px wide).
4. **LINKS**: For each product that has a Link above (not "No link"), make the product name itself a markdown link using the exact URL from the "Link:" field above (e.g., **[Product Name](url)**). Do NOT add a separate "View Product" bullet — the product name should be the clickable link.
5. **REVIEWS**: If Customer Reviews are provided above, incorporate key sentiments (common praise, common complaints) into your Pros/Cons and User Rating Analysis. Quote specific reviewer concerns where relevant.

Required Format:

## 🏆 Recommendation

[1-2 sentences: Which product wins and why?]

**Best Choice:** [Product Name](link url if available, otherwise just the name)
**Why:** [One key reason]
**Price:** [State the price clearly]

---

## 📊 Quick Comparison

**[Product Name 1](link url if available, otherwise just the name)**
• Price: [price]
• Pros: [2-3 key pros]
• Cons: [1-2 key cons]
• Best for: [who/what]

**[Product Name 2](link url if available, otherwise just the name)**
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
      finishReason: finishReason,
      prompt: formattedData.prompt
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