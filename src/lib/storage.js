const STORAGE_KEY = 'difyChatbotV2';

const DEFAULTS = {
  apps: [],
  sites: [],
  settings: {
    defaultAppId: null,
    showOnAllSites: false
  }
};

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
  if (stored[STORAGE_KEY]) return;
  const legacy = await chrome.storage.sync.get(['chatbotUrl']);
  if (legacy.chatbotUrl) {
    const defaults = JSON.parse(JSON.stringify(DEFAULTS));
    defaults.apps = [{
      id: generateId(),
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
