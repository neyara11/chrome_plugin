# Dify ChatBot V2 — План переделки

## Цель

Переработать оригинальный плагин Dify Chatbot с исправлением багов и добавлением трёх ключевых возможностей:
1. Несколько Dify-приложений с выбором
2. Привязка приложений к URL сайтов (wildcard) + глобальное поведение по-умолчанию
3. Контекстное меню: выделил текст → правый клик → отправить в выбранное Dify-приложение; без выделения → отправить URL страницы

---

## Файловая структура

```
src/
├── manifest.json
├── background.js          — Service Worker: контекстное меню, слушает изменения storage
├── content.js             — Content Script: плавающая кнопка, iframe, drag, приём сообщений
├── lib/
│   ├── storage.js         — Обёртка над chrome.storage.local (чтение/запись apps, sites, settings)
│   ├── url-matcher.js     — Сопоставление wildcard-масок сайтов с текущим URL
│   └── dify-url.js        — Построение URL iframe с предзаполнением текста
├── popup/
│   ├── popup.html
│   ├── popup.js           — Быстрое переключение приложения для текущего сайта, вкл/выкл
│   └── popup.css
├── options/
│   ├── options.html
│   ├── options.js         — Полный CRUD приложений и правил сайтов, глобальные настройки
│   └── options.css
└── icons/
    ├── 16.png
    ├── 32.png
    ├── 48.png
    └── 128.png
```

---

## Этап 1: Исправление багов оригинала

### 1.1. Гонка storage.get ↔ embedChatbot
**Проблема:** `window.difyChatbotConfig` заполняется асинхронно в колбэке `chrome.storage.sync.get`, но `embedChatbot()` вызывается синхронно через `document.body.onload` — может быть `undefined`.
**Решение:** Перенести вызов `embedChatbot()` внутрь колбэка `chrome.storage.local.get`. Плюс слушать `chrome.storage.onChanged` для горячего переключения приложения без перезагрузки страницы.

### 1.2. Неиспользуемый permission `webRequest`
**Решение:** Убрать `webRequest` из `manifest.json`.

### 1.3. `run_at` не указан явно
**Решение:** Добавить `"run_at": "document_idle"` — осознанно, чтобы DOM был готов.

### 1.4. Псевдокласс `:hover` в inline `cssText`
**Проблема:** `:hover {transform: scale(1.1)}` в `element.style.cssText` не работает.
**Решение:** Добавить `<style>` в head через content script, либо убрать hover-эффект, либо использовать `mouseenter`/`mouseleave` события.

### 1.5. Toggle через `display: none` / `"block"` строкой
**Проблема:** Если сайт переопределит `display` для iframe, логика сломается.
**Решение:** Использовать data-атрибут `data-dify-visible="true/false"` и управлять классом/стилем через него.

### 1.6. Убрать 3.6 MB tailwind.css
**Решение:** Заменить на чистый CSS (~2-5 KB). Никаких CDN-загрузок стилей или шрифтов — расширение работает в изолированном контуре без доступа к интернету, все ресурсы локальны в пакете расширения.

---

## Этап 2: Модель данных и хранилище

Переход с `chrome.storage.sync` (квота 100KB/8KB) на `chrome.storage.local` (10MB).

### 2.1. Схема данных

```json
{
  "apps": [
    {
      "id": "uuid",
      "name": "Поддержка клиентов",
      "baseUrl": "https://udify.app/chatbot/abc123",
      "inputVariable": "sys.query",
      "urlInputVariable": "page_url",
      "color": "#155EEF"
    }
  ],
  "sites": [
    {
      "id": "uuid",
      "pattern": "*.site1.ru",
      "appId": "uuid",
      "enabled": true
    }
  ],
  "settings": {
    "defaultAppId": null,
    "showOnAllSites": false
  }
}
```

