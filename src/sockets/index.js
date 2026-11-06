import { Server } from 'socket.io';
import { config } from '../config/index.js';
import { userStore } from '../services/userStore.js';
import { registerConnectionHandlers } from './connectionHandler.js';
import { registerRoomHandlers } from './roomHandler.js';
import { registerDirectMessageHandlers } from './directMessageHandler.js';
import { registerWhiteboardHandlers } from './whiteboardHandler.js';
import { registerTableHandlers } from './tableHandler.js';

/**
 * Socket.IO 核心装配层
 */
export function initSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: config.cors,
    pingTimeout: config.socket.pingTimeout,
    pingInterval: config.socket.pingInterval,
    transports: config.socket.transports
  });

  // 权威长连接握手鉴权中间件 (Progressive Auth Middleware)
  io.use(async (socket, next) => {
    try {
      const auth = socket.handshake.auth || {};
      const { token, deviceId, username } = auth;

      // 1. 尝试以现有 Token 鉴权
      if (token) {
        const user = userStore.getUserByToken(token);
        if (user) {
          socket.data.user = userStore.toSafeUser(user);
          socket.data.token = token;
          return next();
        }
      }

      // 2. Token 无效或不存在，以 deviceId 恢复或创建游客
      const { user, token: guestToken } = await userStore.getOrCreateGuestUser(deviceId, username);
      socket.data.user = user;
      socket.data.token = guestToken;
      next();
    } catch (err) {
      console.error(`[Socket 握手鉴权异常] ${err.message}`);
      next(new Error('AUTHENTICATION_FAILED'));
    }
  });

  io.on('connection', (socket) => {
    // 注册连接管理
    registerConnectionHandlers(io, socket);

    // 注册房间业务
    registerRoomHandlers(io, socket);

    // 注册点对点私聊与定向打字指示器
    registerDirectMessageHandlers(io, socket);

    // 注册多人协同白板实时网关
    registerWhiteboardHandlers(io, socket);

    // 注册实时对战大厅与游戏桌台信令
    registerTableHandlers(io, socket);
  });

  return io;
}
