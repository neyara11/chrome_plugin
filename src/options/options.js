(function () {
  var appForm = document.getElementById('app-form');
  var appFormTitle = document.getElementById('app-form-title');
  var appIdInput = document.getElementById('app-id');
  var appTypeSelect = document.getElementById('app-type');
  var appNameInput = document.getElementById('app-name');
  var appUrlInput = document.getElementById('app-url');
  var appInputVarInput = document.getElementById('app-input-var');
  var appUrlVarInput = document.getElementById('app-url-var');
  var appOwuiUrlInput = document.getElementById('app-owui-url');
  var appOwuiApikeyInput = document.getElementById('app-owui-apikey');
  var appOwuiModelInput = document.getElementById('app-owui-model');
  var appOwuiFetchModelsBtn = document.getElementById('app-owui-fetch-models');
  var appColorInput = document.getElementById('app-color');
  var appSaveBtn = document.getElementById('app-save-btn');
  var appCancelBtn = document.getElementById('app-cancel-btn');
  var appsList = document.getElementById('apps-list');
  var addAppBtn = document.getElementById('add-app-btn');
  var appDifyFields = document.getElementById('app-dify-fields');
  var appOwuiFields = document.getElementById('app-owui-fields');

  var siteForm = document.getElementById('site-form');
  var sitePatternTesterInput = document.getElementById('site-pattern-tester');
  var sitePatternTestResult = document.getElementById('site-pattern-test-result');
  var exportBtn = document.getElementById('export-btn');
  var importBtn = document.getElementById('import-btn');
  var importFileInput = document.getElementById('import-file-input');
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
      appsList.innerHTML = '<div class="empty">Нет приложений. Добавьте ваш первый чат-бот.</div>';
      return;
    }
    var html = '';
    apps.forEach(function (a) {
      var typeLabel = a.type === 'openwebui' ? 'Open WebUI' : 'Dify';
      var metaLine = a.type === 'openwebui'
        ? 'Тип: ' + typeLabel + ' | ' + escapeHtml(a.baseUrl) + ' | Модель: ' + escapeHtml(a.owuiModel || '—')
        : 'Тип: ' + typeLabel + ' | ' + escapeHtml(a.baseUrl) + ' | Перем. текста: ' + escapeHtml(a.inputVariable || 'userinput.query');
          html += '<div class="card">' +
        '<div class="card-main">' +
          '<div class="card-color" style="background-color:' + escapeHtml(a.color) + '"></div>' +
          '<div class="card-info">' +
            '<div class="card-title">' + escapeHtml(a.name) + '</div>' +
            '<div class="card-meta">' + metaLine + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="card-actions">' +
          '<button class="btn btn-small" data-clone-app="' + escapeHtml(a.id) + '" title="Дублировать приложение">Копия</button>' +
          '<button class="btn btn-small" data-edit-app="' + escapeHtml(a.id) + '">Изменить</button>' +
          '<button class="btn btn-small btn-danger" data-delete-app="' + escapeHtml(a.id) + '">Удалить</button>' +
        '</div>' +
      '</div>';
    });
    appsList.innerHTML = html;
    bindAppButtons();
  }

  function bindAppButtons() {
    appsList.querySelectorAll('[data-clone-app]').forEach(function (btn) {
      btn.addEventListener('click', function () { cloneApp(btn.dataset.cloneApp); });
    });
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

  async function cloneApp(id) {
    var original = getAppById(id);
    if (!original) return;
    var copy = JSON.parse(JSON.stringify(original));
    copy.id = generateId();
    copy.name = original.name + ' (Копия)';
    apps.push(copy);
    await saveAll();
    renderAll();
  }

  function editApp(id) {
    var app = getAppById(id);
    if (!app) return;
    appFormTitle.textContent = 'Изменить приложение';
    appIdInput.value = app.id;
    appTypeSelect.value = app.type || 'dify';
    appNameInput.value = app.name;
    appUrlInput.value = app.baseUrl || '';
    appInputVarInput.value = app.inputVariable || 'userinput.query';
    appUrlVarInput.value = app.urlInputVariable || 'page_url';
    appOwuiUrlInput.value = app.type === 'openwebui' ? app.baseUrl : '';
    appOwuiApikeyInput.value = app.owuiApiKey || '';
    appOwuiModelInput.value = app.owuiModel || '';
    appColorInput.value = app.color || '#155EEF';
    updateAppTypeFields();
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
    sitePatternTesterInput.value = '';
    sitePatternTestResult.textContent = '';
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
    var type = appTypeSelect.value;
    var name = appNameInput.value.trim();
    if (!name) { alert('Название обязательно для заполнения'); return; }

    var app = {
      id: appIdInput.value || generateId(),
      type: type,
      name: name,
      color: appColorInput.value || '#155EEF'
    };

    if (type === 'dify') {
      var url = appUrlInput.value.trim();
      if (!url) { alert('URL чат-бота обязателен'); return; }
      if (!/^https?:\/\//.test(url)) { alert('URL должен начинаться с http:// или https://'); return; }
      app.baseUrl = url;
      app.inputVariable = appInputVarInput.value.trim() || 'userinput.query';
      app.urlInputVariable = appUrlVarInput.value.trim() || 'page_url';
    } else if (type === 'openwebui') {
      var owuiUrl = appOwuiUrlInput.value.trim();
      if (!owuiUrl) { alert('URL инстанса Open WebUI обязателен'); return; }
      if (!/^https?:\/\//.test(owuiUrl)) { alert('URL должен начинаться с http:// или https://'); return; }
      app.baseUrl = owuiUrl.replace(/\/+$/, '');
      app.owuiApiKey = appOwuiApikeyInput.value.trim();
      app.owuiModel = appOwuiModelInput.value.trim() || 'gpt-4o-mini';
    }

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
    appTypeSelect.value = 'dify';
    appNameInput.value = '';
    appUrlInput.value = '';
    appInputVarInput.value = 'userinput.query';
    appUrlVarInput.value = 'page_url';
    appOwuiUrlInput.value = '';
    appOwuiApikeyInput.value = '';
    appOwuiModelInput.value = '';
    appColorInput.value = '#155EEF';
    updateAppTypeFields();
  }

  function updateAppTypeFields() {
    var type = appTypeSelect.value;
    if (type === 'dify') {
      appDifyFields.style.display = 'block';
      appOwuiFields.style.display = 'none';
    } else {
      appDifyFields.style.display = 'none';
      appOwuiFields.style.display = 'block';
    }
  }

  appTypeSelect.addEventListener('change', updateAppTypeFields);

  appOwuiFetchModelsBtn.addEventListener('click', async function() {
    var baseUrl = appOwuiUrlInput.value.trim();
    var apiKey = appOwuiApikeyInput.value.trim();
    if (!baseUrl || !apiKey) {
      alert('Сначала заполните URL инстанса и API ключ');
      return;
    }
    appOwuiFetchModelsBtn.disabled = true;
    appOwuiFetchModelsBtn.textContent = '...';
    try {
      var response = await chrome.runtime.sendMessage({
        action: 'fetchOwuiModels',
        baseUrl: baseUrl,
        apiKey: apiKey
      });
      if (response.error) {
        alert('Ошибка загрузки моделей: ' + response.error);
      } else {
        var datalist = document.getElementById('owui-models-list');
        datalist.innerHTML = '';
        (response.models || []).forEach(function(modelName) {
          var opt = document.createElement('option');
          opt.value = modelName;
          datalist.appendChild(opt);
        });
        alert('Загружено ' + (response.models || []).length + ' моделей');
      }
    } catch (e) {
      alert('Ошибка соединения: ' + e.message);
    }
    appOwuiFetchModelsBtn.disabled = false;
    appOwuiFetchModelsBtn.textContent = '\u21BB';
  });

  function testSitePattern() {
    var pattern = sitePatternInput.value.trim();
    var testUrl = sitePatternTesterInput.value.trim();
    if (!pattern || !testUrl) {
      sitePatternTestResult.textContent = '';
      return;
    }
    try {
      var isMatch = matchUrl(pattern, testUrl);
      if (isMatch) {
        sitePatternTestResult.textContent = '✓ Совпадает!';
        sitePatternTestResult.style.color = '#16a34a';
      } else {
        sitePatternTestResult.textContent = '✕ Не совпадает';
        sitePatternTestResult.style.color = '#dc2626';
      }
    } catch (e) {
      sitePatternTestResult.textContent = 'Ошибка сопоставления: ' + e.message;
      sitePatternTestResult.style.color = '#dc2626';
    }
  }

  sitePatternInput.addEventListener('input', testSitePattern);
  sitePatternTesterInput.addEventListener('input', testSitePattern);

  function hideSiteForm() {
    siteForm.style.display = 'none';
    siteIdInput.value = '';
    sitePatternInput.value = '';
    siteAppSelect.value = '';
    siteEnabledCheckbox.checked = true;
    sitePatternTesterInput.value = '';
    sitePatternTestResult.textContent = '';
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
    appTypeSelect.value = 'dify';
    appNameInput.value = '';
    appUrlInput.value = '';
    appInputVarInput.value = 'userinput.query';
    appUrlVarInput.value = 'page_url';
    appOwuiUrlInput.value = '';
    appOwuiApikeyInput.value = '';
    appOwuiModelInput.value = '';
    appColorInput.value = '#155EEF';
    updateAppTypeFields();
    appForm.style.display = 'block';
  });

  appSaveBtn.addEventListener('click', saveApp);
  appCancelBtn.addEventListener('click', hideAppForm);

  function exportConfig() {
    var data = {
      version: '2.1',
      exportedAt: new Date().toISOString(),
      difyChatbotV2: {
        apps: apps,
        sites: sites,
        settings: settings
      }
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'dify-chatbot-config-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importConfig(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = async function (event) {
      try {
        var parsed = JSON.parse(event.target.result);
        var payload = parsed.difyChatbotV2 || parsed;
        if (!payload.apps || !Array.isArray(payload.apps)) {
          throw new Error('Некорректный формат файла: отсутствует массив apps');
        }
        if (!confirm('Импортировать настройки? Текущие приложения и правила будут перезаписаны.')) {
          importFileInput.value = '';
          return;
        }
        apps = payload.apps || [];
        sites = payload.sites || [];
        settings = payload.settings || { defaultAppId: null, showOnAllSites: false };
        await saveAll();
        renderAll();
        alert('Настройки успешно импортированы!');
      } catch (err) {
        alert('Ошибка импорта: ' + err.message);
      } finally {
        importFileInput.value = '';
      }
    };
    reader.readAsText(file);
  }

  exportBtn.addEventListener('click', exportConfig);
  importBtn.addEventListener('click', function () { importFileInput.click(); });
  importFileInput.addEventListener('change', importConfig);

  addSiteBtn.addEventListener('click', function () {
    siteFormTitle.textContent = 'Добавить правило';
    siteIdInput.value = '';
    sitePatternInput.value = '';
    siteAppSelect.value = '';
    siteEnabledCheckbox.checked = true;
    sitePatternTesterInput.value = '';
    sitePatternTestResult.textContent = '';
    siteForm.style.display = 'block';
  });

  siteSaveBtn.addEventListener('click', saveSite);
  siteCancelBtn.addEventListener('click', hideSiteForm);

  defaultAppSelect.addEventListener('change', saveGlobalSettings);
  showAllSitesCheckbox.addEventListener('change', saveGlobalSettings);

  loadData().then(function () { renderAll(); });
})();