# Clara Voice Assistant

Voice-powered form filling assistant for accessibility. Helps users with visual or physical impairments fill out forms using voice commands.

## Day 2 - Form Parsing Intelligence Complete ✅

### Project Structure
```
clara-voice/
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

### Features Complete

**Day 1:**
- ✅ Chrome extension with TypeScript + Vite
- ✅ Manifest V3 with required permissions
- ✅ Content script that injects into web pages
- ✅ DOM form detector (finds all input/textarea/select elements)
- ✅ Basic popup UI showing form statistics
- ✅ Keyboard shortcut (Alt+V) for voice toggle

**Day 2:**
- ✅ Enhanced field type detection (20+ field types including name, address, city, state, zip, company, jobTitle)
- ✅ Intelligent label extraction (11 different methods including aria attributes, siblings, headings)
- ✅ Visual field highlighting with purple outline
- ✅ Field navigation system (next/previous with smooth scrolling)
- ✅ Form state manager (tracks completion, filled vs required fields)
- ✅ Progress bar showing form completion percentage
- ✅ "Go to First Unfilled" feature
- ✅ Current field display in popup
- ✅ Autocomplete attribute detection for better field classification

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
5. The Clara Voice Assistant extension should now appear

## Testing

### Test Navigation Features
1. Navigate to any page with a form (try [Google Forms](https://docs.google.com/forms/))
2. Click the Clara extension icon
3. Click "Refresh Forms" to detect fields
4. Try navigation buttons:
   - **Next →** - Moves to next field (purple highlight appears)
   - **← Previous** - Goes back one field
   - **Go to First Unfilled** - Jumps to first empty required field
5. Watch the progress bar update as you fill fields
6. See current field info appear in the "Current Field" section

### Features to Test
- **Field Detection**: Should find all visible inputs, textareas, and selects
- **Label Extraction**: Check that field labels are correctly identified
- **Type Detection**: Verify field types (email, phone, name, etc.) in Current Field display
- **Visual Highlighting**: Purple outline appears around focused field
- **Progress Tracking**: Progress bar updates as fields are filled
- **Smart Navigation**: "Go to First Unfilled" skips to incomplete required fields

### Console Logs
Open Chrome DevTools (F12) and check for:
- `[Clara] Content script loaded`
- `[Clara] Detected X form fields`
- Field labels and types in console

## Development Commands

```bash
# Type check without emitting
bun run type-check

# Development build with watch mode (auto-rebuilds on file changes)
bun run dev

# Production build
bun run build
```

## Next Steps (Day 3)
- Integrate Web Speech API (SpeechRecognition) with TypeScript types
- Implement Text-to-Speech to read field labels aloud
- Create voice command parser (next, previous, fill, submit)
- Build transcription → form filling logic
- Add visual feedback UI (listening indicator, transcription display)
- Test voice input on simple text fields

## Tech Stack
- TypeScript
- Vite
- Chrome Extension Manifest V3
- Web Speech API (coming in Day 3)
