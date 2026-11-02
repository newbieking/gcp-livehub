// 客户端状态管理
let currentUser = localStorage.getItem('chat_username') || `用户_${Math.floor(1000 + Math.random() * 9000)}`;
let currentRoom = '大厅讨论区';
let typingTimeout = null;

// DOM 元素引用
const usernameInput = document.getElementById('usernameInput');
const saveUsernameBtn = document.getElementById('saveUsernameBtn');
const roomList = document.getElementById('roomList');
const customRoomInput = document.getElementById('customRoomInput');
const joinCustomRoomBtn = document.getElementById('joinCustomRoomBtn');
const memberList = document.getElementById('memberList');
const memberCountPill = document.getElementById('memberCountPill');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const latencyText = document.getElementById('latencyText');
const transportTag = document.getElementById('transportTag');
const reconnectTestBtn = document.getElementById('reconnectTestBtn');

const currentRoomTitle = document.getElementById('currentRoomTitle');
const messagesContainer = document.getElementById('messagesContainer');
const typingIndicator = document.getElementById('typingIndicator');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');

// 初始化昵称
usernameInput.value = currentUser;

// 初始化 Socket.IO 客户端（配置自动重连）
const socket = io({
  reconnection: true,             // 开启自动重连
  reconnectionAttempts: Infinity, // 无限重试
  reconnectionDelay: 1000,        // 初始重试间隔 1 秒
  reconnectionDelayMax: 5000,     // 最大重试间隔 5 秒
  timeout: 20000,                 // 连接超时
  transports: ['websocket', 'polling'] // 优先 websocket，自动 fallback 到 polling
});

// ------------------------------
// 连接生命周期与网络诊断
// ------------------------------

socket.on('connect', () => {
  statusDot.className = 'status-indicator connected';
  statusText.textContent = '已连接';
  updateTransportInfo();

  // 加入当前房间
  socket.emit('join_room', {
    username: currentUser,
    room: currentRoom
  });

  appendSystemNotice(`已成功连接至服务器 (Socket ID: ${socket.id})`);
});

// 监听底层传输升级 (Polling -> WebSocket)
if (socket.io.engine) {
  socket.io.engine.on('upgrade', () => {
    updateTransportInfo();
  });
}

function updateTransportInfo() {
  const transport = socket.io.engine ? socket.io.engine.transport.name : 'unknown';
  transportTag.textContent = `Transport: ${transport.toUpperCase()}`;
}

socket.on('connect_error', (error) => {
  statusDot.className = 'status-indicator disconnected';
  statusText.textContent = '连接异常';
  console.warn('Socket 连接异常:', error);
});

socket.io.on('reconnect_attempt', (attempt) => {
  statusDot.className = 'status-indicator';
  statusText.textContent = `重连中 (${attempt})...`;
});

socket.io.on('reconnect', (attempt) => {
  statusDot.className = 'status-indicator connected';
  statusText.textContent = '已重连';
  appendSystemNotice(`网络已恢复，第 ${attempt} 次尝试重连成功`);
  // 重连后重新加入房间
  socket.emit('join_room', {
    username: currentUser,
    room: currentRoom
  });
});

socket.on('disconnect', (reason) => {
  statusDot.className = 'status-indicator disconnected';
  statusText.textContent = '已离线';
  appendSystemNotice(`连接已断开: ${reason}`);
  memberList.innerHTML = '';
  memberCountPill.textContent = '0';
});

// 简单延迟测速（Ping - Pong 心跳）
setInterval(() => {
  if (socket.connected) {
    const start = Date.now();
    socket.volatile.emit('ping_check', () => {
      const latency = Date.now() - start;
      latencyText.textContent = `${latency} ms`;
    });
  }
}, 3000);

// ------------------------------
// 房间切换与成员列表
// ------------------------------

