importScripts('lib/storage.js');

const CTX_SEL_ID = 'dify_ctx_sel_parent';
const CTX_URL_ID = 'dify_ctx_url_parent';

function buildOwuiApiUrl(baseUrl, path) {
  var url = baseUrl.replace(/\/+$/, '');
  if (/\/api(\/v\d+)?$/.test(url)) {
    return url + path;
  }
  return url + '/api' + path;
}

async function buildContextMenus() {
  try {
    chrome.contextMenus.removeAll();

    const apps = await getApps();
    console.log('[Dify] buildContextMenus: apps.length =', apps.length);

    if (apps.length === 0) {
      chrome.contextMenus.create({
        id: 'dify_no_apps',
        title: 'Dify: настроить приложения...',
        contexts: ['page']
      });
      return;
    }

    chrome.contextMenus.create({
      id: CTX_SEL_ID,
      title: 'Dify: отправить выделенный текст в',
      contexts: ['selection']
    });

    for (const app of apps) {
      chrome.contextMenus.create({
        id: 'dify_ctx_sel_' + app.id,
        parentId: CTX_SEL_ID,
        title: app.name,
        contexts: ['selection']
      });
    }

    chrome.contextMenus.create({
      id: CTX_URL_ID,
      title: 'Dify: отправить URL страницы в',
      contexts: ['page']
    });

    for (const app of apps) {
      chrome.contextMenus.create({
        id: 'dify_ctx_url_' + app.id,
        parentId: CTX_URL_ID,
        title: app.name,
        contexts: ['page']
      });
    }
  } catch (e) {
    console.error('[Dify] buildContextMenus error:', e);
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'dify_no_apps') {
    chrome.runtime.openOptionsPage();
    return;
  }

  const PREFIX_SEL = 'dify_ctx_sel_';
  const PREFIX_URL = 'dify_ctx_url_';

  let mode, appId;
  if (info.menuItemId.startsWith(PREFIX_SEL)) {
    mode = 'sel';
    appId = info.menuItemId.substring(PREFIX_SEL.length);
  } else if (info.menuItemId.startsWith(PREFIX_URL)) {
    mode = 'url';
    appId = info.menuItemId.substring(PREFIX_URL.length);
  } else {
    return;
  }

  const value = mode === 'sel' ? info.selectionText : info.pageUrl;

  try {
    await sendOrInject(tab.id, {
      action: 'openChatbot',
      appId: appId,
      value: value,
      mode: mode
    });
  } catch (e) {
    console.error('Dify Chatbot: не удалось отправить сообщение во вкладку', e);
  }
});

async function sendOrInject(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (e) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['lib/storage.js', 'lib/url-matcher.js', 'lib/dify-url.js', 'content.js']
      });
      await new Promise(function (r) { setTimeout(r, 200); });
      await chrome.tabs.sendMessage(tabId, message);
    } catch (e2) {
      throw e2;
    }
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'rebuildContextMenus') {
    buildContextMenus();
    sendResponse({ success: true });
    return true;
  }
  if (msg.action === 'fetchOwuiModels') {
    fetchOwuiModels(msg.baseUrl, msg.apiKey)
      .then(function(models) { sendResponse({ models: models }); })
      .catch(function(e) { sendResponse({ error: e.message }); });
    return true;
  }
  if (msg.action === 'owuiProxy') {
    owuiProxy(msg.endpoint, msg.apiKey, msg.model, msg.messages)
      .then(function(data) { sendResponse(data); })
      .catch(function(e) { sendResponse({ error: e.message }); });
    return true;
  }
  return false;
});

async function fetchOwuiModels(baseUrl, apiKey) {
  var url = buildOwuiApiUrl(baseUrl, '/models');
  console.log('[Dify BG] fetchOwuiModels URL:', url);
  var res = await fetch(url, {
    headers: { 'Authorization': 'Bearer ' + apiKey }
  });
  if (!res.ok) {
    var errBody = '';
    try { errBody = await res.text(); } catch(e) {}
    throw new Error('HTTP ' + res.status + ': ' + errBody.substring(0, 200));
  }
  var contentType = res.headers.get('content-type') || '';
  if (contentType.indexOf('application/json') === -1) {
    var body = await res.text();
    console.error('[Dify BG] fetchOwuiModels: non-JSON response, first 300 chars:', body.substring(0, 300));
    throw new Error('Ответ сервера не является JSON. Проверьте URL инстанса и API ключ.');
  }
  var data = await res.json();
  return (data.data || []).map(function(m) { return m.id; });
}

async function owuiProxy(endpoint, apiKey, model, messages) {
  var url = buildOwuiApiUrl(endpoint, '/chat/completions');
  console.log('[Dify BG] owuiProxy URL:', url);
  var controller = new AbortController();
  var timer = setTimeout(function() { controller.abort(); }, 30000);
  try {
    var res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model: model, messages: messages }),
      signal: controller.signal
    });
    if (!res.ok) {
      var errText = '';
      try { errText = await res.text(); } catch(e) {}
      throw new Error('HTTP ' + res.status + (errText ? ': ' + errText.substring(0, 200) : ''));
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await migrate();
  await buildContextMenus();
});

chrome.runtime.onStartup.addListener(async () => {
  await buildContextMenus();
});

chrome.storage.local.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== 'local') return;
  if (changes['difyChatbotV2']) {
    await buildContextMenus();
  }
});