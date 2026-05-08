# PACE Universal Video Speed Controller

PACE is a Chrome extension for controlling playback speed on HTML5 videos across the web, including videos inside iframes and dynamically loaded players.

## Features

- Universal HTML5 video speed control on supported pages.
- Floating glassmorphism widget with drag-to-position support.
- Keyboard shortcuts for speed changes, reset, and widget visibility.
- Per-site speed memory so each website can keep its own saved speed.
- Site exclusion list for pages where PACE should stay hidden and leave native playback speed untouched.
- Popup settings for default reset speed, step size, widget position, excluded sites, and saved per-site speeds.
- Inline dropdown lists for excluded sites and per-site speeds so long lists stay tucked away until needed.

## Keyboard Shortcuts

- `[` decreases playback speed.
- `]` increases playback speed.
- `R` resets speed to the configured default.
- `H` toggles widget visibility.

## Popup Settings

- **Remember Speed Per-Site:** Stores separate speed preferences per hostname. Use the chevron control to view saved site speeds.
- **Speed Step Size:** Sets how much speed changes when using controls or shortcuts.
- **Default Reset Speed:** Sets the speed used by reset actions.
- **Widget Position:** Restore the widget to the default position or lock the current position.
- **Excluded Sites:** Add the current site to the exclusion list. Excluded sites hide the widget and skip custom speed enforcement. Use the chevron control to view and remove excluded sites.

## Installation

1. Open Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project directory.

After updating local files, reload the extension from `chrome://extensions/`.

## Development

PACE is a Manifest V3 Chrome extension with no build step.

- `manifest.json` defines permissions, content script registration, icons, and popup entry points.
- `content.js` runs in all frames, finds HTML5 video elements, enforces playback speed, and renders the floating widget in the top frame.
- `popup.html`, `popup.css`, and `popup.js` implement the settings UI and persist options in `chrome.storage.local`.

Current permissions:

- `storage` stores settings, widget position, per-site speeds, and excluded sites.
- `activeTab` lets the popup detect the current tab hostname for the exclusion control.
- `<all_urls>` host permission allows the content script to run on supported pages and frames.

## Testing Notes

When testing changes, cover:

- Regular HTML5 videos.
- Embedded YouTube/Vimeo or other iframe-hosted videos.
- Sites with dynamically inserted videos.
- Per-site speed memory on multiple hostnames.
- Excluding and re-including the current site.
- Widget dragging, locking, restoring, and keyboard shortcuts.