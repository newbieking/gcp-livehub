import { STORAGE_KEYS, DEFAULT_ROOM } from './config.js';

/**
 * 响应式客户端状态容器 (Reactive Client State)
 */
class AppState {
  constructor() {
    // 检测是否开启同机隔离调试模式 (?isolate=1 或 ?debug=1)
    const urlParams = new URLSearchParams(window.location.search);
    const isIsolated = urlParams.has('isolate') || urlParams.has('debug');
    const storageEngine = isIsolated ? sessionStorage : localStorage;

    // 1. 初始化稳定设备凭证 (Device ID)
    let deviceId = storageEngine.getItem(STORAGE_KEYS.DEVICE_ID);
    if (!deviceId) {
      deviceId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'dev_' + Math.random().toString(36).substring(2, 12);
      storageEngine.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
    }

    // 2. 读取持久化 Token 与认证状态
    const authToken = storageEngine.getItem(STORAGE_KEYS.AUTH_TOKEN) || null;
    const authType = storageEngine.getItem(STORAGE_KEYS.AUTH_TYPE) || 'guest';
    const boundIdentifier = storageEngine.getItem(STORAGE_KEYS.BOUND_ID) || null;

    // 3. 读取或生成初始用户名与用户ID（等待权威下发）
    let savedUserId = storageEngine.getItem(STORAGE_KEYS.USER_ID) || ('u_' + Math.random().toString(36).substring(2, 9));
    let savedUsername = storageEngine.getItem(STORAGE_KEYS.USERNAME) || `游客_${Math.floor(100 + Math.random() * 900)}`;

    this.storageEngine = storageEngine;
    this.user = {
      userId: savedUserId,
      username: savedUsername,
      authType: authType,
      boundIdentifier: boundIdentifier,
      twoFactorEnabled: false,
      deviceId: deviceId,
      token: authToken
    };

    // 认证状态变更回调列表
    this.authListeners = [];

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

    // 最近联系人列表 (跨刷新持久化): userId -> { userId, username, isOnline: boolean }
    this.contacts = this.loadContactsFromStorage();

    // 未读消息气泡计数器 (跨刷新持久化): scopeKey ('room:xxx' | 'dm:xxx') -> number
    this.unreadCounts = this.loadUnreadFromStorage();

    // 默认进入房间时，消除默认房间本身的未读
    this.clearUnread(`room:${DEFAULT_ROOM}`);
  }

  // 兼容别名属性访问，防止 currentUser 误访问报错
  get currentUser() {
    return this.user;
  }

  /**
   * 注册认证状态变化监听
   */
  onAuthChange(callback) {
    if (typeof callback === 'function') {
      this.authListeners.push(callback);
    }
  }

  /**
   * 服务端权威下发或绑定升级后，同步更新本地会话
   */
  updateAuthSession({ userId, username, authType, boundIdentifier, twoFactorEnabled, token }) {
    if (userId) this.user.userId = userId;
    if (username) this.user.username = username;
    if (authType) this.user.authType = authType;
    if (boundIdentifier !== undefined) this.user.boundIdentifier = boundIdentifier;
    if (twoFactorEnabled !== undefined) this.user.twoFactorEnabled = !!twoFactorEnabled;
    if (token) this.user.token = token;

    // 持久化存储
    this.storageEngine.setItem(STORAGE_KEYS.USER_ID, this.user.userId);
    this.storageEngine.setItem(STORAGE_KEYS.USERNAME, this.user.username);
    this.storageEngine.setItem(STORAGE_KEYS.AUTH_TYPE, this.user.authType);
    if (this.user.boundIdentifier) {
      this.storageEngine.setItem(STORAGE_KEYS.BOUND_ID, this.user.boundIdentifier);
    } else {
      this.storageEngine.removeItem(STORAGE_KEYS.BOUND_ID);
    }
    if (this.user.token) {
      this.storageEngine.setItem(STORAGE_KEYS.AUTH_TOKEN, this.user.token);
    }

    // 触发监听通知
    for (const listener of this.authListeners) {
      try {
        listener(this.user);
      } catch (err) {
        console.error('认证监听回调执行异常:', err);
      }
    }
  }

