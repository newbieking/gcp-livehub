import { state } from './state.js';

export const dom = {
  userIdTag: document.getElementById('userIdTag'),
  authBadge: document.getElementById('authBadge'),
  authActionBtnText: document.getElementById('authActionBtnText'),
  openAuthModalBtn: document.getElementById('openAuthModalBtn'),
  usernameInput: document.getElementById('usernameInput'),
  saveUsernameBtn: document.getElementById('saveUsernameBtn'),
  roomList: document.getElementById('roomList'),
  customRoomInput: document.getElementById('customRoomInput'),
  joinCustomRoomBtn: document.getElementById('joinCustomRoomBtn'),
  onlineUserList: document.getElementById('onlineUserList'),
  onlineCountBadge: document.getElementById('onlineCountBadge'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  latencyText: document.getElementById('latencyText'),
  transportTag: document.getElementById('transportTag'),
  reconnectTestBtn: document.getElementById('reconnectTestBtn'),

  // 认证弹窗相关
  authModal: document.getElementById('authModal'),
  closeAuthModalBtn: document.getElementById('closeAuthModalBtn'),
  authSuccessMsg: document.getElementById('authSuccessMsg'),
  tabBtnBind: document.getElementById('tabBtnBind'),
  tabBtnLogin: document.getElementById('tabBtnLogin'),
  bindForm: document.getElementById('bindForm'),
  loginForm: document.getElementById('loginForm'),
  bindIdentifierInput: document.getElementById('bindIdentifierInput'),
  bindPasswordInput: document.getElementById('bindPasswordInput'),
  bindErrorMsg: document.getElementById('bindErrorMsg'),
  bindSubmitBtn: document.getElementById('bindSubmitBtn'),
  loginIdentifierInput: document.getElementById('loginIdentifierInput'),
  loginPasswordInput: document.getElementById('loginPasswordInput'),
  loginErrorMsg: document.getElementById('loginErrorMsg'),
  loginSubmitBtn: document.getElementById('loginSubmitBtn'),
  authAlreadyBound: document.getElementById('authAlreadyBound'),
  boundAccountText: document.getElementById('boundAccountText'),

  // 2FA 两步验证相关
  twoFactorStatusBadge: document.getElementById('twoFactorStatusBadge'),
  open2FASetupBtn: document.getElementById('open2FASetupBtn'),
  disable2FABtn: document.getElementById('disable2FABtn'),
  twoFactorSetupView: document.getElementById('twoFactorSetupView'),
  backFrom2FASetupBtn: document.getElementById('backFrom2FASetupBtn'),
  twoFactorQrCodeImg: document.getElementById('twoFactorQrCodeImg'),
  twoFactorSecretCode: document.getElementById('twoFactorSecretCode'),
  copy2FASecretBtn: document.getElementById('copy2FASecretBtn'),
  twoFactorSetupCodeInput: document.getElementById('twoFactorSetupCodeInput'),
  twoFactorSetupErrorMsg: document.getElementById('twoFactorSetupErrorMsg'),
  confirmEnable2FABtn: document.getElementById('confirmEnable2FABtn'),

  // 登录阶段 2FA 挑战
  loginCredentialsFields: document.getElementById('loginCredentialsFields'),
  login2FAChallenge: document.getElementById('login2FAChallenge'),
  login2FACodeInput: document.getElementById('login2FACodeInput'),
  login2FAErrorMsg: document.getElementById('login2FAErrorMsg'),
  login2FASubmitBtn: document.getElementById('login2FASubmitBtn'),
  cancel2FALoginBtn: document.getElementById('cancel2FALoginBtn'),

  chatModeBadge: document.getElementById('chatModeBadge'),
  chatTitle: document.getElementById('chatTitle'),
  chatSubtitle: document.getElementById('chatSubtitle'),
  messagesContainer: document.getElementById('messagesContainer'),
  typingIndicatorBar: document.getElementById('typingIndicatorBar'),
  typingText: document.getElementById('typingText'),
  messageForm: document.getElementById('messageForm'),
  messageInput: document.getElementById('messageInput')
};

export function updateAuthUI(user) {
  if (!dom.authBadge) return;
  const isRegistered = user && user.authType === 'registered';

  if (isRegistered) {
    dom.authBadge.textContent = '已绑定云端';
    dom.authBadge.className = 'auth-badge registered';
    if (dom.authActionBtnText) {
      dom.authActionBtnText.textContent = '账号设置 (已绑定)';
    }
    if (dom.openAuthModalBtn) {
      dom.openAuthModalBtn.classList.add('bound');
    }
  } else {
    dom.authBadge.textContent = '临时游客';
    dom.authBadge.className = 'auth-badge guest';
    if (dom.authActionBtnText) {
      dom.authActionBtnText.textContent = '绑定账号以防丢失';
    }
    if (dom.openAuthModalBtn) {
      dom.openAuthModalBtn.classList.remove('bound');
    }
  }
}

export function initUIBindings() {
  dom.userIdTag.textContent = `ID: ${state.user.userId.slice(0, 8)}`;
  dom.usernameInput.value = state.user.username;
  updateAuthUI(state.user);
  state.onAuthChange((user) => {
    dom.userIdTag.textContent = `ID: ${user.userId.slice(0, 8)}`;
    dom.usernameInput.value = user.username;
    updateAuthUI(user);
  });
}

export function updateHeader() {
  const { type, targetName } = state.activeConversation;
  if (type === 'dm') {
    dom.chatModeBadge.textContent = '私聊会话';
    dom.chatModeBadge.className = 'chat-mode-badge dm';
    dom.chatTitle.textContent = `@ ${targetName}`;
    dom.chatSubtitle.textContent = '端对端私聊通道 · 具备精准打字状态反馈';
  } else {
    dom.chatModeBadge.textContent = '公共频道';
    dom.chatModeBadge.className = 'chat-mode-badge';
    dom.chatTitle.textContent = targetName;
    dom.chatSubtitle.textContent = '房间广播通道 · 毫秒级广播';
  }
}

export function renderMessages() {
  dom.messagesContainer.innerHTML = '';
  const messages = state.getActiveMessages();
  messages.forEach(msg => appendMessageElement(msg));
  scrollToBottom();
}

export function appendMessageElement(msg) {
  if (msg.type === 'system') {
    const notice = document.createElement('div');
    notice.className = 'system-notice';
    notice.textContent = `${msg.time} - ${msg.text}`;
    dom.messagesContainer.appendChild(notice);
  } else {
    const isSelf = msg.senderId === state.user.userId || msg.fromUserId === state.user.userId;
    const isDM = msg.scope === 'dm';

    const item = document.createElement('div');
    item.className = `message-item ${isSelf ? 'self' : 'other'} ${isDM ? 'dm' : ''}`;

    const meta = document.createElement('div');
    meta.className = 'message-meta';
    const senderName = isSelf ? '我' : (msg.senderName || msg.fromUsername || '匿名');
    meta.textContent = `${senderName} · ${msg.time}`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = msg.text;

    item.appendChild(meta);
    item.appendChild(bubble);
    dom.messagesContainer.appendChild(item);
  }

  scrollToBottom();
}

export function renderOnlineUsers(onSelectUser) {
  dom.onlineUserList.innerHTML = '';
  const contacts = state.getContactsList();
  dom.onlineCountBadge.textContent = state.onlineUsers.length;

  contacts.forEach(user => {
    const isMe = user.userId === state.user.userId;
    if (isMe) return; // 不在私聊列表显示自己

    const isSelected = state.activeConversation.type === 'dm' && state.activeConversation.targetId === user.userId;

    const li = document.createElement('li');
    if (isSelected) li.classList.add('active');

    const content = document.createElement('div');
    content.className = 'user-item-content';

    const dot = document.createElement('span');
    dot.className = `status-indicator-dot ${user.isOnline ? 'online' : 'offline'}`;

    const name = document.createElement('span');
    name.textContent = user.username;

    content.appendChild(dot);
    content.appendChild(name);

    if (user.authType === 'registered') {
      const authBadge = document.createElement('span');
      authBadge.className = 'user-item-auth-badge';
      authBadge.title = '已绑定正式账号';
      authBadge.textContent = '✓';
      content.appendChild(authBadge);
    }

    if (!user.isOnline) {
      const offlineTag = document.createElement('span');
      offlineTag.className = 'user-offline-tag';
      offlineTag.textContent = '(离线)';
      content.appendChild(offlineTag);
    }

    li.appendChild(content);

    // 未读消息气泡（私聊）- 从持久化 state 读取
    const unread = state.getUnread(`dm:${user.userId}`);
    if (unread > 0) {
      const badge = document.createElement('span');
      badge.className = 'unread-badge';
      badge.textContent = unread > 99 ? '99+' : unread;
      li.appendChild(badge);
    }

    li.title = `点击与 ${user.username} 开启 1v1 私聊 ${user.isOnline ? '(在线)' : '(离线)'}`;
    li.addEventListener('click', () => onSelectUser(user));

    dom.onlineUserList.appendChild(li);
  });
}

/**
 * 刷新公共房间未读消息气泡
 */
export function updateRoomBadges() {
  // 1. 确保所有有未读消息的房间都被动态呈现在侧边栏中
  for (const key of state.unreadCounts.keys()) {
    if (key.startsWith('room:')) {
      const roomName = key.replace(/^room:/, '');
      ensureRoomInList(roomName);
    }
  }

  // 2. 刷新所有房间项的未读徽标
  document.querySelectorAll('#roomList li').forEach(li => {
    const roomName = li.getAttribute('data-room');
    const existingBadge = li.querySelector('.unread-badge');
    const unread = state.getUnread(`room:${roomName}`);

    if (unread > 0) {
      if (existingBadge) {
        existingBadge.textContent = unread > 99 ? '99+' : unread;
      } else {
        const badge = document.createElement('span');
        badge.className = 'unread-badge';
        badge.textContent = unread > 99 ? '99+' : unread;
        li.appendChild(badge);
      }
    } else if (existingBadge) {
      existingBadge.remove();
    }
  });
}

/**
 * 动态确保房间存在于列表
 */
export function ensureRoomInList(roomName) {
  let existing = document.querySelector(`#roomList li[data-room="${CSS.escape(roomName)}"]`);
  if (!existing) {
    const li = document.createElement('li');
    li.setAttribute('data-room', roomName);

    const titleSpan = document.createElement('span');
    titleSpan.className = 'nav-item-title';
    titleSpan.textContent = roomName;

    li.appendChild(titleSpan);
    dom.roomList.appendChild(li);
  }
}

/**
 * 更新浏览器标签页标题的未读提示
 */
export function updateDocumentTitle() {
  const total = state.getTotalUnread();
  if (total > 0) {
    document.title = `(${total > 99 ? '99+' : total}) GCP LiveHub`;
  } else {
    document.title = 'Real-time Interactive Hub | GCP Cloud Run';
  }
}

export function renderTypingIndicator() {
  if (state.activeConversation.type === 'dm') {
    const targetUserId = state.activeConversation.targetId;
    const isTyping = state.dmTypingStatus.get(targetUserId);
    if (isTyping) {
      dom.typingText.textContent = '对方正在输入中...';
      return;
    }
  }
  dom.typingText.textContent = '';
}

export function updateConnectionStatus(statusClass, text) {
  dom.statusDot.className = `status-indicator ${statusClass}`;
  dom.statusText.textContent = text;
}

export function updateLatency(ms) {
  dom.latencyText.textContent = `${ms} ms`;
}

export function updateTransport(name) {
  dom.transportTag.textContent = `Transport: ${name}`;
}

function scrollToBottom() {
  dom.messagesContainer.scrollTop = dom.messagesContainer.scrollHeight;
}
