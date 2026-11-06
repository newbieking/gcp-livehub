import { state } from './state.js';
import { createSocketConnection } from './socket.js';
import { WhiteboardController } from './whiteboard.js';
import { LobbyController } from './lobby.js';
import { themeManager, initThemeUI } from './theme.js';
import { initAuthManager } from './auth.js';
import {
  dom,
  initUIBindings,
  updateHeader,
  renderMessages,
  appendMessageElement,
  renderOnlineUsers,
  renderTypingIndicator,
  updateConnectionStatus,
  updateLatency,
  updateTransport,
  updateRoomBadges,
  ensureRoomInList,
  updateDocumentTitle
} from './ui.js';

// 初始化主题引擎与交互
themeManager.init();
initThemeUI(themeManager);

// 初始化 UI
initUIBindings();
updateHeader();
renderMessages();
updateRoomBadges();
renderOnlineUsers(switchToDM);
updateDocumentTitle();

// 初始化 Socket 连接
const socket = createSocketConnection(
  updateConnectionStatus,
  updateLatency,
  updateTransport
);

// 初始化多人协作白板控制器与实时对战大厅控制器
const whiteboard = new WhiteboardController(socket, state);
const lobby = new LobbyController(socket, state);

// 初始化渐进式认证与账号管理
initAuthManager(socket);

// ----------------------------------------
// 1. 聊天室/私聊会话切换逻辑
// ----------------------------------------

function switchToRoom(roomName) {
  if (!roomName) return;

  ensureRoomInList(roomName);

  // 清除该频道的未读消息计数
  state.clearUnread(`room:${roomName}`);
  state.setActiveConversation('room', roomName, roomName);

  // 视口切换调度：聊天室 / 白板 / 实时对战大厅
  const chatContentArea = document.getElementById('chatContentArea');
  const whiteboardViewport = document.getElementById('whiteboardViewport');
  const gameLobbyViewport = document.getElementById('gameLobbyViewport');

  if (roomName === '多人协同白板') {
    if (chatContentArea) chatContentArea.classList.add('hidden');
    if (gameLobbyViewport) gameLobbyViewport.classList.add('hidden');
    if (whiteboardViewport) {
      whiteboardViewport.classList.remove('hidden');
      whiteboard.activate(roomName);
    }
  } else if (roomName === '实时对战大厅') {
    if (chatContentArea) chatContentArea.classList.add('hidden');
    if (whiteboardViewport) {
      whiteboard.deactivate();
      whiteboardViewport.classList.add('hidden');
    }
    if (gameLobbyViewport) {
      gameLobbyViewport.classList.remove('hidden');
      lobby.activate();
    }
  } else {
    if (whiteboardViewport && !whiteboardViewport.classList.contains('hidden')) {
      whiteboard.deactivate();
      whiteboardViewport.classList.add('hidden');
    }
    if (gameLobbyViewport) {
      gameLobbyViewport.classList.add('hidden');
    }
    if (chatContentArea) chatContentArea.classList.remove('hidden');
  }

  updateHeader();
  renderMessages();
  renderTypingIndicator();
  updateRoomBadges();
  updateDocumentTitle();

  // 更新左侧高亮
  document.querySelectorAll('#roomList li').forEach(li => {
    li.classList.toggle('active', li.getAttribute('data-room') === roomName);
  });
  renderOnlineUsers(switchToDM);

  // 通知服务器切换房间
  socket.emit('room:join', { room: roomName });

  // 向服务端发送权威已读水位线确认 (Read Ack)
  socket.emit('read:ack', {
    targetId: `room:${roomName}`,
    lastReadTime: Date.now()
  });

  // 移动端切换房间后自动收起抽屉
  if (window.innerWidth <= 768) {
    closeMobileSidebar();
  }
}

