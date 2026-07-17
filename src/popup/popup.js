(async function () {
  var select = document.getElementById('app-select');
  var checkbox = document.getElementById('enabled-checkbox');
  var newRuleRow = document.getElementById('new-rule-row');
  var noRuleHint = document.getElementById('no-rule-hint');
  var currentSiteEl = document.getElementById('current-site');
  var statusEl = document.getElementById('status');

  var apps = [];
  var sites = [];
  var settings = {};
  var currentHostname = '';
  var existingRule = null;
  var userAction = false;

  async function loadData() {
    var data = await chrome.storage.local.get('difyChatbotV2');
    if (!data.difyChatbotV2) return;
    apps = data.difyChatbotV2.apps || [];
    sites = data.difyChatbotV2.sites || [];
    settings = data.difyChatbotV2.settings || {};
  }

  async function getCurrentTabHostname() {
    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0] || !tabs[0].url) return '';
    try {
      return new URL(tabs[0].url).hostname;
    } catch (e) {
      return '';
    }
  }

  function findExistingRule() {
    existingRule = sites.find(function (s) {
      try {
        var re = patternToRegex(s.pattern);
        return re.hostRegex.test(currentHostname);
      } catch (e) {
        return false;
      }
    }) || null;
  }

  function populateAppSelect() {
    select.innerHTML = '<option value="">— Не выбрано —</option>';
    apps.forEach(function (a) {
      var opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.name;
      select.appendChild(opt);
    });
  }

  function updateUI() {
    findExistingRule();

    if (existingRule) {
      select.value = existingRule.appId || '';
      checkbox.checked = existingRule.enabled;
      newRuleRow.style.display = 'none';
      noRuleHint.style.display = 'none';
    } else {
      select.value = settings.defaultAppId || '';
      checkbox.checked = !!settings.showOnAllSites;
      newRuleRow.style.display = userAction ? 'block' : 'none';
      noRuleHint.style.display = userAction ? 'none' : 'block';
    }
  }

  async function saveSiteRule(appId, enabled) {
    var id = existingRule ? existingRule.id : generateId();
    var pattern = existingRule ? existingRule.pattern : currentHostname;
    var rule = { id: id, pattern: pattern, appId: appId, enabled: enabled };
    await saveSite(rule);
    sites = await getSites();
    existingRule = rule;
    userAction = true;
    updateUI();
    notifyTab();
  }

  async function removeSiteRule() {
    if (!existingRule) return;
    await deleteSite(existingRule.id);
    sites = await getSites();
    existingRule = null;
    userAction = false;
    updateUI();
    notifyTab();
  }

  async function notifyTab() {
    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      try {
        await chrome.tabs.sendMessage(tabs[0].id, { action: 'switchApp' });
      } catch (e) {}
    }
  }

  function showStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.className = 'status ' + (isError ? 'error' : 'success');
    setTimeout(function () { statusEl.textContent = ''; statusEl.className = 'status'; }, 2000);
  }

  select.addEventListener('change', async function () {
    var appId = select.value;
    if (appId) {
      await saveSiteRule(appId, checkbox.checked);
      showStatus('Сохранено');
    } else {
      if (existingRule) {
        await removeSiteRule();
        showStatus('Правило удалено');
      }
    }
  });

  checkbox.addEventListener('change', async function () {
    if (select.value) {
      await saveSiteRule(select.value, checkbox.checked);
      showStatus('Сохранено');
    }
  });

  document.getElementById('options-btn').addEventListener('click', function () {
    chrome.runtime.openOptionsPage();
  });

  await loadData();
  currentHostname = await getCurrentTabHostname();
  currentSiteEl.textContent = currentHostname || '—';
  populateAppSelect();
  updateUI();
})();