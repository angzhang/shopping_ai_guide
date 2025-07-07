# Shopping AI Guide - Chrome Extension

A Chrome extension that helps you select product images from web pages and send them to LLM chat tools for AI-powered product comparison and analysis.

## Features

- 🖼️ **Smart Image Selection**: Automatically detects product images on web pages
- 🤖 **Multi-LLM Support**: Integrates with ChatGPT, Claude, Gemini, Microsoft Copilot, and Perplexity
- 📋 **Context Extraction**: Gathers product links, prices, ratings, and descriptions
- 🔄 **Easy Workflow**: Select images → Choose LLM → Get analysis
- 💾 **Smart Storage**: Remembers your preferences and recent selections

## Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The Shopping AI Guide extension should now appear in your extensions

### Usage

1. **Start Selection**: Click the extension icon and select "Start Image Selection"
2. **Select Products**: Click on product images you want to compare (they'll be highlighted)
3. **Choose LLM**: Select your preferred AI chat tool from the modal
4. **Get Analysis**: The extension will open the LLM chat tool and copy a detailed prompt to your clipboard
5. **Paste & Analyze**: Paste the prompt in the chat to get your product comparison

## How It Works

### Image Detection
The extension automatically identifies product images by:
- Analyzing image size, alt text, and class names
- Looking for product-related keywords
- Filtering out logos, banners, and advertisements

### Context Extraction
For each selected image, the extension extracts:
- **Product Links**: Direct links to product pages
- **Pricing Information**: Current prices when available
- **Ratings**: Customer ratings and reviews
- **Product Context**: Descriptions and specifications

### LLM Integration
The extension formats all collected data into a comprehensive prompt that includes:
- Product comparison request
- Individual product details
- Page context and shopping intent
- Structured format for easy AI analysis

## Supported LLM Platforms

- **ChatGPT** (chat.openai.com)
- **Claude** (claude.ai)
- **Gemini** (gemini.google.com)
- **Microsoft Copilot** (copilot.microsoft.com)
- **Perplexity** (perplexity.ai)

## File Structure

```
shopping_ai_guide/
├── manifest.json              # Extension manifest
├── background/
│   └── background.js          # Service worker
├── content/
│   ├── content.js            # Content script for image selection
│   └── content.css           # Styles for selection UI
├── popup/
│   ├── popup.html            # Extension popup UI
│   ├── popup.css             # Popup styles
│   └── popup.js              # Popup functionality
└── README.md                 # This file
```

## Permissions

The extension requires the following permissions:
- `activeTab`: To interact with the current web page
- `storage`: To save user preferences and recent selections
- `scripting`: To inject content scripts for image selection
- `<all_urls>`: To work on any website

## Privacy

- No data is sent to external servers by the extension
- All processing happens locally in your browser
- Product data is only sent to the LLM platform you choose
- No tracking or analytics are implemented

## Development

### Building
No build step required - the extension runs directly from source files.

### Testing
1. Load the extension in developer mode
2. Navigate to any e-commerce website
3. Test image selection and LLM integration

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues or feature requests, please open an issue on the GitHub repository.