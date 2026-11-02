import { sessionStore } from '../services/sessionStore.js';
import { messageStore } from '../services/messageStore.js';

/**
 * 点对点私聊与实时输入指示器处理器 (Direct Message & 1v1 Typing Handler)
 */
export function registerDirectMessageHandlers(io, socket) {
  // 发送 1v1 私聊消息并持久化
  socket.on('dm:message', async ({ toUserId, text }) => {
    const session = sessionStore.getSession(socket.id);
    if (!session || !toUserId) return;

    const cleanText = (text || '').trim().slice(0, 1000);
    if (!cleanText) return;

    const targetSession = sessionStore.getUserByUserId(toUserId);

    const messagePayload = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      scope: 'dm',
      fromUserId: session.userId,
      fromUsername: session.username,
      toUserId,
      toUsername: targetSession ? targetSession.username : '联系人',
      text: cleanText,
      time: new Date().toLocaleTimeString(),
      createdAt: Date.now()
    };

    // 持久化存储
    const saved = await messageStore.saveMessage(messagePayload);

    // 发送给目标用户（支持多端同步）
    io.to(`user:${toUserId}`).emit('dm:new_message', saved);

    // 也回发给发送者自己的所有 socket
    io.to(`user:${session.userId}`).emit('dm:new_message', saved);
  });

  // 拉取 1v1 私聊历史记录（支持游标分页）
  socket.on('dm:load_history', async ({ toUserId, beforeTime, limit }) => {
    const session = sessionStore.getSession(socket.id);
    if (!session || !toUserId) return;

    const history = await messageStore.getDMHistory(
      session.userId,
      toUserId,
      limit || 50,
      beforeTime
    );

    socket.emit('dm:history_response', {
      toUserId,
      messages: history
    });
  });

  // 1v1 私聊专用实时输入指示器 (Typing Indicator)
  socket.on('dm:typing', ({ toUserId, isTyping }) => {
    const session = sessionStore.getSession(socket.id);
    if (!session || !toUserId) return;

    // 仅定向通知私聊对象，不产生公共房间广播噪音
    socket.to(`user:${toUserId}`).emit('dm:user_typing', {
      fromUserId: session.userId,
      fromUsername: session.username,
      isTyping: !!isTyping
    });
  });
}