function switchToDM(user) {
  // 清除该用户的私聊未读消息计数
  state.clearUnread(`dm:${user.userId}`);
  state.setActiveConversation('dm', user.userId, user.username);

  // 离开白板或大厅切回私聊
  const chatContentArea = document.getElementById('chatContentArea');
  const whiteboardViewport = document.getElementById('whiteboardViewport');
  const gameLobbyViewport = document.getElementById('gameLobbyViewport');

  if (whiteboardViewport && !whiteboardViewport.classList.contains('hidden')) {
    whiteboard.deactivate();
    whiteboardViewport.classList.add('hidden');
  }
  if (gameLobbyViewport) {
    gameLobbyViewport.classList.add('hidden');
  }
  if (chatContentArea) chatContentArea.classList.remove('hidden');

  updateHeader();
  renderMessages();
  renderTypingIndicator();
  updateDocumentTitle();

  // 清除房间高亮，高亮当前私聊联系人并刷新气泡
  document.querySelectorAll('#roomList li').forEach(li => li.classList.remove('active'));
  renderOnlineUsers(switchToDM);

  // 从服务端拉取该私聊的持久化历史记录
  socket.emit('dm:load_history', { toUserId: user.userId });

  // 向服务端发送权威已读水位线确认 (Read Ack)
  socket.emit('read:ack', {
    targetId: `dm:${user.userId}`,
    lastReadTime: Date.now()
  });

  // 移动端切换私聊后自动收起抽屉
  if (window.innerWidth <= 768) {
    closeMobileSidebar();
  }
}

// ----------------------------------------
// 移动端侧滑抽屉控制
// ----------------------------------------
const sidebarEl = document.getElementById('sidebar');
const sidebarBackdropEl = document.getElementById('sidebarBackdrop');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');

function openMobileSidebar() {
  if (sidebarEl) sidebarEl.classList.add('open');
  if (sidebarBackdropEl) sidebarBackdropEl.classList.remove('hidden');
}

function closeMobileSidebar() {
  if (sidebarEl) sidebarEl.classList.remove('open');
  if (sidebarBackdropEl) sidebarBackdropEl.classList.add('hidden');
}

document.querySelectorAll('.mobile-menu-btn').forEach(btn => {
  btn.addEventListener('click', openMobileSidebar);
});

if (closeSidebarBtn) {
  closeSidebarBtn.addEventListener('click', closeMobileSidebar);
}

if (sidebarBackdropEl) {
  sidebarBackdropEl.addEventListener('click', closeMobileSidebar);
}

// 绑定公共房间点击
dom.roomList.addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (li && dom.roomList.contains(li)) {
    const room = li.getAttribute('data-room');
    switchToRoom(room);
  }
});

dom.joinCustomRoomBtn.addEventListener('click', () => {
  const custom = dom.customRoomInput.value.trim();
  if (custom) {
    switchToRoom(custom);
    dom.customRoomInput.value = '';
  }
});

dom.customRoomInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') dom.joinCustomRoomBtn.click();
});

// 绑定更新昵称
dom.saveUsernameBtn.addEventListener('click', () => {
  const newName = dom.usernameInput.value.trim();
  if (newName && newName !== state.user.username) {
    state.setUsername(newName);
    socket.emit('auth:init', {
      userId: state.user.userId,
      username: newName
    });
  }
});

// ----------------------------------------
// 2. 消息发送与 1v1 打字指示器
// ----------------------------------------

let typingTimer = null;

// 监听键盘输入：私聊时精准向对方发送打字状态
dom.messageInput.addEventListener('input', () => {
  if (state.activeConversation.type === 'dm') {
    const toUserId = state.activeConversation.targetId;
    socket.emit('dm:typing', { toUserId, isTyping: true });

    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      socket.emit('dm:typing', { toUserId, isTyping: false });
    }, 1200);
  }
});

// 表单提交发送消息
dom.messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = dom.messageInput.value.trim();
  if (!text) return;

  if (state.activeConversation.type === 'dm') {
    // 发送 1v1 私聊
    const toUserId = state.activeConversation.targetId;
    socket.emit('dm:message', { toUserId, text });
    // 立即结束打字指示
    clearTimeout(typingTimer);
    socket.emit('dm:typing', { toUserId, isTyping: false });
  } else {
    // 广播房间消息
    socket.emit('room:message', { room: state.activeConversation.targetId, text });
  }

  dom.messageInput.value = '';
});

// ----------------------------------------
// 3. Socket 服务端事件监听
// ----------------------------------------

// 收到房间新消息
socket.on('room:new_message', (msg) => {
  const roomKey = `room:${msg.room}`;
  state.addMessage(roomKey, msg);

  // 同步推送至白板迷你聊天抽屉
  if (msg.room === '多人协同白板') {
    whiteboard.appendMiniChatMessage(msg);
  }

  if (state.activeConversation.type === 'room' && state.activeConversation.targetId === msg.room) {
    appendMessageElement(msg);
    // 处于当前窗口，直接向服务端上报已读水位线
    socket.emit('read:ack', {
      targetId: roomKey,
      lastReadTime: msg.createdAt || Date.now()
    });
  } else {
    // 增加未读消息气泡计数
    state.incrementUnread(roomKey);
    ensureRoomInList(msg.room);
    updateRoomBadges();
    updateDocumentTitle();
  }
});

