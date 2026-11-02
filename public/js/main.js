import { state } from './state.js';
import { createSocketConnection } from './socket.js';
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

// 初始化 UI
initUIBindings();
updateHeader();
renderMessages();
updateRoomBadges();
updateDocumentTitle();

// 初始化 Socket 连接
const socket = createSocketConnection(
  updateConnectionStatus,
  updateLatency,
  updateTransport
);

// ----------------------------------------
// 1. 聊天室/私聊会话切换逻辑
// ----------------------------------------

function switchToRoom(roomName) {
  if (!roomName) return;

  ensureRoomInList(roomName);

  // 清除该频道的未读消息计数
  state.clearUnread(`room:${roomName}`);
  state.setActiveConversation('room', roomName, roomName);

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
}

function switchToDM(user) {
  // 清除该用户的私聊未读消息计数
  state.clearUnread(`dm:${user.userId}`);
  state.setActiveConversation('dm', user.userId, user.username);

  updateHeader();
  renderMessages();
  renderTypingIndicator();
  updateDocumentTitle();

  // 清除房间高亮，高亮当前私聊联系人并刷新气泡
  document.querySelectorAll('#roomList li').forEach(li => li.classList.remove('active'));
  renderOnlineUsers(switchToDM);

  // 从服务端拉取该私聊的持久化历史记录
  socket.emit('dm:load_history', { toUserId: user.userId });
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

  if (state.activeConversation.type === 'room' && state.activeConversation.targetId === msg.room) {
    appendMessageElement(msg);
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
  const dmKey = `dm:${conversationPartnerId}`;

  state.addMessage(dmKey, msg);

  if (state.activeConversation.type === 'dm' && state.activeConversation.targetId === conversationPartnerId) {
    appendMessageElement(msg);
  } else if (!isMe) {
    // 收到他人发来的未读私信，更新未读气泡
    state.incrementUnread(dmKey);
    renderOnlineUsers(switchToDM);
    updateDocumentTitle();
  }
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
  state.onlineUsers = users;
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