- `apps[].inputVariable` — имя query-параметра для предзаполнения выделенным текстом (по умолчанию `sys.query`)
- `apps[].urlInputVariable` — имя query-параметра для предзаполнения URL страницы (по умолчанию `page_url`)
- `apps[].color` — цвет плавающей кнопки для этого приложения
- `sites[].pattern` — wildcard-маска: `*.site1.ru`, `www.site2.ru`, `example.com/path`
- `settings.defaultAppId` — `null` = не показывать на сайтах без правила; `uuid` = показывать это приложение
- `settings.showOnAllSites` — `true` = показывать кнопку всегда (даже без правила), `false` = только по правилам

### 2.2. `lib/storage.js`

Обёртка с методами:
```
getApps() → Promise<App[]>
saveApp(app) → Promise<void>
deleteApp(id) → Promise<void>
getSites() → Promise<Site[]>
saveSite(site) → Promise<void>
deleteSite(id) → Promise<void>
getSettings() → Promise<Settings>
saveSettings(settings) → Promise<void>
onChanged(callback) → unsubscribe
```

---

## Этап 3: `lib/url-matcher.js` — сопоставление wildcard-масок

### 3.1. Правила преобразования

| Паттерн | Хостнейм | Путь |
|---------|----------|------|
| `site1.ru` | точное совпадение `site1.ru` | любой |
| `*.site1.ru` | любой поддомен `*.site1.ru` | любой |
| `www.site1.ru/blog` | точное совпадение | префикс `/blog` |

### 3.2. Алгоритм `matchUrl(pattern, currentUrl)`

1. Разобрать `pattern` на hostname + path
2. Преобразовать hostname в RegExp: `*` → `[^.]+`, экранировать `.`
3. Проверить `hostname` и `pathname` текущего URL
4. Приоритет: более конкретный паттерн (с путём) выигрывает у менее конкретного

---

## Этап 4: `lib/dify-url.js` — построение URL с предзаполнением

### 4.1. Функция `buildChatbotUrl(baseUrl, variable, value)`

```js
function buildChatbotUrl(baseUrl, variable, value) {
  if (!value) return baseUrl;
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}${encodeURIComponent(variable)}=${encodeURIComponent(value)}`;
}
```

Если `variable` не задан — возвращает `baseUrl` как есть.

---

## Этап 5: Background Service Worker (`background.js`)

### 5.1. События

- `chrome.runtime.onInstalled` — первичное создание контекстного меню
- `chrome.runtime.onStartup` — пересоздание контекстного меню
- `chrome.storage.onChanged` — пересоздание при изменении списка приложений
- `chrome.contextMenus.onClicked` — обработка клика

### 5.2. Контекстное меню

Два родительских пункта с разными `contexts`, дочерние пункты — список приложений:

```
Dify: отправить выделенный текст >     (contexts: ["selection"])
  ├── Приложение 1 (Поддержка)
  ├── Приложение 2 (Продажи)
  └── Приложение 3 (FAQ)

Dify: отправить URL страницы >         (contexts: ["page"])
  ├── Приложение 1 (Поддержка)
  ├── Приложение 2 (Продажи)
  └── Приложение 3 (FAQ)
