import { SOCKET_CONFIG } from './config.js';
import { state } from './state.js';

/**
 * Socket.IO 连接与诊断生命周期模块
 */
export function createSocketConnection(onStatusChange, onLatencyUpdate, onTransportChange) {
  // io 来自 /socket.io/socket.io.js
  const socket = window.io(SOCKET_CONFIG);

  // 1. 连接就绪
  socket.on('connect', () => {
    onStatusChange('connected', '已连接');
    checkTransport(socket, onTransportChange);

    // 握手并注册当前用户身份
    socket.emit('auth:init', {
      userId: state.user.userId,
      username: state.user.username
    });

    // 重新加入当前房间
    if (state.activeConversation.type === 'room') {
      socket.emit('room:join', { room: state.activeConversation.targetId });
      if (state.activeConversation.targetId === '多人协同白板') {
        socket.emit('wb:join', { room: '多人协同白板' });
      }
    }
  });

  // 2. 传输层协议升级检测 (Polling -> WebSocket)
  if (socket.io.engine) {
    socket.io.engine.on('upgrade', () => {
      checkTransport(socket, onTransportChange);
    });
  }

  // 3. 错误与重试
  socket.on('connect_error', () => {
    onStatusChange('disconnected', '连接异常');
  });

  socket.io.on('reconnect_attempt', (attempt) => {
    onStatusChange('connecting', `重连中 (${attempt})...`);
  });

  socket.io.on('reconnect', () => {
    onStatusChange('connected', '已重连');
  });

  socket.on('disconnect', (reason) => {
    onStatusChange('disconnected', '已离线');
    console.warn(`[Socket 断开] ${reason}`);
  });

  // 4. 定时心跳与延迟探测 (Ping-Pong)
  setInterval(() => {
    if (socket.connected) {
      const start = Date.now();
      socket.volatile.emit('ping:check', () => {
        const latency = Date.now() - start;
        onLatencyUpdate(latency);
      });
    }
  }, 3000);

  return socket;
}

function checkTransport(socket, callback) {
  if (socket.io.engine && typeof callback === 'function') {
    callback(socket.io.engine.transport.name.toUpperCase());
  }
}
