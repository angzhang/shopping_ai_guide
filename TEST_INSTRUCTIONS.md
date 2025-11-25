# Shopping AI Guide - Debug Testing Instructions

## What I Fixed

I've added extensive console logging throughout the extension to track the entire flow when you click the extension icon.

### Changes Made:

1. **background.js**: Added logging for:
   - When extension icon is clicked
   - Tab information
   - Script execution success/failure

2. **content.js**: Added logging for:
   - Content script initialization
   - Message reception
   - Selection mode toggle
   - Panel creation steps
   - Panel visibility verification
   - Settings view display

## How to Test

### Step 1: Reload the Extension
1. Open `chrome://extensions/`
2. Find "Shopping AI Guide"
3. Click the reload icon (circular arrow)
4. Keep the extensions page open

### Step 2: Open Console for Background Script
1. Still on `chrome://extensions/`
2. Find "Shopping AI Guide"
3. Click "service worker" or "background page" link
4. This opens the background script console

### Step 3: Open a Test Page
1. Open a new tab
2. Navigate to any shopping website (e.g., amazon.com, pinterest.com)
3. Open the browser console (F12 → Console tab)

### Step 4: Click the Extension Icon
1. Click the Shopping AI Guide extension icon in the toolbar
2. Watch BOTH consoles:
   - Background script console (from Step 2)
   - Page console (F12)

## Expected Console Output

### In Background Console:
```
Shopping AI Guide: Extension icon clicked
Shopping AI Guide: Tab ID: [number]
Shopping AI Guide: Tab URL: [url]
Shopping AI Guide: Executing script to toggle image selection...
Shopping AI Guide: Script executed successfully
```

### In Page Console:
```
Shopping AI Guide: Content script initialized successfully
Shopping AI Guide: Ready to receive messages
Shopping AI Guide: isSelectionMode = false
Shopping AI Guide: Message received: {type: "TOGGLE_IMAGE_SELECTION"}
Shopping AI Guide: TOGGLE_IMAGE_SELECTION message detected
Shopping AI Guide: Extension context available: true
Shopping AI Guide: Current selection mode: false
Shopping AI Guide: Selection mode toggled to: true
Shopping AI Guide: Enabling selection mode...
Shopping AI Guide: enableSelectionMode() called
Shopping AI Guide: Creating new panel...
Shopping AI Guide: createSelectionOverlay() called
Shopping AI Guide: Creating panel element...
Shopping AI Guide: Appending panel to document.body...
Shopping AI Guide: Panel appended to document.body
Shopping AI Guide: Panel element: [div#shopping-ai-panel]
Shopping AI Guide: Panel ID: shopping-ai-panel
Shopping AI Guide: Panel parent: [body]
Shopping AI Guide: Loading panel settings...
Shopping AI Guide: Setting up event listeners...
Shopping AI Guide: Event listeners set up successfully
Shopping AI Guide: Panel creation completed successfully
Shopping AI Guide: Showing settings view...
Shopping AI Guide: showSettingsView() called
Shopping AI Guide: Settings section shown
Shopping AI Guide: Settings view displayed
Shopping AI Guide: Panel created, checking visibility...
Shopping AI Guide: Panel found in DOM
Shopping AI Guide: Panel display: flex
Shopping AI Guide: Panel visibility: visible
Shopping AI Guide: Panel z-index: 10000
Shopping AI Guide: Selection mode enabled
```

## What to Check

1. **If you see all logs above**: The panel should be visible on the right side
2. **If logs stop somewhere**: Note where they stop - that's where the issue is
3. **If panel display shows "none"**: CSS issue
4. **If "Panel NOT found in DOM"**: Panel creation failed
5. **If no logs in page console**: Content script not loaded or message not received

## Troubleshooting

### If you see "Script execution failed":
- Check if the page allows content scripts (some pages like chrome:// don't)
- Try a regular website like amazon.com or pinterest.com

### If you see no page console logs:
- Content script may not be loading
- Try refreshing the page after reloading the extension

### If panel is created but not visible:
- Check if another element is covering it
- Check browser zoom level (should be 100%)
- Try scrolling or resizing the window

## After Testing

Reply with:
1. Which console logs you see
2. Where the logs stop (if they do)
3. Any error messages
4. Whether the panel appears

This will help identify exactly what's happening!
