import { sessionStore } from '../services/sessionStore.js';

/**
 * 连接生命周期与全局会话管理 (Connection Lifecycle Handler)
 */
export function registerConnectionHandlers(io, socket) {
  // 客户端认证与用户身份初始化
  socket.on('auth:init', ({ userId, username }) => {
    const session = sessionStore.saveSession(socket.id, {
      userId,
      username: (username || '访客').trim().slice(0, 20)
    });

    // 将该 socket 加入专属的用户私有频道 user:{userId}，用于定向私聊推送
    socket.join(`user:${session.userId}`);

    console.log(`[用户上线] ${session.username} (ID: ${session.userId}), Socket: ${socket.id}`);

    // 回执初始化成功
    socket.emit('auth:init_success', {
      userId: session.userId,
      username: session.username
    });

    // 广播全局在线用户列表更新
    io.emit('users:online_updated', {
      users: sessionStore.getAllOnlineUsers()
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

    // 如果所在房间还有其他人，通知房间成员
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

    // 全局广播更新在线人员名单
    io.emit('users:online_updated', {
      users: sessionStore.getAllOnlineUsers()
    });
  });
}
