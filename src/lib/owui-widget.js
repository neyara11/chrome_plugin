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
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">' +
                  '<path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>' +
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
  };

  OwuiChatWidget.prototype._escapeHtml = function(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
    var text = this.textareaEl.value.trim();
    if (!text || this.isSending) return;
    this._doSend(text);
  };

  OwuiChatWidget.prototype._doSend = function(text) {
    var self = this;
    this.isSending = true;
    this.textareaEl.value = '';
    this.textareaEl.style.height = 'auto';
    this.sendBtnEl.disabled = true;

    var chat = this._getActiveChat();
    if (!chat) {
      this.isSending = false;
      this.sendBtnEl.disabled = false;
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

    var apiMessages = [];
    for (var i = 0; i < chat.messages.length - 1; i++) {
      var m = chat.messages[i];
      if (m.content !== '') {
        apiMessages.push({ role: m.role, content: m.content });
      }
    }

    var port = chrome.runtime.connect({ name: 'owui-stream' });

    port.onMessage.addListener(function(msg) {
      if (msg.chunk) {
        var updatedChat = self._getActiveChat();
        if (!updatedChat) return;
        var lastMsg = updatedChat.messages[updatedChat.messages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.content += msg.chunk;
          self._saveState();
          self._renderMessages();
        }
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
          self._saveState();
        }
        self._finishStream(port);
        self._renderMessages();
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
    try { port.disconnect(); } catch(e) {}
    this.isSending = false;
    this.sendBtnEl.disabled = false;
    this.textareaEl.focus();

    var chat = this._getActiveChat();
    if (chat) {
      var lastMsg = chat.messages[chat.messages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content) {
        addMessageToChat(this.appId, this.hostname, chat.id, 'assistant', lastMsg.content);
      }
      chat.updatedAt = Date.now();
      this._saveState();
    }
  };

  OwuiChatWidget.prototype._renderAll = function() {
    this._renderMessages();
    this._renderSidebar();
  };

  OwuiChatWidget.prototype._renderMessages = function() {
    var chat = this._getActiveChat();
    var html = '';

    if (chat && chat.messages.length > 0) {
      for (var i = 0; i < chat.messages.length; i++) {
        var m = chat.messages[i];
        var roleClass = m.role === 'user' ? 'user' : 'assistant';
        var content = this._escapeHtml(m.content);
        content = content.replace(/\n/g, '<br>');
        var isLastAsst = this.isSending && i === chat.messages.length - 1 && m.role === 'assistant';
        html += '<div class="' + CSS_PREFIX + 'message ' + CSS_PREFIX + 'message-' + roleClass + '">' +
          '<div class="' + CSS_PREFIX + 'message-role">' + (m.role === 'user' ? 'Вы' : 'AI') + '</div>' +
          '<div class="' + CSS_PREFIX + 'message-content">' + content + (isLastAsst ? '<span class="' + CSS_PREFIX + 'cursor"></span>' : '') + '</div>' +
        '</div>';
      }
    } else {
      html = '<div class="' + CSS_PREFIX + 'empty-state">Напишите сообщение, чтобы начать диалог</div>';
    }

    this.messagesEl.innerHTML = html;
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
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