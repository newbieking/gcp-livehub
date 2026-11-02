import { BaseMessageStore } from './base.js';

/**
 * 纯内存存储驱动 (测试环境 / 临时演练使用)
 */
export class MemoryMessageStore extends BaseMessageStore {
  constructor() {
    super('MemoryMessageStore');
    this.messages = [];
    console.log('[Storage/Memory] 已启用纯内存驱动 (不落盘，重启自动重置)');
  }

  async saveMessage(msg) {
    const record = {
      id: msg.id || `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      scope: msg.scope,
      targetId: msg.scope === 'room' ? msg.room : this.getCanonicalDMKey(msg.fromUserId, msg.toUserId),
      room: msg.room || null,
      fromUserId: msg.fromUserId || msg.senderId,
      fromUsername: msg.fromUsername || msg.senderName,
      toUserId: msg.toUserId || null,
      text: msg.text,
      time: msg.time || new Date().toLocaleTimeString(),
      createdAt: msg.createdAt || Date.now()
    };

    this.messages.push(record);
    return record;
  }

  async getRoomHistory(room, limit = 50, beforeTime = null) {
    const list = this.messages.filter(m => {
      if (m.scope !== 'room' || m.room !== room) return false;
      if (beforeTime && m.createdAt >= beforeTime) return false;
      return true;
    });

    return list.slice(-limit);
  }

  async getDMHistory(userA, userB, limit = 50, beforeTime = null) {
    const canonicalKey = this.getCanonicalDMKey(userA, userB);
    const list = this.messages.filter(m => {
      if (m.scope !== 'dm' || m.targetId !== canonicalKey) return false;
      if (beforeTime && m.createdAt >= beforeTime) return false;
      return true;
    });

    return list.slice(-limit);
  }
}
