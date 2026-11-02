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
    this.messageVault.get(scopeKey).push(message);
  }

  getActiveMessages() {
    const key = this.getActiveKey();
    return this.messageVault.get(key) || [];
  }
}

export const state = new AppState();
