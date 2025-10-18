# Hiya Voice Assistant

Voice-powered form filling assistant for accessibility. Helps users with visual or physical impairments fill out forms using voice commands.

## Day 1 - MVP Setup Complete

### Project Structure
```
hiya-voice/
├── src/
│   ├── background/          # Background service worker
│   ├── content/             # Content scripts (injected into pages)
│   ├── popup/               # Extension popup UI
│   ├── types/               # TypeScript type definitions
│   ├── utils/               # Utility functions
│   └── manifest.json        # Extension manifest
├── public/
│   └── icons/               # Extension icons
├── dist/                    # Build output (generated)
└── package.json
```

### Features (Day 1)
- ✅ Chrome extension with TypeScript + Vite
- ✅ Manifest V3 with required permissions
- ✅ Content script that injects into web pages
- ✅ DOM form detector (finds all input/textarea/select elements)
- ✅ Basic popup UI showing form statistics
- ✅ Keyboard shortcut (Alt+V) for voice toggle

## Installation & Setup

### 1. Install Dependencies
```bash
bun install
```

### 2. Build the Extension
```bash
# Production build
bun run build

# Development mode (with watch)
bun run dev
```

### 3. Load Extension in Chrome
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `dist` folder from this project
5. The Hiya Voice Assistant extension should now appear

## Testing

### Test on Google Forms
1. Navigate to [Google Forms](https://docs.google.com/forms/)
2. Open any form or create a test form
3. Click the Hiya extension icon (or press Alt+V)
4. Click "Detect Forms" in the popup
5. You should see the number of fields detected

### Console Logs
Open Chrome DevTools (F12) and check the console for:
- `[Hiya] Content script loaded`
- `[Hiya] Detected X form fields`

## Development Commands

```bash
# Type check without emitting
bun run type-check

# Development build with watch mode (auto-rebuilds on file changes)
bun run dev

# Production build
bun run build
```

## Next Steps (Day 2)
- Build field classifier (detect field types: email, name, phone, text, etc.)
- Implement label/placeholder/aria-label extraction logic
- Create field navigation system (next/previous field focusing)
- Build form state manager (track which fields filled, required fields)

## Tech Stack
- TypeScript
- Vite
- Chrome Extension Manifest V3
- Web Speech API (coming in Day 3)