function switchRoom(newRoom) {
  if (!newRoom || newRoom === currentRoom) return;
  currentRoom = newRoom;
  currentRoomTitle.textContent = currentRoom;

  // 清空消息视口
  messagesContainer.innerHTML = '';
  appendSystemNotice(`正在切换至房间: ${newRoom}...`);

  // 发送加入房间事件
  socket.emit('join_room', {
    username: currentUser,
    room: currentRoom
  });

  // 更新左侧高亮
  document.querySelectorAll('#roomList li').forEach(li => {
    if (li.getAttribute('data-room') === newRoom) {
      li.classList.add('active');
    } else {
      li.classList.remove('active');
    }
  });
}

roomList.addEventListener('click', (e) => {
  if (e.target.tagName === 'LI') {
    const selectedRoom = e.target.getAttribute('data-room');
    switchRoom(selectedRoom);
  }
});

joinCustomRoomBtn.addEventListener('click', () => {
  const custom = customRoomInput.value.trim();
  if (custom) {
    switchRoom(custom);
    customRoomInput.value = '';
  }
});

customRoomInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    joinCustomRoomBtn.click();
  }
});

// 昵称修改
saveUsernameBtn.addEventListener('click', () => {
  const newName = usernameInput.value.trim();
  if (newName && newName !== currentUser) {
    currentUser = newName;
    localStorage.setItem('chat_username', currentUser);
    // 重新通知服务器
    socket.emit('join_room', {
      username: currentUser,
      room: currentRoom
    });
    appendSystemNotice(`昵称已更新为: ${currentUser}`);
  }
});

// ------------------------------
// 消息交互与展示
// ------------------------------

messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;

  socket.emit('send_message', { text });
  messageInput.value = '';

  // 停止 typing 广播
  socket.emit('typing_status', { isTyping: false });
});

// 监听键盘输入以广播 typing 状态
messageInput.addEventListener('input', () => {
  socket.emit('typing_status', { isTyping: true });

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('typing_status', { isTyping: false });
  }, 1200);
});

// 接收新消息
socket.on('new_message', (msg) => {
  renderMessage(msg);
});

// 接收系统通知
socket.on('system_message', (sys) => {
  appendSystemNotice(`${sys.time} - ${sys.text}`);
});

// 接收在线成员列表更新
socket.on('room_users_updated', (data) => {
  if (data.room === currentRoom) {
    memberCountPill.textContent = data.users.length;
    memberList.innerHTML = '';
    data.users.forEach(user => {
      const li = document.createElement('li');
      li.textContent = user === currentUser ? `${user} (我)` : user;
      memberList.appendChild(li);
    });
  }
});

// 接收输入中指示
socket.on('user_typing_update', (data) => {
  if (data.isTyping) {
    typingIndicator.textContent = `✍️ ${data.username} 正在输入...`;
  } else {
    typingIndicator.textContent = '';
  }
});

function renderMessage(msg) {
  const isSelf = msg.sender === currentUser;
  const msgEl = document.createElement('div');
  msgEl.className = `message-item ${isSelf ? 'self' : 'other'}`;

  const metaEl = document.createElement('div');
  metaEl.className = 'message-meta';
  metaEl.textContent = `${msg.sender} · ${msg.time}`;

  const bubbleEl = document.createElement('div');
  bubbleEl.className = 'message-bubble';
  bubbleEl.textContent = msg.text;

  msgEl.appendChild(metaEl);
  msgEl.appendChild(bubbleEl);
  messagesContainer.appendChild(msgEl);

  // 滚动到底部
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function appendSystemNotice(text) {
  const notice = document.createElement('div');
  notice.className = 'system-notice';
  notice.textContent = text;
  messagesContainer.appendChild(notice);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ------------------------------
// 断线重连演示测试按钮
// ------------------------------
reconnectTestBtn.addEventListener('click', () => {
  if (socket.connected) {
    appendSystemNotice('⚠️ 手动触发断开连接，测试自动重连机制...');
    socket.disconnect();
    setTimeout(() => {
      appendSystemNotice('🔄 触发自动重连请求...');
      socket.connect();
    }, 1500);
  } else {
    socket.connect();
  }
});
