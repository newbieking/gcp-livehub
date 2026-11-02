import { sessionStore } from '../services/sessionStore.js';
import { messageStore } from '../services/messageStore.js';

/**
 * 公共房间/频道业务处理器 (Room Broadcast Handler)
 */
export function registerRoomHandlers(io, socket) {
  // 加入/切换至指定公共房间
  socket.on('room:join', async ({ room }) => {
    const session = sessionStore.getSession(socket.id);
    if (!session) return;

    const targetRoom = (room || '大厅讨论区').trim().slice(0, 30);
    const prevRoom = session.currentRoom;

    // 加入并保持对目标房间的通道订阅
    socket.join(targetRoom);
    sessionStore.saveSession(socket.id, { currentRoom: targetRoom });

    // 回执当前用户成功切入房间
    socket.emit('room:joined_success', {
      room: targetRoom
    });

    // 自动推送该房间的持久化历史记录
    const history = await messageStore.getRoomHistory(targetRoom, 50);
    socket.emit('room:history_response', {
      room: targetRoom,
      messages: history
    });

    if (prevRoom !== targetRoom) {
      // 广播新房间在线成员
      io.to(targetRoom).emit('room:users_updated', {
        room: targetRoom,
        users: sessionStore.getUsersInRoom(io, targetRoom)
      });
    }
  });

  // 请求特定房间的历史记录（支持游标翻页）
  socket.on('room:load_history', async ({ room, beforeTime, limit }) => {
    const history = await messageStore.getRoomHistory(room, limit || 50, beforeTime);
    socket.emit('room:history_response', {
      room,
      messages: history
    });
  });

  // 房间公开发言并持久化
  socket.on('room:message', async (data) => {
    const session = sessionStore.getSession(socket.id);
    if (!session) return;

    const targetRoom = (data.room || session.currentRoom || '大厅讨论区').trim().slice(0, 30);
    const cleanText = (data.text || '').trim().slice(0, 1000);
    if (!cleanText) return;

    const messagePayload = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      scope: 'room',
      room: targetRoom,
      senderId: session.userId,
      senderName: session.username,
      text: cleanText,
      time: new Date().toLocaleTimeString(),
      createdAt: Date.now()
    };

    // 持久化存储
    const saved = await messageStore.saveMessage(messagePayload);

    io.to(targetRoom).emit('room:new_message', saved);
  });
}
