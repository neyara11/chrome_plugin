# Dify ChatBot — Chrome extension

**Language: [Русский](README.md) | English**

Embeds [Dify](https://dify.ai/) and [Open WebUI](https://openwebui.com/) chatbots into any web page via a floating button.

## Features

- **Floating button** on websites — draggable with the mouse
- **Drag-to-resize** chat window
- **Context menu**: send the selected text or the page URL to the chat
- **Dify**: iframe embedding with automatic variable filling
- **Open WebUI**: native streaming widget, multiple chats per site, side panel
- **Site rules**: a different chatbot on different domains
- **Global mode**: show one application on all sites

## Installation

1. Download or clone the repository (prebuilt packages are in [Releases](https://github.com/neyara11/chrome_plugin/releases))
2. Open `chrome://extensions/` and enable **Developer mode**
3. "Load unpacked" → select the `src/` folder
4. The extension appears in the list

## Configuration

### Dify

1. Create an application in Dify and copy the chatbot URL (Embed → Chrome Extension)
2. On the extension settings page, create an application of type **Dify** and paste the URL
3. Configure the variables for the text (`userinput.query`) and the URL (`page_url`)

### Open WebUI

1. Get an API key: Open WebUI → User Settings → Account → API Keys
2. On the extension settings page, create an application of type **Open WebUI** and specify:
   - Instance URL (e.g. `https://my-openwebui.com`)
   - API key
   - Model (the list can be loaded with the 🔄 button)
3. Click "Save"

## Usage

- A colored button appears in the bottom right corner of any site
- Click — open/close the chat
- Right-click on the page → "Dify: send URL" / "Dify: send text"
- The extension icon — quick settings for the current site
- The settings page — manage applications and site rules

## Project structure

```
src/                   # Extension code (see below)
├── manifest.json          # Chrome Extension manifest v3
├── background.js          # Service worker: menu, API proxy, streaming
├── content.js             # Content script: button, window, iframe/widget
├── lib/
│   ├── storage.js         # chrome.storage, migrations, chats
│   ├── url-matcher.js     # URL matching by patterns
│   ├── dify-url.js        # URL builder for Dify and Open WebUI APIs
│   ├── owui-widget.js     # Open WebUI widget class (vanilla JS)
│   └── owui-widget.css    # Widget styles
├── options/               # Settings page
│   ├── options.html
│   ├── options.js
│   └── options.css
├── popup/                 # Extension popup
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
└── icons/                 # Extension icons
original/              # Unmodified snapshot of the original extension (see below)
LICENSE
```

## Code provenance

This project is based on the [Dify ChatBot](https://github.com/langgenius/chatbot-chrome-extension) extension by **langgenius** (the repository is archived and its authors published no license). An unmodified snapshot of the original extension is kept in the `original/` directory for comparison and history.

Own contributions of this repository:

- multi-application support and site rules (a different bot on different domains)
- **Open WebUI** integration: native streaming widget, multiple chats per site, side panel
- context menu (sending selected text and URL), automatic field filling via `postMessage` for cross-origin iframes
- resize handles, repositioned close button, markdown, dark theme
- settings export/import, code copy and full-message copy, (Russian) localized UI
- modular `lib/` structure, popup, `chrome.storage` migrations

Copyright for the original code remains with its authors (langgenius); this repository claims no rights over it. If you are a rights holder and object to any use of your code here — open an issue and the affected fragments will be removed.

## License

MIT — covering only the own modifications and additions of this repository; details and the caveat regarding the original code are in [LICENSE](LICENSE).
