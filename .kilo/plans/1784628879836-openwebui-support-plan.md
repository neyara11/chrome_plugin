# Plan: Open WebUI Support for Dify Chatbot Chrome Extension

## Goal

Extend the Chrome extension to support both Dify chatbots (existing) and Open WebUI (new) as backends, selectable per app via a `type` field.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     content.js                           │
│                                                         │
│  resolveAppForCurrentUrl() → matched app                │
│                                                         │
│  if app.type === 'dify'                                 │
│    → existing iframe approach (unchanged)               │
│                                                         │
│  if app.type === 'openwebui'                            │
│    → OwuiChatWidget (vanilla JS class)                  │
│    → POST /api/chat/completions via background proxy    │
│    → multiple named chats per (appId, hostname)         │
│    → stored in chrome.storage.local['owuiConversations']│
└─────────────────────────────────────────────────────────┘
```

## Data Model

### `chrome.storage.local['difyChatbotV2']` (existing key, extended)

```js
{
  apps: [{
    id: "id_xxx",
    type: "dify" | "openwebui",  // NEW
    name: "Бот поддержки",
    baseUrl: "https://...",
    color: "#155EEF",

    // only when type === 'dify'
    inputVariable: "userinput.query",
    urlInputVariable: "page_url",

    // only when type === 'openwebui'
    owuiModel: "gpt-4o-mini",    // NEW
    owuiApiKey: "sk-..."         // NEW
  }],
  sites: [...],      // unchanged
  settings: {...}    // unchanged
}
```

### `chrome.storage.local['owuiConversations']` (NEW key)

```js
{
  "app1:github.com": {        // key = appId:hostname
    chats: [
      {
        id: "chat_l1k2m3",
        title: "Обсуждение бага #123",
        messages: [{ role: "user", content: "..." }, { role: "assistant", content: "..." }],
        createdAt: 1721560000000,
        updatedAt: 1721563600000
      }
    ],
    activeChatId: "chat_l1k2m3"
  }
}
```

**Limits (enforced on save):**
- Max 30 chats per `(appId, hostname)` — oldest deleted
- Max 500 messages per chat — oldest truncated (except first message, kept as context anchor)

## Files

### New files

| File | Purpose |
|---|---|
| `src/lib/owui-widget.js` | `OwuiChatWidget` class — chat UI, `sendMessage(text)`, mount/destroy |
| `src/lib/owui-widget.css` | Widget styles — chat bubbles, sidebar, input area |

### Modified files

| File | Changes |
|---|---|
| `src/manifest.json` | Add `lib/owui-widget.js` to content_scripts `js` list; add `"lib/owui-widget.css"` to `css` array (new field in content_scripts); bump version to 2.1 |
| `src/lib/storage.js` | Add migration: existing apps without `type` → `type: 'dify'`. Add conversation storage helpers (`loadConversations`, `saveConversations`, `cleanupOldChats`, `truncateMessages`). Add `getConversationsKey(appId, hostname)`. |
| `src/background.js` | Add `fetchOwuiModels` message handler (GET /api/models) and `owuiProxy` message handler (POST /api/chat/completions, returns JSON response). Both use the API key from the message payload. |
| `src/options/options.html` | Add `#app-type` select (dify / openwebui). Add Open WebUI conditional fields: `#app-owui-url`, `#app-owui-apikey`, `#app-owui-model` + datalist + fetch button. |
| `src/options/options.js` | Toggle field visibility on type change. `saveApp()` saves type-specific fields. Model autocomplete: fetch via `chrome.runtime.sendMessage({ action: 'fetchOwuiModels' })`. |
| `src/content.js` | Add `widgetMap` (parallel to `iframeMap`). In `createOrShowIframe` → branch: `type === 'dify'` keeps existing logic; `type === 'openwebui'` calls new `createOrShowOwuiWidget(app, prefillValue, mode)`. Update `toggleChatbot`, `hideAll`, `removeEverything`, `handleMessage` to handle widgets. |
| `src/popup/popup.js` | Show type badge in app select (e.g. `[Dify]` / `[OWUI]`). |

