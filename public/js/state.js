import { STORAGE_KEYS, DEFAULT_ROOM } from './config.js';

/**
 * 响应式客户端状态容器 (Reactive Client State)
 */
class AppState {
  constructor() {
    // 生成或恢复唯一用户 ID
    let savedUserId = localStorage.getItem(STORAGE_KEYS.USER_ID);
    if (!savedUserId) {
      savedUserId = 'u_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem(STORAGE_KEYS.USER_ID, savedUserId);
    }

    // 生成或恢复昵称
    let savedUsername = localStorage.getItem(STORAGE_KEYS.USERNAME);
    if (!savedUsername) {
      savedUsername = `极客_${Math.floor(100 + Math.random() * 900)}`;
      localStorage.setItem(STORAGE_KEYS.USERNAME, savedUsername);
    }

    this.user = {
      userId: savedUserId,
      username: savedUsername
    };

    // 当前视口会话：{ type: 'room' | 'dm', targetId: string, targetName: string }
    this.activeConversation = {
      type: 'room',
      targetId: DEFAULT_ROOM,
      targetName: DEFAULT_ROOM
    };

    // 在线用户清单
    this.onlineUsers = [];

    // 消息历史记录池 (隔离房间与各个用户的私聊)
    // room:roomName -> [message]
    // dm:targetUserId -> [message]
    this.messageVault = new Map();

    // 远端用户在私聊中的输入状态: userId -> boolean
    this.dmTypingStatus = new Map();

    // 未读消息气泡计数器: scopeKey ('room:xxx' | 'dm:xxx') -> number
    this.unreadCounts = new Map();
  }

  incrementUnread(scopeKey) {
    const current = this.unreadCounts.get(scopeKey) || 0;
    this.unreadCounts.set(scopeKey, current + 1);
    return current + 1;
  }

  clearUnread(scopeKey) {
    this.unreadCounts.delete(scopeKey);
  }

  getUnread(scopeKey) {
    return this.unreadCounts.get(scopeKey) || 0;
  }

  getTotalUnread() {
    let total = 0;
    for (const count of this.unreadCounts.values()) {
      total += count;
    }
    return total;
  }

  setUsername(name) {
    this.user.username = name;
    localStorage.setItem(STORAGE_KEYS.USERNAME, name);
  }

  setActiveConversation(type, targetId, targetName) {
    this.activeConversation = { type, targetId, targetName };
  }

  getActiveKey() {
    return `${this.activeConversation.type}:${this.activeConversation.targetId}`;
  }

  addMessage(scopeKey, message) {
    if (!this.messageVault.has(scopeKey)) {
      this.messageVault.set(scopeKey, []);
    }
    const list = this.messageVault.get(scopeKey);
    // 避免重复追加
    if (!list.some(m => m.id === message.id)) {
      list.push(message);
    }
  }

  setHistory(scopeKey, messages) {
    const existing = this.messageVault.get(scopeKey) || [];
    const map = new Map();
    // 载入持久化历史
    (messages || []).forEach(m => map.set(m.id, m));
    // 合并当前即时消息
    existing.forEach(m => map.set(m.id, m));

    const merged = Array.from(map.values()).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    this.messageVault.set(scopeKey, merged);
  }

  getActiveMessages() {
    const key = this.getActiveKey();
    return this.messageVault.get(key) || [];
  }
}

export const state = new AppState();