  getUnreadStorageKey() {
    return `${STORAGE_KEYS.UNREAD_PREFIX}${this.user.userId}`;
  }

  getContactsStorageKey() {
    return `${STORAGE_KEYS.CONTACTS_PREFIX}${this.user.userId}`;
  }

  loadUnreadFromStorage() {
    try {
      const raw = localStorage.getItem(this.getUnreadStorageKey());
      if (raw) {
        const obj = JSON.parse(raw);
        return new Map(Object.entries(obj));
      }
    } catch (err) {
      console.warn('从本地存储恢复未读计数失败:', err);
    }
    return new Map();
  }

  saveUnreadToStorage() {
    try {
      const obj = Object.fromEntries(this.unreadCounts);
      localStorage.setItem(this.getUnreadStorageKey(), JSON.stringify(obj));
    } catch (err) {
      console.warn('持久化未读计数到本地失败:', err);
    }
  }

  loadContactsFromStorage() {
    try {
      const raw = localStorage.getItem(this.getContactsStorageKey());
      if (raw) {
        const list = JSON.parse(raw);
        const map = new Map();
        list.forEach(c => map.set(c.userId, { ...c, isOnline: false }));
        return map;
      }
    } catch (err) {
      console.warn('从本地存储恢复联系人失败:', err);
    }
    return new Map();
  }

  saveContactsToStorage() {
    try {
      const list = Array.from(this.contacts.values());
      localStorage.setItem(this.getContactsStorageKey(), JSON.stringify(list));
    } catch (err) {
      console.warn('持久化联系人失败:', err);
    }
  }

  /**
   * 载入服务端权威下发的未读概览 (SSOT)
   */
  setServerUnreadSummary(summary = {}) {
    this.unreadCounts = new Map(Object.entries(summary));
    // 消除当前正在查看的会话的未读
    this.clearUnread(this.getActiveKey());
    this.saveUnreadToStorage();
  }

  /**
   * 载入服务端权威下发的最近会话联系人 (SSOT)
   */
  setServerRecentConversations(conversations = []) {
    const onlineSet = new Set(this.onlineUsers.map(u => u.userId));
    conversations.forEach(c => {
      if (c.userId !== this.user.userId) {
        this.recordContact(c.userId, c.username, onlineSet.has(c.userId));
      }
    });
  }

  recordContact(userId, username, isOnline = false, authType = null) {
    if (!userId || userId === this.user.userId) return;
    const existing = this.contacts.get(userId) || {};
    this.contacts.set(userId, {
      userId,
      username: username || existing.username || '匿名用户',
      authType: authType || existing.authType || 'guest',
      isOnline: isOnline !== undefined ? isOnline : (existing.isOnline || false),
      lastActive: Date.now()
    });
    this.saveContactsToStorage();
  }

  syncOnlineUsers(onlineUsersList) {
    this.onlineUsers = onlineUsersList || [];

    const onlineMap = new Map(this.onlineUsers.map(u => [u.userId, u]));

    // 更新已有联系人的在线状态与认证类型
    for (const [userId, contact] of this.contacts.entries()) {
      const liveUser = onlineMap.get(userId);
      contact.isOnline = !!liveUser;
      if (liveUser && liveUser.authType) {
        contact.authType = liveUser.authType;
      }
    }

    // 将新上线的用户记录入联系人表
    this.onlineUsers.forEach(u => {
      if (u.userId !== this.user.userId) {
        this.recordContact(u.userId, u.username, true, u.authType);
      }
    });

    this.saveContactsToStorage();
  }

  getContactsList() {
    return Array.from(this.contacts.values()).sort((a, b) => {
      // 在线排在前面，其次按昵称
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return (a.username || '').localeCompare(b.username || '');
    });
  }

  incrementUnread(scopeKey) {
    const current = this.unreadCounts.get(scopeKey) || 0;
    this.unreadCounts.set(scopeKey, current + 1);
    this.saveUnreadToStorage();
    return current + 1;
  }

  clearUnread(scopeKey) {
    if (this.unreadCounts.has(scopeKey)) {
      this.unreadCounts.delete(scopeKey);
      this.saveUnreadToStorage();
    }
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
    sessionStorage.setItem(STORAGE_KEYS.USERNAME, name);
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
