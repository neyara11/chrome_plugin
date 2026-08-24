(function () {
  function fillChatInputInFrame(text) {
    var textarea = document.querySelector('textarea');
    if (!textarea) return false;
    if (textarea.value === text) {
      console.log('[Dify CS] text already in input, skipping');
      return true;
    }
    var nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    nativeSetter.call(textarea, text);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    textarea.focus();
    return true;
  }

  if (window.self !== window.top) {
    window.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'dify-fill-input' && e.data.text) {
        var attempts = 0;
        function tryFill() {
          attempts++;
          if (fillChatInputInFrame(e.data.text) || attempts > 15) return;
          setTimeout(tryFill, 600);
        }
        tryFill();
      }
    });
    return;
  }

  var iframeMap = {};
  var widgetMap = {};
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

  function scheduleFillChatInput(iframe, text) {
    if (iframe._fillTimer) {
      clearTimeout(iframe._fillTimer);
      iframe._fillTimer = null;
    }
    iframe._fillAttempt = 0;
    iframe._fillText = text;
    iframe._fillDone = false;

    function tryFill() {
      iframe._fillAttempt++;
      try {
        if (fillChatInput(iframe, iframe._fillText)) {
          iframe._fillDone = true;
          return;
        }
      } catch (e) {}

      if (iframe._fillAttempt >= 12) return;

      iframe._fillTimer = setTimeout(tryFill, 800);
    }

    iframe.addEventListener('load', function () {
      setTimeout(tryFill, 1200);
      setTimeout(function () {
        if (!iframe._fillDone) {
          try {
            iframe.contentWindow.postMessage({ type: 'dify-fill-input', text: text }, '*');
          } catch (e) {}
        }
      }, 3000);
    }, { once: true });
  }

  function fillChatInput(iframe, text) {
    var doc = iframe.contentDocument;
    if (!doc) return false;

    var textarea = doc.querySelector('textarea');
    if (!textarea) return false;

    if (textarea.value === text) {
      console.log('[Dify CS] text already in input, skipping');
      return true;
    }

    var nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    nativeSetter.call(textarea, text);

    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));

    textarea.focus();

    console.log('[Dify CS] text inserted into chat input:', text.substring(0, 40));
    return true;
  }

  function makeResizable(wrapper) {
    var handles = [
      { edge: 'nw', cursor: 'nwse-resize', style: 'top:0;left:0;width:12px;height:12px;' },
      { edge: 'n',  cursor: 'ns-resize',   style: 'top:0;left:12px;right:12px;height:6px;' },
      { edge: 'ne', cursor: 'nesw-resize', style: 'top:0;right:0;width:12px;height:12px;' },
      { edge: 'w',  cursor: 'ew-resize',   style: 'top:12px;left:0;bottom:12px;width:6px;' },
      { edge: 'sw', cursor: 'nesw-resize', style: 'bottom:0;left:0;width:14px;height:14px;' }
    ];

    handles.forEach(function (h) {
      var handle = document.createElement('div');
      handle.className = 'dify-resize-handle dify-resize-' + h.edge;
      handle.style.cssText = 'position:absolute;z-index:2147483648;cursor:' + h.cursor + ';' + h.style;

      if (h.edge === 'nw' || h.edge === 'sw' || h.edge === 'ne') {
        var dot = document.createElement('div');
        dot.style.cssText = 'position:absolute;width:6px;height:6px;background:rgba(100,100,100,0.5);border-radius:50%;pointer-events:none;';
        if (h.edge === 'nw') { dot.style.top = '3px'; dot.style.left = '3px'; }
        else if (h.edge === 'sw') { dot.style.bottom = '3px'; dot.style.left = '3px'; }
        else if (h.edge === 'ne') { dot.style.top = '3px'; dot.style.right = '3px'; }
        handle.appendChild(dot);
      }

      handle.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        var rect = wrapper.getBoundingClientRect();
        var startX = e.clientX;
        var startY = e.clientY;
        var startWidth = rect.width;
        var startHeight = rect.height;

        function onMouseMove(ev) {
          var dx = ev.clientX - startX;
          var dy = ev.clientY - startY;

          var newWidth = startWidth;
          var newHeight = startHeight;

          if (h.edge.indexOf('w') !== -1) {
            newWidth = startWidth - dx;
          }
          if (h.edge.indexOf('n') !== -1) {
            newHeight = startHeight - dy;
          } else if (h.edge.indexOf('s') !== -1) {
            newHeight = startHeight + dy;
          }

          var minW = 280, minH = 320;
          var maxW = window.innerWidth - 24;
          var maxH = window.innerHeight - 30;

          newWidth = Math.max(minW, Math.min(newWidth, maxW));
          newHeight = Math.max(minH, Math.min(newHeight, maxH));

          wrapper.style.width = newWidth + 'px';
          wrapper.style.height = newHeight + 'px';
        }

        function onMouseUp() {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });

      wrapper.appendChild(handle);
    });
  }

  function createWrapperElement() {
    var oldWrapper = document.getElementById('dify-chatbot-bubble-window');
    if (oldWrapper) oldWrapper.remove();
    var wrapper = document.createElement('div');
    wrapper.id = 'dify-chatbot-bubble-window';
    wrapper.setAttribute('data-dify-visible', 'true');
    wrapper.style.cssText = 'position:fixed;bottom:6.7rem;right:1rem;width:min(30rem,calc(100vw - 2rem));height:min(48rem,calc(100vh - 8.5rem));z-index:2147483647;border-radius:0.75rem;box-shadow:rgba(150,150,150,0.2) 0px 10px 30px 0px,rgba(150,150,150,0.2) 0px 0px 0px 1px;overflow:hidden;min-width:18rem;min-height:22rem;max-width:calc(100vw - 2rem);max-height:calc(100vh - 6.7rem);direction:ltr;box-sizing:border-box;';
    makeResizable(wrapper);
    return wrapper;
  }

  function createCloseButton(wrapper, appId) {
    var closeBtn = document.createElement('div');
    closeBtn.style.cssText = 'position:fixed;right:14px;width:28px;height:28px;border-radius:14px;background:rgba(0,0,0,0.55);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;line-height:1;z-index:2147483648;font-family:Arial,sans-serif;transition:background 0.15s;';
    closeBtn.textContent = '\u00D7';
    closeBtn.title = 'Закрыть';
    closeBtn.addEventListener('mouseenter', function () { closeBtn.style.background = 'rgba(0,0,0,0.8)'; });
    closeBtn.addEventListener('mouseleave', function () { closeBtn.style.background = 'rgba(0,0,0,0.55)'; });
    closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      wrapper.setAttribute('data-dify-visible', 'false');
      closeBtn.style.display = 'none';
      if (displayDiv) displayDiv.innerHTML = OPEN_ICON;
    });
    document.body.appendChild(closeBtn);
    closeBtnMap[appId] = closeBtn;

    function updateCloseBtnPos() {
      var rect = wrapper.getBoundingClientRect();
      closeBtn.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
      closeBtn.style.right = (window.innerWidth - rect.right + 6) + 'px';
    }
    updateCloseBtnPos();

    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () { updateCloseBtnPos(); });
      ro.observe(wrapper);
    } else {
      setInterval(updateCloseBtnPos, 500);
    }
    return closeBtn;
  }

  function createOrShowIframe(app, prefillValue, mode) {
    if (app.type === 'openwebui') {
      createOrShowOwuiWidget(app, prefillValue, mode);
      return;
    }

    var existing = iframeMap[app.id];
    var url = app.baseUrl;

    if (existing) {
      if (prefillValue) {
        var v1 = mode === 'url' ? (app.urlInputVariable || 'page_url') : (app.inputVariable || 'userinput.query');
        existing.src = buildChatbotUrl(app.baseUrl, v1, prefillValue);
        scheduleFillChatInput(existing, prefillValue);
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

    var wrapper = createWrapperElement();

    var iframe = document.createElement('iframe');
    iframe.allow = 'fullscreen;microphone';
    iframe.title = 'Dify Chatbot';
    iframe.src = url;
    iframe.style.cssText = 'border:none;width:100%;height:100%;background-color:#F3F4F6;direction:ltr;';
    wrapper.appendChild(iframe);
    iframeMap[app.id] = iframe;

    if (prefillValue) {
      scheduleFillChatInput(iframe, prefillValue);
    }

    document.body.appendChild(wrapper);

    createCloseButton(wrapper, app.id);

    if (displayDiv) displayDiv.innerHTML = CLOSE_ICON;
  }

  function createOrShowOwuiWidget(app, prefillValue, mode) {
    var existing = widgetMap[app.id];
    if (existing) {
      existing.show();
      var wrapper = document.getElementById('dify-chatbot-bubble-window');
      if (wrapper) wrapper.setAttribute('data-dify-visible', 'true');
      var cb = closeBtnMap[app.id];
      if (cb) cb.style.display = 'block';
      if (displayDiv) displayDiv.innerHTML = CLOSE_ICON;
      if (prefillValue) {
        var text = mode === 'url' ? 'URL страницы: ' + prefillValue : prefillValue;
        existing.sendMessage(text);
      }
      return;
    }

    var wrapper = createWrapperElement();

    var hostname = '';
    try { hostname = window.location.hostname; } catch (e) {}

    var widget = new OwuiChatWidget({
      apiKey: app.owuiApiKey,
      endpoint: app.baseUrl,
      model: app.owuiModel,
      appId: app.id,
      hostname: hostname
    });
    widget.mount(wrapper);
    widgetMap[app.id] = widget;

    if (prefillValue) {
      var text = mode === 'url' ? 'URL страницы: ' + prefillValue : prefillValue;
      setTimeout(function () { widget.sendMessage(text); }, 600);
    }

    document.body.appendChild(wrapper);

    createCloseButton(wrapper, app.id);

    if (displayDiv) displayDiv.innerHTML = CLOSE_ICON;
  }

  function hideAll() {
    Object.keys(closeBtnMap).forEach(function (k) {
      var wrapper = document.getElementById('dify-chatbot-bubble-window');
      if (wrapper) wrapper.setAttribute('data-dify-visible', 'false');
      var cb = closeBtnMap[k];
      if (cb) cb.style.display = 'none';
      var widget = widgetMap[k];
      if (widget) widget.hide();
    });
  }

  function toggleChatbot(app) {
    if (!app && currentApp) app = currentApp;
    if (!app) return;
    var wrapper = document.getElementById('dify-chatbot-bubble-window');
    var iframe = iframeMap[app.id];
    var widget = widgetMap[app.id];
    var isOpen = wrapper && (iframe || widget) && wrapper.getAttribute('data-dify-visible') === 'true';
    if (isOpen) {
      wrapper.setAttribute('data-dify-visible', 'false');
      var cb = closeBtnMap[app.id];
      if (cb) cb.style.display = 'none';
      if (widget) widget.hide();
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

      hideAll();
      createOrShowIframe(app, value, mode);
      if (app.type !== 'openwebui') {
        copyAndNotify(value, mode);
      }
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
    var mouseX = 0, mouseY = 0, startX = 0, startY = 0, offsetX = 0, offsetY = 0;
    var isDragging = false;
    var moved = false;

    targetButton.addEventListener('mousedown', function (event) {
      if (event.button !== 0) return;
      mouseX = event.clientX;
      mouseY = event.clientY;
      startX = event.clientX;
      startY = event.clientY;
      var rect = targetButton.getBoundingClientRect();
      offsetX = mouseX - rect.left;
      offsetY = mouseY - rect.top;
      isDragging = true;
      moved = false;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp, { once: true });
    });

    function onMouseMove(event) {
      if (!isDragging) return;
      var dx = event.clientX - startX;
      var dy = event.clientY - startY;
      if (!moved && Math.hypot(dx, dy) > 5) {
        moved = true;
      }
      if (moved) {
        var newX = event.clientX - offsetX;
        var newY = event.clientY - offsetY;
        newX = Math.max(12, Math.min(newX, window.innerWidth - targetButton.offsetWidth));
        newY = Math.max(12, Math.min(newY, window.innerHeight - targetButton.offsetHeight));
        targetButton.style.left = newX + 'px';
        targetButton.style.top = newY + 'px';
        targetButton.style.right = 'unset';
        targetButton.style.bottom = 'unset';
      }
    }

    function onMouseUp(event) {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
    }

    targetButton.addEventListener('click', function (event) {
      if (moved) {
        event.stopImmediatePropagation();
        event.preventDefault();
        moved = false;
      }
    }, true);
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
    Object.values(widgetMap).forEach(function (w) { try { w.destroy(); } catch(e) {} });
    widgetMap = {};
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
    if (msg.action === 'toggleChatbot') {
      if (currentApp) {
        toggleChatbot(currentApp);
      } else {
        Promise.all([getApps(), getSites(), getSettings()]).then(function (results) {
          var apps = results[0], sites = results[1], settings = results[2];
          var matched = resolveAppForCurrentUrl(apps, sites, settings);
          if (matched) {
            toggleChatbot(matched);
          }
        });
      }
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

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var wrapper = document.getElementById('dify-chatbot-bubble-window');
        if (wrapper && wrapper.getAttribute('data-dify-visible') === 'true') {
          hideAll();
          if (displayDiv) displayDiv.innerHTML = OPEN_ICON;
        }
      }
    });

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