## Key Design Decisions

1. **CORS bypass**: Widget sends messages via `chrome.runtime.sendMessage({ action: 'owuiProxy', ... })`. Background script does the actual `fetch()`, returns response. No CORS configuration needed on Open WebUI server.

2. **API proxy format**: Background receives `{ action: 'owuiProxy', endpoint, apiKey, model, messages }`, makes POST to `{endpoint}/api/chat/completions`, returns `{ choices: [{ message: { content } }] }` or `{ error }`.

3. **Chat sidebar UI**: Header has `☰` button or dropdown to list chats. Each chat shows auto-title (first ~50 chars of first user message). "+ New Chat" button. "Delete" on hover/context. Active chat highlighted.

4. **Auto-titling**: On first user message of a new chat, extract first ~50 chars as title. Update in storage.

5. **Storage split**: Config (`difyChatbotV2`) separate from conversations (`owuiConversations`) to avoid re-reading/writing large chat data on every config change.

6. **No streaming in MVP**: Non-streaming `/api/chat/completions` only. Streaming can be added later.

7. **Model field**: Text input with `<datalist>` populated via background proxy to `GET /api/models`. User can type manually or pick from list.

## Implementation Order

1. **`storage.js`** — migration, conversation helpers, limits
2. **`background.js`** — API proxy handlers (`fetchOwuiModels`, `owuiProxy`)
3. **`owui-widget.js` + `owui-widget.css`** — standalone chat widget class
4. **`options.html` + `options.js`** — type selector, conditional fields, model autocomplete
5. **`content.js`** — widget rendering branch, toggle/hide/destroy integration
6. **`popup.js`** — type badge
7. **`manifest.json`** — register new files, bump version

## Edge Cases & Error Handling

| Scenario | Handling |
|---|---|
| Open WebUI API returns error (4xx/5xx) | Show error bubble in chat: "Ошибка: {message}" |
| API key invalid | Same — error bubble. User fixes in options. |
| Server unreachable / timeout | AbortController with 30s timeout → "Нет ответа от сервера" |
| `chrome.storage.local` full | Show toast "Хранилище заполнено, очистите старые чаты" |
| Model field — API fetch fails | datalist stays empty, user types manually |
| Prefill from context menu | Widget receives text, creates new chat (or appends to active), sends automatically |
| URL prefill from context menu | Same — sends page URL as message text |
| Switch from Dify app to Open WebUI app on same page | `removeEverything()` destroys old widget, creates new one |
| Page has no hostname (file://, chrome://) | Skip widget creation (same as current Dify behavior) |

## Validation

1. **Unit tests**: Not applicable (no test framework in project).
2. **Manual checklist**:
   - [ ] Create Dify app → floating button appears → click opens iframe with Dify chat
   - [ ] Create Open WebUI app → floating button appears → click opens custom widget
   - [ ] Send messages in OWUI widget → responses appear, history preserved
   - [ ] Toggle bubble close/reopen → same chat visible
   - [ ] Switch chats in sidebar → messages change
   - [ ] Create new chat → empty chat, old chat preserved
   - [ ] Delete chat → removed from list, another chat activated
   - [ ] Context menu "send selected text" → new chat created with text
   - [ ] Context menu "send URL" → new chat created with URL
   - [ ] Refresh page → chats reloaded from storage
   - [ ] Navigate away and back → chats reloaded
   - [ ] Exceed 30 chats limit → oldest deleted
   - [ ] Exceed 500 messages → oldest truncated
   - [ ] Open options page → model list loads from API
   - [ ] Model field accepts manual input if fetch fails
   - [ ] Existing Dify apps still work after migration (type auto-set to 'dify')
   - [ ] Popup shows type badge [Dify] / [OWUI]
   - [ ] API key invalid → error shown in chat
   - [ ] Server unreachable → timeout error shown
