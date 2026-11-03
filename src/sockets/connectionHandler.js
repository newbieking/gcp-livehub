import { sessionStore } from '../services/sessionStore.js';
import { messageStore } from '../services/messageStore.js';

/**
 * 连接生命周期与全局会话管理 (Connection Lifecycle Handler)
 * 具备服务端权威的未读数据同步与已读状态 (Read Watermark) 调度
 */
export function registerConnectionHandlers(io, socket) {
  // 客户端认证与用户身份初始化（服务端权威分发）
  socket.on('auth:init', async ({ userId, username }) => {
    const session = sessionStore.saveSession(socket.id, {
      userId,
      username: (username || '访客').trim().slice(0, 20)
    });

    // 加入该用户私有广播通道 user:{userId}，用于多端已读同步与私信派发
    socket.join(`user:${session.userId}`);

    // 默认加入公共频道
    ['大厅讨论区', '实时对战大厅', '多人协同白板'].forEach(room => socket.join(room));

    console.log(`[用户上线] ${session.username} (ID: ${session.userId}), Socket: ${socket.id}`);

    // 从服务端持久化底层拉取该用户的权威未读概览与最近联系人
    const unreadSummary = await messageStore.getUnreadSummary(session.userId);
    const recentConversations = await messageStore.getRecentConversations(session.userId);

    // 下发权威认证状态与初始未读看板
    socket.emit('auth:init_success', {
      userId: session.userId,
      username: session.username,
      unreadSummary,
      recentConversations
    });

    // 广播全局在线用户列表更新
    io.emit('users:online_updated', {
      users: sessionStore.getAllOnlineUsers()
    });
  });

  // 客户端已读确认 (Read Ack)，服务端持久化更新水位线并向用户所有终端广播同步
  socket.on('read:ack', async ({ targetId, lastReadTime }) => {
    const session = sessionStore.getSession(socket.id);
    if (!session || !targetId) return;

    const readTimestamp = Number(lastReadTime) || Date.now();
    await messageStore.saveReadState(session.userId, targetId, readTimestamp);

    // 向当前用户的所有已连接长连接终端广播已读同步
    io.to(`user:${session.userId}`).emit('read:synced', {
      targetId,
      lastReadTime: readTimestamp
    });
  });

  // 延迟测速响应
  socket.on('ping:check', (callback) => {
    if (typeof callback === 'function') {
      callback();
    }
  });

  // 断开连接处理
  socket.on('disconnect', (reason) => {
    const session = sessionStore.removeSession(socket.id);
    if (!session) return;

    console.log(`[用户下线] ${session.username} (ID: ${session.userId}), 原因: ${reason}`);

    if (session.currentRoom) {
      socket.to(session.currentRoom).emit('system:message', {
        type: 'leave',
        text: `${session.username} 已离线`,
        time: new Date().toLocaleTimeString(),
        room: session.currentRoom
      });

      io.to(session.currentRoom).emit('room:users_updated', {
        room: session.currentRoom,
        users: sessionStore.getUsersInRoom(io, session.currentRoom)
      });
    }

    io.emit('users:online_updated', {
      users: sessionStore.getAllOnlineUsers()
    });

    // 清理白板中该用户的协同光标
    socket.broadcast.emit('wb:user_cursor_leave', {
      userId: session.userId
    });
  });
}
