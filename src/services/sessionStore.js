/**
 * 会话与用户状态存储服务 (Session & User Store)
 * 阶段一：单实例内存管理
 * 后续扩展：可无缝重构为 Redis 适配器支持多实例集群
 */

class SessionStore {
  constructor() {
    // socketId -> { socketId, userId, username, currentRoom, connectedAt }
    this.sessions = new Map();
    // userId -> Set<socketId> (支持多设备/多标签页同一用户)
    this.userSockets = new Map();
  }

  saveSession(socketId, { userId, username, currentRoom = null, authType = 'guest', boundIdentifier = null }) {
    const existing = this.sessions.get(socketId) || {};
    const sessionData = {
      socketId,
      userId: userId || existing.userId || socketId,
      username: username || existing.username || '匿名用户',
      authType: authType || existing.authType || 'guest',
      boundIdentifier: boundIdentifier || existing.boundIdentifier || null,
      currentRoom: currentRoom !== undefined ? currentRoom : existing.currentRoom,
      connectedAt: existing.connectedAt || Date.now()
    };

    this.sessions.set(socketId, sessionData);

    // 绑定 userId -> socketId
    if (!this.userSockets.has(sessionData.userId)) {
      this.userSockets.set(sessionData.userId, new Set());
    }
    this.userSockets.get(sessionData.userId).add(socketId);

    return sessionData;
  }

  getSession(socketId) {
    return this.sessions.get(socketId);
  }

  getUserByUserId(userId) {
    const socketSet = this.userSockets.get(userId);
    if (socketSet && socketSet.size > 0) {
      const firstSocketId = socketSet.values().next().value;
      return this.sessions.get(firstSocketId);
    }
    return null;
  }

  removeSession(socketId) {
    const session = this.sessions.get(socketId);
    if (!session) return null;

    this.sessions.delete(socketId);

    const userSocketSet = this.userSockets.get(session.userId);
    if (userSocketSet) {
      userSocketSet.delete(socketId);
      if (userSocketSet.size === 0) {
        this.userSockets.delete(session.userId);
      }
    }

    return session;
  }

  getAllOnlineUsers() {
    const uniqueUsers = new Map();
    for (const session of this.sessions.values()) {
      if (!uniqueUsers.has(session.userId)) {
        uniqueUsers.set(session.userId, {
          userId: session.userId,
          username: session.username,
          authType: session.authType,
          currentRoom: session.currentRoom
        });
      }
    }
    return Array.from(uniqueUsers.values());
  }

  getUsersInRoom(io, room) {
    const users = [];
    const roomSockets = io.sockets.adapter.rooms.get(room);
    if (roomSockets) {
      for (const socketId of roomSockets) {
        const session = this.sessions.get(socketId);
        if (session) {
          users.push({
            userId: session.userId,
            username: session.username
          });
        }
      }
    }
    return users;
  }
}

export const sessionStore = new SessionStore();
