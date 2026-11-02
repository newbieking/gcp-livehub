import { state } from './state.js';

export const dom = {
  userIdTag: document.getElementById('userIdTag'),
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

  chatModeBadge: document.getElementById('chatModeBadge'),
  chatTitle: document.getElementById('chatTitle'),
  chatSubtitle: document.getElementById('chatSubtitle'),
  messagesContainer: document.getElementById('messagesContainer'),
  typingIndicatorBar: document.getElementById('typingIndicatorBar'),
  typingText: document.getElementById('typingText'),
  messageForm: document.getElementById('messageForm'),
  messageInput: document.getElementById('messageInput')
};

export function initUIBindings() {
  dom.userIdTag.textContent = `ID: ${state.user.userId.slice(0, 8)}`;
  dom.usernameInput.value = state.user.username;
}

export function updateHeader() {
  const { type, targetName } = state.activeConversation;
  if (type === 'dm') {
    dom.chatModeBadge.textContent = '🔒 私密会话';
    dom.chatModeBadge.className = 'chat-mode-badge dm';
    dom.chatTitle.textContent = `@ ${targetName}`;
    dom.chatSubtitle.textContent = '端对端私聊通道 · 具备精准打字状态反馈';
  } else {
    dom.chatModeBadge.textContent = '📢 公共频道';
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
  const users = state.onlineUsers;
  dom.onlineCountBadge.textContent = users.length;

  users.forEach(user => {
    const isMe = user.userId === state.user.userId;
    const isSelected = state.activeConversation.type === 'dm' && state.activeConversation.targetId === user.userId;

    const li = document.createElement('li');
    if (isSelected) li.classList.add('active');

    const content = document.createElement('div');
    content.className = 'user-item-content';

    const dot = document.createElement('span');
    dot.className = 'status-indicator-dot';

    const name = document.createElement('span');
    name.textContent = isMe ? `${user.username} (我)` : user.username;

    content.appendChild(dot);
    content.appendChild(name);
    li.appendChild(content);

    // 未读消息气泡（私聊）
    const unread = state.getUnread(`dm:${user.userId}`);
    if (unread > 0) {
      const badge = document.createElement('span');
      badge.className = 'unread-badge';
      badge.textContent = unread > 99 ? '99+' : unread;
      li.appendChild(badge);
    }

    if (!isMe) {
      li.title = `点击与 ${user.username} 开启 1v1 私聊`;
      li.addEventListener('click', () => onSelectUser(user));
    }

    dom.onlineUserList.appendChild(li);
  });
}

/**
 * 刷新公共房间未读消息气泡
 */
export function updateRoomBadges() {
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
    titleSpan.textContent = `📌 ${roomName}`;

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
      dom.typingText.textContent = `✍️ 对方正在输入中...`;
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
