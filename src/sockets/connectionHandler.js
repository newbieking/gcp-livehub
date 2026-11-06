import { sessionStore } from '../services/sessionStore.js';
import { messageStore } from '../services/messageStore.js';
import { whiteboardStore } from '../services/whiteboardStore.js';
import { userStore } from '../services/userStore.js';

/**
 * 连接生命周期与全局会话管理 (Connection Lifecycle Handler)
 * 具备服务端权威的未读数据同步与已读状态 (Read Watermark) 调度
 */
export function registerConnectionHandlers(io, socket) {
  // 客户端认证与用户身份初始化（服务端权威分发）
  socket.on('auth:init', async ({ userId, username, token: clientToken }) => {
    const targetToken = clientToken || socket.data.token;
    let authUser = targetToken ? userStore.getUserByToken(targetToken) : null;

    if (!authUser && (socket.data.user?.userId || userId)) {
      const lookupId = socket.data.user?.userId || userId;
      authUser = userStore.getUserById(lookupId);
    }

    // 若依然找不到，兜底为当前握手对象
    if (authUser) {
      authUser = userStore.toSafeUser(authUser);
      socket.data.user = authUser;
    } else {
      authUser = socket.data.user;
    }

    let token = targetToken || socket.data.token;

    // 如果客户端携带了自定义合法昵称，且与当前不同，支持更新
    if (authUser && username && username.trim() && username.trim() !== authUser.username) {
      const updated = await userStore.updateUserProfile(authUser.userId, { username });
      if (updated) {
        authUser = updated;
        socket.data.user = updated;
      }
    }

    const effectiveUserId = authUser ? authUser.userId : (userId || socket.id);
    const effectiveUsername = authUser ? authUser.username : (username || '访客').trim().slice(0, 20);
    const effectiveAuthType = authUser ? authUser.authType : 'guest';
    const effectiveBoundId = authUser ? authUser.boundIdentifier : null;

    const session = sessionStore.saveSession(socket.id, {
      userId: effectiveUserId,
      username: effectiveUsername,
      authType: effectiveAuthType,
      boundIdentifier: effectiveBoundId
    });

    // 加入该用户私有广播通道 user:{userId}，用于多端已读同步与私信派发
    socket.join(`user:${session.userId}`);

    // 默认加入公共频道
    ['大厅讨论区', '实时对战大厅', '多人协同白板'].forEach(room => socket.join(room));

    console.log(`[用户上线/刷新] ${session.username} (ID: ${session.userId}, 类型: ${session.authType}), Socket: ${socket.id}`);

    // 从服务端持久化底层拉取该用户的权威未读概览与最近联系人
    const unreadSummary = await messageStore.getUnreadSummary(session.userId);
    const recentConversations = await messageStore.getRecentConversations(session.userId);

    // 下发权威认证状态、Token 与初始未读看板
    socket.emit('auth:init_success', {
      userId: session.userId,
      username: session.username,
      authType: session.authType,
      boundIdentifier: session.boundIdentifier,
      token,
      unreadSummary,
      recentConversations
    });

    // 广播全局在线用户列表更新
    io.emit('users:online_updated', {
      users: sessionStore.getAllOnlineUsers()
    });
  });

  // 客户端主动请求无感刷新身份（例如绑定升级或切换登录后）
  socket.on('auth:refresh', async ({ token }) => {
    const targetToken = token || socket.data.token;
    const freshUser = targetToken ? userStore.getUserByToken(targetToken) : (socket.data.user?.userId ? userStore.getUserById(socket.data.user.userId) : null);

    if (freshUser) {
      const safeUser = userStore.toSafeUser(freshUser);
      socket.data.user = safeUser;
      if (targetToken) socket.data.token = targetToken;

      const session = sessionStore.saveSession(socket.id, {
        userId: safeUser.userId,
        username: safeUser.username,
        authType: safeUser.authType,
        boundIdentifier: safeUser.boundIdentifier
      });

      socket.join(`user:${safeUser.userId}`);

      console.log(`[用户无感状态刷新] ${session.username} (ID: ${session.userId}, 最新类型: ${session.authType})`);

      // 实时全员广播在线用户列表变化（包括该用户的最新 authType）
      io.emit('users:online_updated', {
        users: sessionStore.getAllOnlineUsers()
      });

      const unreadSummary = await messageStore.getUnreadSummary(session.userId);
      const recentConversations = await messageStore.getRecentConversations(session.userId);

      socket.emit('auth:init_success', {
        userId: session.userId,
        username: session.username,
        authType: session.authType,
        boundIdentifier: session.boundIdentifier,
        token: socket.data.token,
        unreadSummary,
        recentConversations
      });
    }
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

    // 清理白板中该用户的协同状态与在线名单
    const affected = whiteboardStore.removeSocketFromAllRooms(socket.id);
    for (const item of affected) {
      io.to(`wb:${item.roomId}`).emit('wb:collaborators_updated', {
        roomId: item.roomId,
        collaborators: item.remaining
      });
      io.to(`wb:${item.roomId}`).emit('wb:user_cursor_leave', {
        userId: session.userId
      });
    }
  });
}