// 收到 1v1 私聊新消息
socket.on('dm:new_message', (msg) => {
  const isMe = msg.fromUserId === state.user.userId;
  const conversationPartnerId = isMe ? msg.toUserId : msg.fromUserId;
  const partnerName = isMe ? (msg.toUsername || '联系人') : (msg.fromUsername || '联系人');
  const dmKey = `dm:${conversationPartnerId}`;

  // 记录联系人到持久化列表 (跨刷新不丢失)
  state.recordContact(conversationPartnerId, partnerName, true);

  state.addMessage(dmKey, msg);

  if (state.activeConversation.type === 'dm' && state.activeConversation.targetId === conversationPartnerId) {
    appendMessageElement(msg);
    // 处于当前窗口，直接向服务端上报已读水位线
    socket.emit('read:ack', {
      targetId: dmKey,
      lastReadTime: msg.createdAt || Date.now()
    });
  } else if (!isMe) {
    // 收到他人发来的未读私信，更新未读气泡并持久化
    state.incrementUnread(dmKey);
    renderOnlineUsers(switchToDM);
    updateDocumentTitle();
  }
});

// 服务端权威握手回执 (SSOT: 下发权威身份、Token、未读汇总与最近联系人)
socket.on('auth:init_success', ({ userId, username, authType, boundIdentifier, twoFactorEnabled, token, unreadSummary, recentConversations }) => {
  if (userId) {
    state.updateAuthSession({
      userId,
      username,
      authType,
      boundIdentifier,
      twoFactorEnabled,
      token
    });
  }
  if (unreadSummary) {
    state.setServerUnreadSummary(unreadSummary);
  }
  if (recentConversations) {
    state.setServerRecentConversations(recentConversations);
  }
  updateRoomBadges();
  renderOnlineUsers(switchToDM);
  updateDocumentTitle();
});

// 服务端已读广播同步 (用于多端/多标签页同一用户的已读消除)
socket.on('read:synced', ({ targetId }) => {
  state.clearUnread(targetId);
  updateRoomBadges();
  renderOnlineUsers(switchToDM);
  updateDocumentTitle();
});

// 收到 1v1 定向打字状态感知
socket.on('dm:user_typing', ({ fromUserId, isTyping }) => {
  state.dmTypingStatus.set(fromUserId, isTyping);
  renderTypingIndicator();
});

// 收到房间历史记录回执
socket.on('room:history_response', ({ room, messages }) => {
  state.setHistory(`room:${room}`, messages);
  if (state.activeConversation.type === 'room' && state.activeConversation.targetId === room) {
    renderMessages();
  }
  // 同步初始化白板迷你讨论抽屉历史
  if (room === '多人协同白板' && Array.isArray(messages)) {
    whiteboard.miniChatMessages.innerHTML = '';
    messages.forEach(m => whiteboard.appendMiniChatMessage(m));
  }
});

// 收到 1v1 私聊历史记录回执
socket.on('dm:history_response', ({ toUserId, messages }) => {
  state.setHistory(`dm:${toUserId}`, messages);
  if (state.activeConversation.type === 'dm' && state.activeConversation.targetId === toUserId) {
    renderMessages();
  }
});

// 收到房间系统通知
socket.on('system:message', (sys) => {
  const roomKey = `room:${sys.room}`;
  const noticeMsg = { type: 'system', text: sys.text, time: sys.time };
  state.addMessage(roomKey, noticeMsg);

  if (state.activeConversation.type === 'room' && state.activeConversation.targetId === sys.room) {
    appendMessageElement(noticeMsg);
  }
});

// 在线用户全局刷新
socket.on('users:online_updated', ({ users }) => {
  state.syncOnlineUsers(users);
  renderOnlineUsers(switchToDM);
});

// 模拟网络断开重连
dom.reconnectTestBtn.addEventListener('click', () => {
  if (socket.connected) {
    socket.disconnect();
    setTimeout(() => {
      socket.connect();
    }, 1500);
  } else {
    socket.connect();
  }
});
