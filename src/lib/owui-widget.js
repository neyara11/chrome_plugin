(function() {
  'use strict';

  var ACTIVE_CLASS = 'owui-active';
  var CSS_PREFIX = 'owui-';

  window.OwuiChatWidget = function(config) {
    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint.replace(/\/+$/, '');
    this.model = config.model || 'gpt-4o-mini';
    this.appId = config.appId;
    this.hostname = config.hostname;

    this.chats = [];
    this.activeChatId = null;
    this.isSending = false;
    this.activePort = null;
    this.streamBuffer = '';
    this.displayedLength = 0;
    this.rafId = null;
    this.sidebarVisible = false;

    this.el = null;
    this.container = null;
    this.messagesEl = null;
    this.textareaEl = null;
    this.sendBtnEl = null;
    this.sidebarEl = null;
    this.chatListEl = null;
  };

  OwuiChatWidget.prototype.mount = function(container) {
    if (this.el) return;
    this.container = container;
    this._initUI();
    this._loadChats();
  };

  OwuiChatWidget.prototype.destroy = function() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.activePort) {
      try { this.activePort.disconnect(); } catch (e) {}
      this.activePort = null;
    }
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
    this.el = null;
    this.container = null;
  };

  OwuiChatWidget.prototype.show = function() {
    if (this.el) this.el.style.display = 'flex';
  };

  OwuiChatWidget.prototype.hide = function() {
    if (this.el) this.el.style.display = 'none';
  };

  OwuiChatWidget.prototype.sendMessage = function(text) {
    this._ensureActiveChat().then(function(chat) {
      this._doSend(text);
    }.bind(this));
  };

  OwuiChatWidget.prototype._initUI = function() {
    var self = this;

    this.el = document.createElement('div');
    this.el.className = CSS_PREFIX + 'wrapper';
    this.el.innerHTML =
      '<div class="' + CSS_PREFIX + 'header">' +
        '<button class="' + CSS_PREFIX + 'hamburger" title="Чаты">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<line x1="3" y1="6" x2="21" y2="6"></line>' +
            '<line x1="3" y1="12" x2="21" y2="12"></line>' +
            '<line x1="3" y1="18" x2="21" y2="18"></line>' +
          '</svg>' +
        '</button>' +
        '<span class="' + CSS_PREFIX + 'model-label">' + this._escapeHtml(this.model) + '</span>' +
        '<button class="' + CSS_PREFIX + 'new-chat-btn" title="Новый чат">+</button>' +
      '</div>' +
      '<div class="' + CSS_PREFIX + 'body">' +
        '<div class="' + CSS_PREFIX + 'sidebar">' +
          '<div class="' + CSS_PREFIX + 'sidebar-header">' +
            '<span>Чаты</span>' +
            '<button class="' + CSS_PREFIX + 'sidebar-close">&times;</button>' +
          '</div>' +
          '<div class="' + CSS_PREFIX + 'chat-list"></div>' +
        '</div>' +
        '<div class="' + CSS_PREFIX + 'main">' +
          '<div class="' + CSS_PREFIX + 'messages"></div>' +
          '<div class="' + CSS_PREFIX + 'input-area">' +
            '<div class="' + CSS_PREFIX + 'input-wrapper">' +
              '<textarea class="' + CSS_PREFIX + 'textarea" placeholder="Введите сообщение..." rows="1"></textarea>' +
              '<button class="' + CSS_PREFIX + 'send-btn" title="Отправить">' +
                '<svg class="' + CSS_PREFIX + 'send-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">' +
                  '<path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>' +
                '</svg>' +
                '<svg class="' + CSS_PREFIX + 'stop-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:none;">' +
                  '<rect x="4" y="4" width="16" height="16" rx="2"></rect>' +
                '</svg>' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    this.container.appendChild(this.el);

    this.messagesEl = this.el.querySelector('.' + CSS_PREFIX + 'messages');
    this.textareaEl = this.el.querySelector('.' + CSS_PREFIX + 'textarea');
    this.sendBtnEl = this.el.querySelector('.' + CSS_PREFIX + 'send-btn');
    this.sidebarEl = this.el.querySelector('.' + CSS_PREFIX + 'sidebar');
    this.chatListEl = this.el.querySelector('.' + CSS_PREFIX + 'chat-list');
    var hamburger = this.el.querySelector('.' + CSS_PREFIX + 'hamburger');
    var newChatBtn = this.el.querySelector('.' + CSS_PREFIX + 'new-chat-btn');
    var sidebarClose = this.el.querySelector('.' + CSS_PREFIX + 'sidebar-close');

    hamburger.addEventListener('click', function() { self._toggleSidebar(); });
    newChatBtn.addEventListener('click', function() { self._createNewChat(); });
    sidebarClose.addEventListener('click', function() { self._toggleSidebar(); });

    this.textareaEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        self._onSendClick();
      }
    });

    this.textareaEl.addEventListener('input', function() {
      self.textareaEl.style.height = 'auto';
      self.textareaEl.style.height = Math.min(self.textareaEl.scrollHeight, 120) + 'px';
    });

    this.sendBtnEl.addEventListener('click', function() { self._onSendClick(); });

    this.chatListEl.addEventListener('click', function(e) {
      var item = e.target.closest('.' + CSS_PREFIX + 'chat-item');
      if (!item) return;
      var deleteBtn = e.target.closest('.' + CSS_PREFIX + 'chat-delete');
      if (deleteBtn) {
        e.stopPropagation();
        self._deleteChat(item.dataset.chatId);
        return;
      }
      self._switchChat(item.dataset.chatId);
      self._toggleSidebar();
    });

    this.messagesEl.addEventListener('click', function(e) {
      var copyCodeBtn = e.target.closest('.' + CSS_PREFIX + 'code-copy-btn');
      if (copyCodeBtn) {
        var codeBlock = copyCodeBtn.closest('.' + CSS_PREFIX + 'code-block');
        var codeEl = codeBlock ? codeBlock.querySelector('code') : null;
        if (!codeEl) return;
        var textToCopy = codeEl.innerText || codeEl.textContent;
        self._copyToClipboard(textToCopy, function(success) {
          if (success) {
            var orig = copyCodeBtn.textContent;
            copyCodeBtn.textContent = 'Скопировано!';
            setTimeout(function() { copyCodeBtn.textContent = orig; }, 2000);
          }
        });
        return;
      }

      var copyMsgBtn = e.target.closest('.' + CSS_PREFIX + 'msg-copy-btn');
      if (copyMsgBtn) {
        var msgEl = copyMsgBtn.closest('.' + CSS_PREFIX + 'message');
        if (!msgEl) return;
        var msgIndex = parseInt(msgEl.dataset.msgIndex, 10);
        var chat = self._getActiveChat();
        if (chat && chat.messages && chat.messages[msgIndex]) {
          var rawContent = chat.messages[msgIndex].content;
          self._copyToClipboard(rawContent, function(success) {
            if (success) {
              var origTitle = copyMsgBtn.getAttribute('title') || 'Копировать';
              copyMsgBtn.setAttribute('title', 'Скопировано!');
              copyMsgBtn.classList.add(CSS_PREFIX + 'copied');
              setTimeout(function() {
                copyMsgBtn.setAttribute('title', origTitle);
                copyMsgBtn.classList.remove(CSS_PREFIX + 'copied');
              }, 2000);
            }
          });
        }
        return;
      }
    });
  };

  OwuiChatWidget.prototype._copyToClipboard = function(text, callback) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        if (callback) callback(true);
      }).catch(function() {
        fallbackCopy();
      });
    } else {
      fallbackCopy();
    }

    function fallbackCopy() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        var res = document.execCommand('copy');
        document.body.removeChild(ta);
        if (callback) callback(res);
      } catch (err) {
        if (callback) callback(false);
      }
    }
  };

  OwuiChatWidget.prototype._escapeHtml = function(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  OwuiChatWidget.prototype._renderMarkdown = function(rawText) {
    if (!rawText) return '';
    var codeBlocks = [];
    var text = rawText.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, function(match, lang, code) {
      var id = '___CODE_BLOCK_' + codeBlocks.length + '___';
      codeBlocks.push({ lang: lang || '', code: code });
      return id;
    });

    var inlineCodes = [];
    text = text.replace(/`([^`\n]+)`/g, function(match, code) {
      var id = '___INLINE_CODE_' + inlineCodes.length + '___';
      inlineCodes.push(code);
      return id;
    });

    text = this._escapeHtml(text);

    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    var lines = text.split('\n');
    var inList = false;
    var outLines = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var listMatch = line.match(/^(\s*)[*-]\s+(.*)$/);
      if (listMatch) {
        if (!inList) {
          outLines.push('<ul>');
          inList = true;
        }
        outLines.push('<li>' + listMatch[2] + '</li>');
      } else {
        if (inList) {
          outLines.push('</ul>');
          inList = false;
        }
        var hMatch = line.match(/^(#{1,4})\s+(.*)$/);
        if (hMatch) {
          var level = hMatch[1].length;
          outLines.push('<h' + (level + 2) + ' class="owui-md-h">' + hMatch[2] + '</h' + (level + 2) + '>');
        } else if (line.trim() === '') {
          outLines.push('<br>');
        } else {
          outLines.push('<p>' + line + '</p>');
        }
      }
    }
    if (inList) outLines.push('</ul>');
    var html = outLines.join('');

    for (var j = 0; j < inlineCodes.length; j++) {
      html = html.replace('___INLINE_CODE_' + j + '___', '<code class="owui-inline-code">' + this._escapeHtml(inlineCodes[j]) + '</code>');
    }

    for (var k = 0; k < codeBlocks.length; k++) {
      var block = codeBlocks[k];
      var blockHtml =
        '<div class="owui-code-block">' +
          '<div class="owui-code-header">' +
            '<span class="owui-code-lang">' + this._escapeHtml(block.lang) + '</span>' +
            '<button type="button" class="owui-code-copy-btn">Копировать</button>' +
          '</div>' +
          '<pre><code>' + this._escapeHtml(block.code) + '</code></pre>' +
        '</div>';
      html = html.replace('___CODE_BLOCK_' + k + '___', blockHtml);
    }

    return html;
  };

  OwuiChatWidget.prototype._toggleSidebar = function() {
    this.sidebarVisible = !this.sidebarVisible;
    this.sidebarEl.classList.toggle(ACTIVE_CLASS, this.sidebarVisible);
  };

  OwuiChatWidget.prototype._loadChats = function() {
    var self = this;
    loadConversations(this.appId, this.hostname).then(function(conv) {
      self.chats = conv.chats || [];
      self.activeChatId = conv.activeChatId;
      self._ensureActiveChat();
    });
  };

  OwuiChatWidget.prototype._saveState = function() {
    saveConversations(this.appId, this.hostname, {
      chats: this.chats,
      activeChatId: this.activeChatId
    });
  };

  OwuiChatWidget.prototype._ensureActiveChat = function() {
    var self = this;
    if (this.activeChatId && this._getActiveChat()) {
      this._renderAll();
      return Promise.resolve(this._getActiveChat());
    }
    if (this.chats.length > 0) {
      this.activeChatId = this.chats[this.chats.length - 1].id;
      this._saveState();
      this._renderAll();
      return Promise.resolve(this._getActiveChat());
    }
    return addChat(this.appId, this.hostname).then(function(chat) {
      self.chats.push(chat);
      self.activeChatId = chat.id;
      self._renderAll();
      return chat;
    });
  };

  OwuiChatWidget.prototype._getActiveChat = function() {
    var self = this;
    return this.chats.find(function(c) { return c.id === self.activeChatId; }) || null;
  };

  OwuiChatWidget.prototype._createNewChat = function() {
    var self = this;
    addChat(this.appId, this.hostname).then(function(chat) {
      self.chats.push(chat);
      self.activeChatId = chat.id;
      self._renderAll();
      self.textareaEl.focus();
    });
  };

  OwuiChatWidget.prototype._switchChat = function(chatId) {
    this.activeChatId = chatId;
    this._saveState();
    this._renderAll();
  };

  OwuiChatWidget.prototype._deleteChat = function(chatId) {
    var self = this;
    deleteChat(this.appId, this.hostname, chatId).then(function() {
      self.chats = self.chats.filter(function(c) { return c.id !== chatId; });
      if (self.activeChatId === chatId) {
        self.activeChatId = self.chats.length > 0 ? self.chats[self.chats.length - 1].id : null;
      }
      self._ensureActiveChat();
    });
  };

  OwuiChatWidget.prototype._onSendClick = function() {
    if (this.isSending) {
      this._stopGeneration();
      return;
    }
    var text = this.textareaEl.value.trim();
    if (!text) return;
    this._doSend(text);
  };

  OwuiChatWidget.prototype._startSmoothRender = function() {
    var self = this;
    if (this.rafId) return;

    function step() {
      if (!self.isSending && self.displayedLength >= self.streamBuffer.length) {
        self.rafId = null;
        return;
      }

      var chat = self._getActiveChat();
      if (!chat) {
        self.rafId = null;
        return;
      }

      var lastMsg = chat.messages[chat.messages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant') {
        var remaining = self.streamBuffer.length - self.displayedLength;
        if (remaining > 0) {
          var stepSize = Math.max(1, Math.ceil(remaining / 3));
          self.displayedLength = Math.min(self.streamBuffer.length, self.displayedLength + stepSize);
          lastMsg.content = self.streamBuffer.substring(0, self.displayedLength);
          self._renderMessages();
        }
      }

      self.rafId = requestAnimationFrame(step);
    }

    this.rafId = requestAnimationFrame(step);
  };

  OwuiChatWidget.prototype._stopGeneration = function() {
    if (this.activePort) {
      try { this.activePort.disconnect(); } catch (e) {}
      this.activePort = null;
    }
    this._finishStream();
  };

  OwuiChatWidget.prototype._updateSendBtnState = function() {
    var sendIcon = this.sendBtnEl.querySelector('.' + CSS_PREFIX + 'send-icon');
    var stopIcon = this.sendBtnEl.querySelector('.' + CSS_PREFIX + 'stop-icon');
    if (this.isSending) {
      this.sendBtnEl.title = 'Остановить';
      this.sendBtnEl.classList.add(CSS_PREFIX + 'btn-stop');
      if (sendIcon) sendIcon.style.display = 'none';
      if (stopIcon) stopIcon.style.display = 'block';
      this.sendBtnEl.disabled = false;
    } else {
      this.sendBtnEl.title = 'Отправить';
      this.sendBtnEl.classList.remove(CSS_PREFIX + 'btn-stop');
      if (sendIcon) sendIcon.style.display = 'block';
      if (stopIcon) stopIcon.style.display = 'none';
      this.sendBtnEl.disabled = false;
    }
  };

  OwuiChatWidget.prototype._doSend = function(text) {
    var self = this;
    this.isSending = true;
    this.streamBuffer = '';
    this.displayedLength = 0;
    this.textareaEl.value = '';
    this.textareaEl.style.height = 'auto';
    this._updateSendBtnState();

    var chat = this._getActiveChat();
    if (!chat) {
      this.isSending = false;
      this._updateSendBtnState();
      return;
    }

    chat.messages.push({ role: 'user', content: text });
    if (!chat.title) {
      chat.title = text.substring(0, 50);
    }
    chat.updatedAt = Date.now();
    chat.messages.push({ role: 'assistant', content: '' });
    this._saveState();
    this._renderMessages();
    this._startSmoothRender();

    var apiMessages = [];
    for (var i = 0; i < chat.messages.length - 1; i++) {
      var m = chat.messages[i];
      if (m.content !== '') {
        apiMessages.push({ role: m.role, content: m.content });
      }
    }

    var port = chrome.runtime.connect({ name: 'owui-stream' });
    this.activePort = port;

    port.onMessage.addListener(function(msg) {
      if (msg.chunk) {
        self.streamBuffer += msg.chunk;
      } else if (msg.done) {
        self._finishStream(port);
      } else if (msg.error) {
        var updatedChat = self._getActiveChat();
        if (updatedChat) {
          var lastMsg = updatedChat.messages[updatedChat.messages.length - 1];
          if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content === '') {
            updatedChat.messages.pop();
          }
          updatedChat.messages.push({ role: 'assistant', content: '⚠️ Ошибка: ' + msg.error });
          updatedChat.updatedAt = Date.now();
          addMessageToChat(self.appId, self.hostname, updatedChat.id, 'assistant', '⚠️ Ошибка: ' + msg.error);
        }
        self._finishStream(port);
      }
    });

    port.onDisconnect.addListener(function() {
      self._finishStream(port);
    });

    port.postMessage({
      action: 'owuiStream',
      endpoint: self.endpoint,
      apiKey: self.apiKey,
      model: self.model,
      messages: apiMessages
    });
  };

  OwuiChatWidget.prototype._finishStream = function(port) {
    if (port && port === this.activePort) {
      try { port.disconnect(); } catch(e) {}
      this.activePort = null;
    }
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.isSending = false;
    this._updateSendBtnState();
    this.textareaEl.focus();

    var chat = this._getActiveChat();
    if (chat) {
      var lastMsg = chat.messages[chat.messages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant') {
        if (this.streamBuffer) {
          lastMsg.content = this.streamBuffer;
        }
        if (lastMsg.content) {
          addMessageToChat(this.appId, this.hostname, chat.id, 'assistant', lastMsg.content);
        }
      }
      chat.updatedAt = Date.now();
      this._saveState();
    }
    this._renderMessages();
  };

  OwuiChatWidget.prototype._renderAll = function() {
    this._renderMessages();
    this._renderSidebar();
  };

  OwuiChatWidget.prototype._renderMessages = function() {
    var chat = this._getActiveChat();
    var html = '';

    var scrollThreshold = 60;
    var isNearBottom = this.messagesEl
      ? (this.messagesEl.scrollHeight - this.messagesEl.scrollTop - this.messagesEl.clientHeight <= scrollThreshold)
      : true;

    if (chat && chat.messages.length > 0) {
      for (var i = 0; i < chat.messages.length; i++) {
        var m = chat.messages[i];
        var roleClass = m.role === 'user' ? 'user' : 'assistant';
        var renderedContent = m.role === 'user'
          ? this._escapeHtml(m.content).replace(/\n/g, '<br>')
          : this._renderMarkdown(m.content);
        var isLastAsst = this.isSending && i === chat.messages.length - 1 && m.role === 'assistant';
        html += '<div class="' + CSS_PREFIX + 'message ' + CSS_PREFIX + 'message-' + roleClass + '" data-msg-index="' + i + '">' +
          '<div class="' + CSS_PREFIX + 'message-header">' +
            '<span class="' + CSS_PREFIX + 'message-role">' + (m.role === 'user' ? 'Вы' : 'AI') + '</span>' +
            (!isLastAsst && m.content ? '<button type="button" class="' + CSS_PREFIX + 'msg-copy-btn" title="Копировать ответ">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>' +
                '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>' +
              '</svg>' +
            '</button>' : '') +
          '</div>' +
          '<div class="' + CSS_PREFIX + 'message-content">' + renderedContent + (isLastAsst ? '<span class="' + CSS_PREFIX + 'cursor"></span>' : '') + '</div>' +
        '</div>';
      }
    } else {
      html = '<div class="' + CSS_PREFIX + 'empty-state">Напишите сообщение, чтобы начать диалог</div>';
    }

    this.messagesEl.innerHTML = html;
    if (isNearBottom) {
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }
  };

  OwuiChatWidget.prototype._renderSidebar = function() {
    var self = this;
    var sorted = this.chats.slice().sort(function(a, b) { return b.updatedAt - a.updatedAt; });
    var html = '';

    for (var i = 0; i < sorted.length; i++) {
      var chat = sorted[i];
      var title = chat.title || 'Новый чат';
      var isActive = chat.id === self.activeChatId;
      html += '<div class="' + CSS_PREFIX + 'chat-item' + (isActive ? ' ' + ACTIVE_CLASS : '') + '" data-chat-id="' + self._escapeHtml(chat.id) + '">' +
        '<span class="' + CSS_PREFIX + 'chat-title">' + self._escapeHtml(title) + '</span>' +
        '<button class="' + CSS_PREFIX + 'chat-delete" title="Удалить чат">&times;</button>' +
      '</div>';
    }

    this.chatListEl.innerHTML = html;
  };
})();