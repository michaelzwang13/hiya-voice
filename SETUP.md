# Quick Start Guide

## Day 1 Setup Complete!

### Installation (2 commands)
```bash
# 1. Install dependencies
bun install

# 2. Build extension
bun run build
```

### Load in Chrome (4 steps)
1. Open Chrome → `chrome://extensions/`
2. Toggle "Developer mode" ON (top right)
3. Click "Load unpacked"
4. Select the `dist/` folder

### Test It!
1. Go to any website with a form (try Google Forms)
2. Click the Hiya extension icon in your toolbar
3. Click "Detect Forms" in the popup
4. You should see the count of detected fields!

### Keyboard Shortcut
Press **Alt+V** on any page to activate voice assistance (feature coming in Day 3)

### Development
```bash
# Auto-rebuild on file changes
bun run dev
```

## What's Working (Day 1)
- ✅ Form detection (finds all inputs, textareas, selects)
- ✅ Field label extraction (via label tags, aria-label, placeholders)
- ✅ Field type detection (email, phone, text, etc.)
- ✅ Required field tracking
- ✅ Chrome extension popup UI
- ✅ Keyboard shortcut setup
- ✅ Notification system

## Coming Next (Day 2)
- Advanced field classification
- Field navigation (next/previous)
- Form state management
- Better label extraction logic

## Troubleshooting

### Extension won't load
- Make sure you built the extension: `bun run build`
- Check that `dist/` folder exists with files inside
- Verify icons are in `dist/icons/`

### No forms detected
- Open DevTools (F12) and check Console for errors
- Look for `[Hiya] Content script loaded` message
- Try refreshing the page

### Build fails
- Delete `node_modules/` and `bun.lock`
- Run `bun install` again
- Make sure you're using Bun (not npm)

## Project Structure
```
hiya-voice/
├── src/
│   ├── background/service-worker.ts    # Background tasks
│   ├── content/content-script.ts       # Injected into pages
│   ├── popup/                          # Extension popup UI
│   ├── types/                          # TypeScript types
│   ├── utils/form-detector.ts          # Form detection logic
│   └── manifest.json                   # Extension config
├── dist/                               # Built extension (load this in Chrome)
└── public/icons/                       # Extension icons
```

## Resources
- [Day 1 Plan](./plan.md#day-1-project-setup--core-infrastructure)
- [Full README](./README.md)
