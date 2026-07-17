(function () {
  var appForm = document.getElementById('app-form');
  var appFormTitle = document.getElementById('app-form-title');
  var appIdInput = document.getElementById('app-id');
  var appNameInput = document.getElementById('app-name');
  var appUrlInput = document.getElementById('app-url');
  var appInputVarInput = document.getElementById('app-input-var');
  var appUrlVarInput = document.getElementById('app-url-var');
  var appColorInput = document.getElementById('app-color');
  var appSaveBtn = document.getElementById('app-save-btn');
  var appCancelBtn = document.getElementById('app-cancel-btn');
  var appsList = document.getElementById('apps-list');
  var addAppBtn = document.getElementById('add-app-btn');

  var siteForm = document.getElementById('site-form');
  var siteFormTitle = document.getElementById('site-form-title');
  var siteIdInput = document.getElementById('site-id');
  var sitePatternInput = document.getElementById('site-pattern');
  var siteAppSelect = document.getElementById('site-app');
  var siteEnabledCheckbox = document.getElementById('site-enabled');
  var siteSaveBtn = document.getElementById('site-save-btn');
  var siteCancelBtn = document.getElementById('site-cancel-btn');
  var sitesList = document.getElementById('sites-list');
  var addSiteBtn = document.getElementById('add-site-btn');

  var defaultAppSelect = document.getElementById('default-app');
  var showAllSitesCheckbox = document.getElementById('show-all-sites');

  var apps = [];
  var sites = [];
  var settings = {};

  async function loadData() {
    var data = await chrome.storage.local.get('difyChatbotV2');
    if (!data.difyChatbotV2) {
      await save(JSON.parse(JSON.stringify({
        apps: [],
        sites: [],
        settings: { defaultAppId: null, showOnAllSites: false }
      })));
      data = await chrome.storage.local.get('difyChatbotV2');
    }
    apps = data.difyChatbotV2.apps || [];
    sites = data.difyChatbotV2.sites || [];
    settings = data.difyChatbotV2.settings || { defaultAppId: null, showOnAllSites: false };
  }

  async function saveAll() {
    await chrome.storage.local.set({ difyChatbotV2: { apps: apps, sites: sites, settings: settings } });
    try { chrome.runtime.sendMessage({ action: 'rebuildContextMenus' }); } catch (e) {}
  }

  function getAppById(id) {
    return apps.find(function (a) { return a.id === id; }) || null;
  }

  function generateId() {
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
  }

  function populateAppSelects() {
    var html = '<option value="">— Нет —</option>';
    apps.forEach(function (a) {
      html += '<option value="' + escapeHtml(a.id) + '">' + escapeHtml(a.name) + '</option>';
    });
    siteAppSelect.innerHTML = html;

    html = '<option value="">— Нет (только на сайтах с правилами) —</option>';
    apps.forEach(function (a) {
      html += '<option value="' + escapeHtml(a.id) + '"' + (settings.defaultAppId === a.id ? ' selected' : '') + '>' + escapeHtml(a.name) + '</option>';
    });
    defaultAppSelect.innerHTML = html;
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderApps() {
    if (apps.length === 0) {
      appsList.innerHTML = '<div class="empty">Нет приложений. Добавьте ваш первый Dify-чат.</div>';
      return;
    }
    var html = '';
    apps.forEach(function (a) {
      html += '<div class="card">' +
        '<div class="card-main">' +
          '<div class="card-color" style="background-color:' + escapeHtml(a.color) + '"></div>' +
          '<div class="card-info">' +
            '<div class="card-title">' + escapeHtml(a.name) + '</div>' +
            '<div class="card-meta">' + escapeHtml(a.baseUrl) + '</div>' +
            '<div class="card-meta">Перем. текста: ' + escapeHtml(a.inputVariable || 'userinput.query') + ' | Перем. URL: ' + escapeHtml(a.urlInputVariable || 'page_url') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="card-actions">' +
          '<button class="btn btn-small" data-edit-app="' + escapeHtml(a.id) + '">Изменить</button>' +
          '<button class="btn btn-small btn-danger" data-delete-app="' + escapeHtml(a.id) + '">Удалить</button>' +
        '</div>' +
      '</div>';
    });
    appsList.innerHTML = html;
    bindAppButtons();
  }

  function bindAppButtons() {
    appsList.querySelectorAll('[data-edit-app]').forEach(function (btn) {
      btn.addEventListener('click', function () { editApp(btn.dataset.editApp); });
    });
    appsList.querySelectorAll('[data-delete-app]').forEach(function (btn) {
      btn.addEventListener('click', function () { deleteAppConfirm(btn.dataset.deleteApp); });
    });
  }

  function renderSites() {
    if (sites.length === 0) {
      sitesList.innerHTML = '<div class="empty">Нет правил сайтов. Добавьте правила для привязки приложений к URL.</div>';
      return;
    }
    var html = '';
    sites.forEach(function (s) {
      var app = getAppById(s.appId);
      var appName = app ? app.name : '(приложение удалено)';
      html += '<div class="card">' +
        '<div class="card-main">' +
          '<div class="card-info">' +
            '<div class="card-title">' + escapeHtml(s.pattern) + '</div>' +
            '<div class="card-meta">Приложение: ' + escapeHtml(appName) + ' | ' + (s.enabled ? 'Включено' : 'Выключено') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="card-actions">' +
          '<button class="btn btn-small" data-edit-site="' + escapeHtml(s.id) + '">Изменить</button>' +
          '<button class="btn btn-small btn-danger" data-delete-site="' + escapeHtml(s.id) + '">Удалить</button>' +
        '</div>' +
      '</div>';
    });
    sitesList.innerHTML = html;
    bindSiteButtons();
  }

  function bindSiteButtons() {
    sitesList.querySelectorAll('[data-edit-site]').forEach(function (btn) {
      btn.addEventListener('click', function () { editSite(btn.dataset.editSite); });
    });
    sitesList.querySelectorAll('[data-delete-site]').forEach(function (btn) {
      btn.addEventListener('click', function () { deleteSiteConfirm(btn.dataset.deleteSite); });
    });
  }

  function editApp(id) {
    var app = getAppById(id);
    if (!app) return;
    appFormTitle.textContent = 'Изменить приложение';
    appIdInput.value = app.id;
    appNameInput.value = app.name;
    appUrlInput.value = app.baseUrl;
    appInputVarInput.value = app.inputVariable || 'userinput.query';
    appUrlVarInput.value = app.urlInputVariable || 'page_url';
    appColorInput.value = app.color || '#155EEF';
    appForm.style.display = 'block';
  }

  function editSite(id) {
    var site = sites.find(function (s) { return s.id === id; });
    if (!site) return;
    siteFormTitle.textContent = 'Изменить правило';
    siteIdInput.value = site.id;
    sitePatternInput.value = site.pattern;
    siteAppSelect.value = site.appId || '';
    siteEnabledCheckbox.checked = site.enabled !== false;
    siteForm.style.display = 'block';
  }

  async function deleteAppConfirm(id) {
    if (!confirm('Удалить это приложение? Все связанные правила сайтов также будут удалены.')) return;
    apps = apps.filter(function (a) { return a.id !== id; });
    sites = sites.filter(function (s) { return s.appId !== id; });
    if (settings.defaultAppId === id) settings.defaultAppId = null;
    await saveAll();
    renderAll();
  }

  async function deleteSiteConfirm(id) {
    if (!confirm('Удалить это правило сайта?')) return;
    sites = sites.filter(function (s) { return s.id !== id; });
    await saveAll();
    renderAll();
  }

  function saveApp() {
    var name = appNameInput.value.trim();
    var url = appUrlInput.value.trim();
    if (!name || !url) { alert('Название и URL обязательны для заполнения'); return; }
    if (!/^https?:\/\//.test(url)) { alert('URL должен начинаться с http:// или https://'); return; }

    var app = {
      id: appIdInput.value || generateId(),
      name: name,
      baseUrl: url,
      inputVariable: appInputVarInput.value.trim() || 'userinput.query',
      urlInputVariable: appUrlVarInput.value.trim() || 'page_url',
      color: appColorInput.value || '#155EEF'
    };

    if (!appIdInput.value) {
      apps.push(app);
    } else {
      var idx = apps.findIndex(function (a) { return a.id === app.id; });
      if (idx >= 0) apps[idx] = app;
    }

    saveAll().then(function () { renderAll(); hideAppForm(); });
  }

  function saveSite() {
    var pattern = sitePatternInput.value.trim();
    var appId = siteAppSelect.value;
    if (!pattern) { alert('Шаблон URL обязателен'); return; }
    if (!appId) { alert('Выберите приложение'); return; }

    var site = {
      id: siteIdInput.value || generateId(),
      pattern: pattern,
      appId: appId,
      enabled: siteEnabledCheckbox.checked
    };

    if (!siteIdInput.value) {
      sites.push(site);
    } else {
      var idx = sites.findIndex(function (s) { return s.id === site.id; });
      if (idx >= 0) sites[idx] = site;
    }

    saveAll().then(function () { renderAll(); hideSiteForm(); });
  }

  async function saveGlobalSettings() {
    settings.defaultAppId = defaultAppSelect.value || null;
    settings.showOnAllSites = showAllSitesCheckbox.checked;
    await saveAll();
  }

  function hideAppForm() {
    appForm.style.display = 'none';
    appIdInput.value = '';
    appNameInput.value = '';
    appUrlInput.value = '';
    appInputVarInput.value = 'userinput.query';
    appUrlVarInput.value = 'page_url';
    appColorInput.value = '#155EEF';
  }

  function hideSiteForm() {
    siteForm.style.display = 'none';
    siteIdInput.value = '';
    sitePatternInput.value = '';
    siteAppSelect.value = '';
    siteEnabledCheckbox.checked = true;
  }

  function renderAll() {
    renderApps();
    renderSites();
    populateAppSelects();
    showAllSitesCheckbox.checked = !!settings.showOnAllSites;
  }

  addAppBtn.addEventListener('click', function () {
    appFormTitle.textContent = 'Добавить приложение';
    appIdInput.value = '';
    appNameInput.value = '';
    appUrlInput.value = '';
    appInputVarInput.value = 'userinput.query';
    appUrlVarInput.value = 'page_url';
    appColorInput.value = '#155EEF';
    appForm.style.display = 'block';
  });

  appSaveBtn.addEventListener('click', saveApp);
  appCancelBtn.addEventListener('click', hideAppForm);

  addSiteBtn.addEventListener('click', function () {
    siteFormTitle.textContent = 'Добавить правило';
    siteIdInput.value = '';
    sitePatternInput.value = '';
    siteAppSelect.value = '';
    siteEnabledCheckbox.checked = true;
    siteForm.style.display = 'block';
  });

  siteSaveBtn.addEventListener('click', saveSite);
  siteCancelBtn.addEventListener('click', hideSiteForm);

  defaultAppSelect.addEventListener('change', saveGlobalSettings);
  showAllSitesCheckbox.addEventListener('change', saveGlobalSettings);

  loadData().then(function () { renderAll(); });
})();