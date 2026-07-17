(function () {
  var iframeMap = {};
  var closeBtnMap = {};
  var currentApp = null;
  var bubbleBtn = null;
  var displayDiv = null;

  var OPEN_ICON = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" fill="white"/><path d="M7 9h2v2H7V9zm4 0h2v2h-2V9zm4 0h2v2h-2V9z" fill="white"/></svg>';
  var CLOSE_ICON = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 18L6 6M6 18L18 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function injectStyles() {
    if (document.getElementById('dify-cs-styles')) return;
    var style = document.createElement('style');
    style.id = 'dify-cs-styles';
    style.textContent =
      '#dify-chatbot-bubble-button:hover { transform: scale(1.1) !important; }' +
      '#dify-chatbot-bubble-window[data-dify-visible="false"] { display: none !important; }' +
      '#dify-chatbot-bubble-window[data-dify-visible="true"] { display: flex !important; }';
    document.head.appendChild(style);
  }

  function createOrShowIframe(app, prefillValue, mode) {
    var existing = iframeMap[app.id];
    var url = app.baseUrl;

    if (existing) {
      if (prefillValue) {
        var v1 = mode === 'url' ? (app.urlInputVariable || 'page_url') : (app.inputVariable || 'userinput.query');
        existing.src = buildChatbotUrl(app.baseUrl, v1, prefillValue);
      }
      var wrapper = document.getElementById('dify-chatbot-bubble-window');
      if (wrapper) wrapper.setAttribute('data-dify-visible', 'true');
      var cb1 = closeBtnMap[app.id];
      if (cb1) cb1.style.display = 'block';
      if (displayDiv) displayDiv.innerHTML = CLOSE_ICON;
      return;
    }

    if (prefillValue) {
      var v2 = mode === 'url' ? (app.urlInputVariable || 'page_url') : (app.inputVariable || 'userinput.query');
      url = buildChatbotUrl(app.baseUrl, v2, prefillValue);
    }

    var oldWrapper = document.getElementById('dify-chatbot-bubble-window');
    if (oldWrapper) oldWrapper.remove();

    var wrapper = document.createElement('div');
    wrapper.id = 'dify-chatbot-bubble-window';
    wrapper.setAttribute('data-dify-visible', 'true');
    wrapper.style.cssText = 'position:fixed;bottom:6.7rem;right:1rem;width:min(30rem,calc(100vw - 2rem));height:min(48rem,calc(100vh - 8.5rem));z-index:2147483647;border-radius:0.75rem;box-shadow:rgba(150,150,150,0.2) 0px 10px 30px 0px,rgba(150,150,150,0.2) 0px 0px 0px 1px;overflow:hidden;';

    var iframe = document.createElement('iframe');
    iframe.allow = 'fullscreen;microphone';
    iframe.title = 'Dify Chatbot';
    iframe.src = url;
    iframe.style.cssText = 'border:none;width:100%;height:100%;background-color:#F3F4F6;';
    wrapper.appendChild(iframe);
    iframeMap[app.id] = iframe;

    var closeBtn = document.createElement('div');
    closeBtn.style.cssText = 'position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:14px;background:rgba(0,0,0,0.5);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;line-height:1;z-index:1;font-family:Arial,sans-serif;';
    closeBtn.textContent = '\u00D7';
    closeBtn.title = 'Закрыть';
    closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      wrapper.setAttribute('data-dify-visible', 'false');
      closeBtn.style.display = 'none';
      if (displayDiv) displayDiv.innerHTML = OPEN_ICON;
    });
    wrapper.appendChild(closeBtn);
    closeBtnMap[app.id] = closeBtn;

    document.body.appendChild(wrapper);
    if (displayDiv) displayDiv.innerHTML = CLOSE_ICON;
  }

  function hideAll() {
    Object.keys(closeBtnMap).forEach(function (k) {
      var wrapper = document.getElementById('dify-chatbot-bubble-window');
      if (wrapper) wrapper.setAttribute('data-dify-visible', 'false');
      var cb = closeBtnMap[k];
      if (cb) cb.style.display = 'none';
    });
  }

  function toggleChatbot(app) {
    var wrapper = document.getElementById('dify-chatbot-bubble-window');
    var iframe = iframeMap[app.id];
    if (wrapper && iframe && wrapper.getAttribute('data-dify-visible') === 'true') {
      wrapper.setAttribute('data-dify-visible', 'false');
      var cb = closeBtnMap[app.id];
      if (cb) cb.style.display = 'none';
      if (displayDiv) displayDiv.innerHTML = OPEN_ICON;
    } else {
      hideAll();
      createOrShowIframe(app, null, null);
    }
  }

  function openChatbotWithPrefill(appId, value, mode) {
    console.log('[Dify CS] openChatbotWithPrefill:', value ? value.substring(0, 40) : 'null');

    getApps().then(function (apps) {
      var app = apps.find(function (a) { return a.id === appId; });
      if (!app) return;

      copyAndNotify(value, mode);
      hideAll();
      createOrShowIframe(app, value, mode);
    });
  }

  function copyAndNotify(value, mode) {
    var label = mode === 'url' ? 'URL страницы' : 'Текст';
    try {
      navigator.clipboard.writeText(value).then(function () {
        showToast(label + ' скопирован. Вставьте в чат (Ctrl+V).');
      }, function () {
        var ta = document.createElement('textarea');
        ta.value = value;
        ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast(label + ' скопирован. Вставьте в чат (Ctrl+V).');
      });
    } catch (e) {
      showToast(label + ': ' + value.substring(0, 80));
    }
  }

  function showToast(msg) {
    var t = document.getElementById('dify-toast');
    if (t) t.remove();
    t = document.createElement('div');
    t.id = 'dify-toast';
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:8.5rem;right:1rem;background:#333;color:#fff;padding:10px 16px;border-radius:6px;font-size:13px;z-index:2147483648;max-width:320px;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-family:-apple-system,BlinkMacSystemFont,sans-serif;';
    document.body.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { if (t.parentNode) t.remove(); }, 300); }, 5000);
  }

  function handleElementDrag(targetButton) {
    var mouseX = 0, mouseY = 0, offsetX = 0, offsetY = 0;
    targetButton.addEventListener('mousedown', function (event) {
      mouseX = event.clientX; mouseY = event.clientY;
      var rect = targetButton.getBoundingClientRect();
      offsetX = mouseX - rect.left; offsetY = mouseY - rect.top;
      document.addEventListener('mousemove', onMouseMove);
    });
    document.addEventListener('mouseup', function () {
      document.removeEventListener('mousemove', onMouseMove);
    });
    function onMouseMove(event) {
      var newX = event.clientX - offsetX, newY = event.clientY - offsetY;
      newX = Math.max(12, Math.min(newX, window.innerWidth - targetButton.offsetWidth));
      newY = Math.max(12, Math.min(newY, window.innerHeight - targetButton.offsetHeight));
      targetButton.style.left = newX + 'px'; targetButton.style.top = newY + 'px';
      targetButton.style.right = 'unset'; targetButton.style.bottom = 'unset';
    }
  }

  function createFloatingButton(app) {
    if (document.getElementById('dify-chatbot-bubble-button')) return;
    currentApp = app;

    var btn = document.createElement('div');
    btn.id = 'dify-chatbot-bubble-button';
    btn.style.cssText = 'position:fixed;bottom:3rem;right:1rem;width:50px;height:50px;border-radius:25px;background-color:' + app.color + ';box-shadow:rgba(0,0,0,0.2) 0px 4px 8px 0px;cursor:move;z-index:2147483646;transition:transform 0.2s;left:unset;transform:scale(1);';
    btn.title = app.name;

    displayDiv = document.createElement('div');
    displayDiv.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;z-index:2147483647;';
    displayDiv.innerHTML = OPEN_ICON;
    btn.appendChild(displayDiv);
    document.body.appendChild(btn);
    handleElementDrag(btn);

    btn.addEventListener('click', function () { toggleChatbot(app); });
    bubbleBtn = btn;
  }

  function removeEverything() {
    if (bubbleBtn) { bubbleBtn.remove(); bubbleBtn = null; displayDiv = null; }
    Object.values(closeBtnMap).forEach(function (cb) { if (cb.parentNode) cb.remove(); });
    closeBtnMap = {};
    var wrapper = document.getElementById('dify-chatbot-bubble-window');
    if (wrapper) wrapper.remove();
    iframeMap = {};
    currentApp = null;
  }

  function refreshUI() {
    Promise.all([getApps(), getSites(), getSettings()]).then(function (results) {
      var apps = results[0], sites = results[1], settings = results[2];
      var matched = resolveAppForCurrentUrl(apps, sites, settings);
      if (matched && (!currentApp || currentApp.id !== matched.id)) {
        removeEverything();
        createFloatingButton(matched);
      } else if (!matched && currentApp) {
        removeEverything();
      }
    });
  }

  function handleMessage(msg, sender, sendResponse) {
    if (msg.action === 'openChatbot') {
      openChatbotWithPrefill(msg.appId, msg.value, msg.mode);
      sendResponse({ success: true }); return true;
    }
    if (msg.action === 'switchApp') {
      refreshUI();
      sendResponse({ success: true }); return true;
    }
    return false;
  }

  async function init() {
    console.log('[Dify CS] init');
    injectStyles();
    await migrate();

    var apps = await getApps(), sites = await getSites(), settings = await getSettings();
    var matched = resolveAppForCurrentUrl(apps, sites, settings);
    console.log('[Dify CS] matched:', matched ? matched.name : 'null');

    if (matched) createFloatingButton(matched);
    chrome.runtime.onMessage.addListener(handleMessage);

    chrome.storage.local.onChanged.addListener(function (changes, areaName) {
      if (areaName === 'local' && changes['difyChatbotV2']) refreshUI();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init().catch(function (e) { console.error(e); }); });
  } else {
    init().catch(function (e) { console.error(e); });
  }
})();
