import { BaseMessageStore } from './base.js';

/**
 * 纯内存存储驱动 (测试环境 / 临时演练使用)
 */
export class MemoryMessageStore extends BaseMessageStore {
  constructor() {
    super('MemoryMessageStore');
    this.messages = [];
    this.readStates = new Map();
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

  async saveReadState(userId, targetId, lastReadTime) {
    const key = `${userId}:${targetId}`;
    const readTimestamp = Number(lastReadTime) || Date.now();
    this.readStates.set(key, {
      userId,
      targetId,
      lastReadTime: readTimestamp,
      updatedAt: Date.now()
    });
    return readTimestamp;
  }

  getReadStateTime(userId, targetId) {
    const key = `${userId}:${targetId}`;
    const record = this.readStates.get(key);
    return record ? record.lastReadTime : 0;
  }

  async getUnreadSummary(userId) {
    const summary = {};

    for (const m of this.messages) {
      if (m.scope === 'room') {
        if (m.fromUserId === userId) continue;
        const targetId = `room:${m.room}`;
        const cursor = this.getReadStateTime(userId, targetId);
        if (m.createdAt > cursor) {
          summary[targetId] = (summary[targetId] || 0) + 1;
        }
      } else if (m.scope === 'dm') {
        if (m.toUserId === userId && m.fromUserId !== userId) {
          const targetId = `dm:${m.fromUserId}`;
          const cursor = this.getReadStateTime(userId, targetId);
          if (m.createdAt > cursor) {
            summary[targetId] = (summary[targetId] || 0) + 1;
          }
        }
      }
    }

    return summary;
  }

  async getRecentConversations(userId) {
    const partners = new Map();

    for (let i = this.messages.length - 1; i >= 0; i--) {
      const m = this.messages[i];
      if (m.scope === 'dm' && (m.fromUserId === userId || m.toUserId === userId)) {
        const isFromMe = m.fromUserId === userId;
        const partnerId = isFromMe ? m.toUserId : m.fromUserId;
        const partnerName = isFromMe ? (m.toUsername || '联系人') : (m.fromUsername || '联系人');

        if (!partners.has(partnerId)) {
          partners.set(partnerId, {
            userId: partnerId,
            username: partnerName,
            lastMessage: m.text,
            lastActive: m.createdAt
          });
        }
      }
    }

    return Array.from(partners.values()).sort((a, b) => b.lastActive - a.lastActive);
  }
}
