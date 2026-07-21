const STORAGE_KEY = 'difyChatbotV2';
const CONVERSATIONS_KEY = 'owuiConversations';

const DEFAULTS = {
  apps: [],
  sites: [],
  settings: {
    defaultAppId: null,
    showOnAllSites: false
  }
};

const MAX_CHATS_PER_BINDING = 30;
const MAX_MESSAGES_PER_CHAT = 500;

async function load() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  if (!data[STORAGE_KEY]) {
    await save(DEFAULTS);
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
  return data[STORAGE_KEY];
}

async function save(data) {
  await chrome.storage.local.set({ [STORAGE_KEY]: data });
}

async function migrate() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  if (stored[STORAGE_KEY]) {
    const data = stored[STORAGE_KEY];
    var needsSave = false;
    if (data.apps) {
      for (var i = 0; i < data.apps.length; i++) {
        if (!data.apps[i].type) {
          data.apps[i].type = 'dify';
          needsSave = true;
        }
      }
    }
    if (needsSave) {
      await save(data);
    }
    return;
  }
  const legacy = await chrome.storage.sync.get(['chatbotUrl']);
  if (legacy.chatbotUrl) {
    const defaults = JSON.parse(JSON.stringify(DEFAULTS));
    defaults.apps = [{
      id: generateId(),
      type: 'dify',
      name: 'Default',
      baseUrl: legacy.chatbotUrl,
      inputVariable: 'userinput.query',
      urlInputVariable: 'page_url',
      color: '#155EEF'
    }];
    defaults.settings.defaultAppId = defaults.apps[0].id;
    await save(defaults);
  } else {
    await save(JSON.parse(JSON.stringify(DEFAULTS)));
  }
}

function generateId() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
}

function generateChatId() {
  return 'chat_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 7);
}

async function getApps() { const d = await load(); return d.apps; }
async function saveApp(app) {
  const d = await load();
  const idx = d.apps.findIndex(a => a.id === app.id);
  if (idx >= 0) d.apps[idx] = app;
  else d.apps.push(app);
  await save(d);
}
async function deleteApp(id) {
  const d = await load();
  d.apps = d.apps.filter(a => a.id !== id);
  d.sites = d.sites.filter(s => s.appId !== id);
  if (d.settings.defaultAppId === id) d.settings.defaultAppId = null;
  await save(d);
}

async function getSites() { const d = await load(); return d.sites; }
async function saveSite(site) {
  const d = await load();
  const idx = d.sites.findIndex(s => s.id === site.id);
  if (idx >= 0) d.sites[idx] = site;
  else d.sites.push(site);
  await save(d);
}
async function deleteSite(id) {
  const d = await load();
  d.sites = d.sites.filter(s => s.id !== id);
  await save(d);
}

async function getSettings() { const d = await load(); return d.settings; }
async function saveSettings(settings) {
  const d = await load();
  d.settings = settings;
  await save(d);
}

function onChanged(callback) {
  return chrome.storage.local.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes[STORAGE_KEY]) {
      callback(changes[STORAGE_KEY].newValue);
    }
  });
}

function getConversationsKey(appId, hostname) {
  return appId + ':' + hostname;
}

async function loadConversations(appId, hostname) {
  var key = getConversationsKey(appId, hostname);
  var data = await chrome.storage.local.get(CONVERSATIONS_KEY);
  if (!data[CONVERSATIONS_KEY]) return { chats: [], activeChatId: null };
  return data[CONVERSATIONS_KEY][key] || { chats: [], activeChatId: null };
}

async function saveConversations(appId, hostname, convData) {
  var key = getConversationsKey(appId, hostname);
  var data = await chrome.storage.local.get(CONVERSATIONS_KEY);
  var all = data[CONVERSATIONS_KEY] || {};
  if (convData.chats.length === 0) {
    delete all[key];
  } else {
    all[key] = convData;
  }
  await chrome.storage.local.set({ [CONVERSATIONS_KEY]: all });
}

async function addChat(appId, hostname) {
  var conv = await loadConversations(appId, hostname);
  while (conv.chats.length >= MAX_CHATS_PER_BINDING) {
    conv.chats.shift();
  }
  var chat = {
    id: generateChatId(),
    title: '',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  conv.chats.push(chat);
  conv.activeChatId = chat.id;
  await saveConversations(appId, hostname, conv);
  return chat;
}

async function deleteChat(appId, hostname, chatId) {
  var conv = await loadConversations(appId, hostname);
  conv.chats = conv.chats.filter(function(c) { return c.id !== chatId; });
  if (conv.activeChatId === chatId) {
    conv.activeChatId = conv.chats.length > 0 ? conv.chats[conv.chats.length - 1].id : null;
  }
  await saveConversations(appId, hostname, conv);
}

async function setActiveChat(appId, hostname, chatId) {
  var conv = await loadConversations(appId, hostname);
  conv.activeChatId = chatId;
  await saveConversations(appId, hostname, conv);
}

async function addMessageToChat(appId, hostname, chatId, role, content) {
  var conv = await loadConversations(appId, hostname);
  var chat = conv.chats.find(function(c) { return c.id === chatId; });
  if (!chat) return null;
  chat.messages.push({ role: role, content: content });
  while (chat.messages.length > MAX_MESSAGES_PER_CHAT) {
    var removed = chat.messages[1];
    chat.messages = [chat.messages[0]].concat(chat.messages.slice(2));
    if (!removed) break;
  }
  chat.updatedAt = Date.now();
  if (!chat.title && role === 'user') {
    chat.title = content.substring(0, 50);
  }
  await saveConversations(appId, hostname, conv);
  return chat;
}

async function clearAllConversations() {
  await chrome.storage.local.remove(CONVERSATIONS_KEY);
}
