# ⚡ PACE Universal Video Speed Controller

An advanced, universal playback speed controller designed to work across any HTML5 `<video>` element on the web.

## 🧑‍💻 For Users

### 🌟 Features
- **Universal Compatibility:** Adjusts the speed of any HTML5 video on the current webpage.
- **Iframe Penetration:** Successfully injects and controls videos nested deep within complex iframes, bypassing common cross-origin limitations.
- **Persistent Settings:** Remembers your preferred playback speed adjustments across sessions.

### 🚀 Installation
1. Open Chrome and go to `chrome://extensions/`.
2. Toggle **Developer mode** on (top right).
3. Click **Load unpacked** and select this directory.

---

## 🛠️ For Developers

### 🏗️ Architecture & Tech Stack
- **Environment:** Chrome Extension Manifest V3
- **Permissions:** `<all_urls>`, `storage`.
- **Core Components:**
  - `content.js`: Injected into `all_frames` to ensure it captures videos inside cross-domain iframes. Listens for DOM changes to attach playback rate controls to dynamically loaded videos.
  - `popup.html`/`popup.js`: The user interface for adjusting speed, persisting the chosen rate to `chrome.storage`.

### ⚙️ Development Setup
- No build process required. 
- When testing, ensure you test on pages with deep DOM trees and cross-origin iframes (like embedded YouTube or Vimeo players) to verify the `all_frames` injection works securely.