```

- Создаются два родительских пункта:
  - `"Dify: отправить выделенный текст"` с `contexts: ["selection"]`
  - `"Dify: отправить URL страницы"` с `contexts: ["page"]`
- ID дочерних пунктов: `"dify_ctx_sel_" + appId` (для текста), `"dify_ctx_url_" + appId` (для URL)
- Дочерние пункты создаются динамически по списку `apps` из storage
- При изменении списка приложений — `chrome.contextMenus.removeAll()` и пересоздание всех пунктов

### 5.3. Обработка клика

```js
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!info.menuItemId.startsWith('dify_ctx_')) return;

  // Разбираем ID: "dify_ctx_sel_<appId>" или "dify_ctx_url_<appId>"
  const parts = info.menuItemId.split('_');
  const mode = parts[2];           // "sel" или "url"
  const appId = parts.slice(3).join('_');

  const value = mode === 'sel' ? info.selectionText : info.pageUrl;

  chrome.tabs.sendMessage(tab.id, {
    action: 'openChatbot',
    appId,
    value,
    mode       // "sel" или "url" — определяет, какую переменную приложения использовать
  });
});
```

---

## Этап 6: Content Script (`content.js`)

### 6.1. Инициализация

```js
async function init() {
  const [apps, sites, settings] = await Promise.all([
    storage.getApps(),
    storage.getSites(),
    storage.getSettings()
  ]);

  const matchedApp = resolveAppForCurrentUrl(apps, sites, settings);

  if (matchedApp) {
    createFloatingButton(matchedApp);
  }

  chrome.runtime.onMessage.addListener(handleMessage);
  storage.onChanged(() => refreshUI());
}
```

### 6.2. `resolveAppForCurrentUrl(apps, sites, settings)`

1. Если `showOnAllSites` → вернуть `defaultAppId` (если задан) или первое приложение
2. Иначе найти все правила, чей `pattern` совпадает с текущим URL
3. Из совпавших выбрать наиболее конкретное (по длине паттерна с учётом пути)
4. Если ничего не совпало → вернуть `defaultAppId` (если задан) или `null`

### 6.3. Плавающая кнопка

- Создаётся `<div>` с `id="dify-chatbot-bubble-button"`
- Цвет из `app.color`
- Draggable (переиспользовать логику оригинала с фиксом `hover`)
- При клике: `toggleChatbot(appId)`
- На странице одна кнопка, соответствующая активному приложению для этого URL. Пользователь может переключить приложение через popup.

### 6.4. Управление iframe

- `openChatbot(appId, value?, mode?)` — создаёт/показывает iframe:
  - `mode` = `"sel"` (по умолчанию) — использует `app.inputVariable`
  - `mode` = `"url"` — использует `app.urlInputVariable`
  - При наличии `value` строит URL через `buildChatbotUrl(baseUrl, variable, value)`
- `closeChatbot()` — скрывает iframe
- `toggleChatbot(appId)` — переключает видимость
- Храним открытые iframe в Map `{ appId → iframeElement }` — позволяет держать несколько iframe, переключаться между ними без перезагрузки

### 6.5. Обработчик сообщений от background

```js
function handleMessage(msg, sender, sendResponse) {
  if (msg.action === 'openChatbot') {
    const { appId, value, mode } = msg;
    openChatbot(appId, value, mode);
    sendResponse({ success: true });
  }
  return true;
}
```

### 6.6. Обновление кнопки из popup

Когда пользователь меняет приложение через popup:
1. Popup отправляет `chrome.tabs.sendMessage(tabId, { action: 'switchApp', appId })`
2. Content script обновляет кнопку (цвет, целевое приложение)
3. Опционально сохраняет выбор как site-rule через `chrome.storage.local`

---

## Этап 7: Popup (`popup/`)

### 7.1. Структура

```
┌─────────────────────────────┐
│  Dify ChatBot               │
│                             │
│  Текущий сайт: site1.ru     │
│  Приложение: [Поддержка ▾]  │
│                             │
│  ☑ Показывать на этом сайте │
│                             │
│  [Открыть полные настройки] │
└─────────────────────────────┘
```

### 7.2. Логика

1. При открытии: получить текущий URL вкладки, найти подходящее приложение и правило
2. Выпадающий список приложений: все `apps` из storage
3. При выборе другого приложения: создать/обновить site-rule для текущего hostname
4. Чекбокс «Показывать»: обновить `enabled` в правиле сайта
5. Кнопка «Настройки»: открыть `chrome.runtime.openOptionsPage()` или `options.html` в новой вкладке

---

## Этап 8: Options Page (`options/`)

### 8.1. Секция «Приложения»

- Таблица/список приложений с полями: Название, URL, Цвет, Input-переменная для текста, Input-переменная для URL
- Кнопки: Добавить, Редактировать, Удалить
- Валидация: название не пустое, URL начинается с `http`

### 8.2. Секция «Правила сайтов»

- Таблица: Маска URL, Привязанное приложение, Вкл/Выкл
- Кнопки: Добавить, Редактировать, Удалить
- При добавлении: поле ввода маски + выпадающий список приложений + чекбокс enabled

### 8.3. Секция «Глобальные настройки»

- Приложение по умолчанию (выпадающий список, включая «Не показывать»)
- Чекбокс «Показывать на всех сайтах»

### 8.4. Стилизация

- Чистый CSS, без Tailwind
- CSS-переменные для цветовой схемы

---

## Этап 9: `manifest.json`

```json
{
  "manifest_version": 3,
  "name": "Dify Chatbot",
  "version": "2.0",
  "description": "Inject Dify chatbot on any pages with per-site configuration",
  "permissions": ["storage", "contextMenus"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["lib/storage.js", "lib/url-matcher.js", "lib/dify-url.js", "content.js"],
    "run_at": "document_idle"
  }],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": { "16": "icons/16.png", "32": "icons/32.png", "48": "icons/48.png", "128": "icons/128.png" }
  },
  "icons": { "16": "icons/16.png", "32": "icons/32.png", "48": "icons/48.png", "128": "icons/128.png" },
  "options_ui": {
    "page": "options/options.html",
    "open_in_tab": true
  }
}
```

---

## Этап 10: Иконки

- Переиспользовать иконки из оригинала (`original/extracted/images/`)
- Скопировать в `src/icons/`

---

## Порядок реализации

1. **Создать структуру директорий** `src/` и поддиректорий
2. **`lib/storage.js`** — CRUD-обёртка над `chrome.storage.local` с дефолтными значениями
3. **`lib/url-matcher.js`** — wildcard → RegExp, `matchUrl(pattern, url)`, `resolveAppForCurrentUrl()`
4. **`lib/dify-url.js`** — `buildChatbotUrl(baseUrl, variable, value)`
5. **`background.js`** — контекстное меню (два родительских пункта, создание/пересоздание/обработка клика)
6. **`content.js`** — исправленная логика floating button + iframe + drag + приём сообщений
7. **`popup/*`** — быстрое переключение приложения для текущего сайта
8. **`options/*`** — полные настройки (CRUD apps с двумя переменными, CRUD sites, global settings)
9. **`manifest.json`** — финальная сборка с правильными путями
10. **Скопировать иконки** из `original/extracted/images/`
11. **Валидация** — загрузить как unpacked extension в Chrome, проверить:
    - Появляется ли кнопка на сайтах по правилам
    - Переключение приложений через popup
    - Контекстное меню с выделенным текстом: правый клик → выбрать приложение → текст в iframe
    - Контекстное меню без выделения: правый клик на странице → выбрать приложение → URL страницы в iframe
    - Отсутствие ошибок в консоли background и content script
    - Drag кнопки работает
    - Несколько iframe корректно переключаются

---

## Риски и открытые вопросы

1. **Предзаполнение текста/URL.** Dify не документирует query-параметры для `/chatbot/` URL. Параметр `sys.query` работает для WebApp (`/chat/`), но для `/chatbot/` iframe может не работать. **План Б:** если query-параметр не подхватывается — добавить опцию «использовать embed-скрипт Dify» с GZIP+base64 кодированием `inputs`.
2. **postMessage.** Если query-параметры не работают совсем — как fallback использовать `postMessage` к iframe для отправки текста (надёжность не гарантирована).
3. **Несколько iframe на странице.** Память: каждый iframe Dify — это полноценный SPA. Рекомендуется держать только один активный iframe, скрывая неактивные.
4. **Storage quota.** `chrome.storage.local` даёт 10MB — достаточно для сотен приложений и правил.