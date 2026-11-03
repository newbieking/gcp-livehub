import { Server } from 'socket.io';
import { config } from '../config/index.js';
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
