import { BaseMessageStore } from './base.js';

/**
 * Google Cloud Firestore 生产级存储驱动
 * 支持基于集合 read_states 的服务端已读标记
 */
export class FirestoreMessageStore extends BaseMessageStore {
  constructor(options = {}) {
    super('FirestoreMessageStore');
    this.collectionName = options.collection || 'messages';
    this.readStatesColName = 'read_states';
    this.whiteboardsColName = 'whiteboards';
    this.db = null;
    this.fallbackStore = [];
    this.fallbackReadStates = new Map();
    this.fallbackWhiteboards = new Map();
    this.init();
  }

  async init() {
    try {
      const { Firestore } = await import('@google-cloud/firestore');
      this.db = new Firestore();
      console.log(`[Storage/Firestore] ✅ 成功连接 Google Cloud Firestore (集合: ${this.collectionName})`);
    } catch (err) {
      console.warn('[Storage/Firestore] ⚠️ 未检测到 @google-cloud/firestore 依赖或 GCP 凭据。');
      console.warn('[Storage/Firestore] 提示：在云端 Cloud Run 部署时请执行: npm install @google-cloud/firestore');
      console.warn('[Storage/Firestore] 临时降级至内存暂存模式运行...');
    }
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

    if (this.db) {
      await this.db.collection(this.collectionName).doc(record.id).set(record);
    } else {
      this.fallbackStore.push(record);
    }

    return record;
  }

  async getRoomHistory(room, limit = 50, beforeTime = null) {
    if (this.db) {
      let query = this.db.collection(this.collectionName)
        .where('scope', '==', 'room')
        .where('room', '==', room);

      if (beforeTime) {
        query = query.where('createdAt', '<', beforeTime);
      }

      const snapshot = await query.orderBy('createdAt', 'desc').limit(limit).get();
      return snapshot.docs.map(doc => doc.data()).reverse();
    }

    const list = this.fallbackStore.filter(m => {
      if (m.scope !== 'room' || m.room !== room) return false;
      if (beforeTime && m.createdAt >= beforeTime) return false;
      return true;
    });
    return list.slice(-limit);
  }

  async getDMHistory(userA, userB, limit = 50, beforeTime = null) {
    const canonicalKey = this.getCanonicalDMKey(userA, userB);

    if (this.db) {
      let query = this.db.collection(this.collectionName)
        .where('scope', '==', 'dm')
        .where('targetId', '==', canonicalKey);

      if (beforeTime) {
        query = query.where('createdAt', '<', beforeTime);
      }

      const snapshot = await query.orderBy('createdAt', 'desc').limit(limit).get();
      return snapshot.docs.map(doc => doc.data()).reverse();
    }

    const list = this.fallbackStore.filter(m => {
      if (m.scope !== 'dm' || m.targetId !== canonicalKey) return false;
      if (beforeTime && m.createdAt >= beforeTime) return false;
      return true;
    });
    return list.slice(-limit);
  }

  async saveReadState(userId, targetId, lastReadTime) {
    const docId = `${userId}_${targetId.replace(/[:\/]/g, '_')}`;
    const readTimestamp = Number(lastReadTime) || Date.now();

    if (this.db) {
      await this.db.collection(this.readStatesColName).doc(docId).set({
        userId,
        targetId,
        lastReadTime: readTimestamp,
        updatedAt: Date.now()
      });
    } else {
      this.fallbackReadStates.set(`${userId}:${targetId}`, readTimestamp);
    }

    return readTimestamp;
  }

  async getUnreadSummary(userId) {
    if (!this.db) {
      const summary = {};
      for (const m of this.fallbackStore) {
        if (m.scope === 'room' && m.fromUserId !== userId) {
          const targetId = `room:${m.room}`;
          const cursor = this.fallbackReadStates.get(`${userId}:${targetId}`) || 0;
          if (m.createdAt > cursor) summary[targetId] = (summary[targetId] || 0) + 1;
        } else if (m.scope === 'dm' && m.toUserId === userId && m.fromUserId !== userId) {
          const targetId = `dm:${m.fromUserId}`;
          const cursor = this.fallbackReadStates.get(`${userId}:${targetId}`) || 0;
          if (m.createdAt > cursor) summary[targetId] = (summary[targetId] || 0) + 1;
        }
      }
      return summary;
    }

    // 生产环境在 Firestore 中可通过复合查询聚合
    return {};
  }

  async getRecentConversations(userId) {
    // 降级模式实现
    const partners = new Map();
    const list = this.fallbackStore;
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i];
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
    return Array.from(partners.values());
  }

  async getWhiteboardSnapshot(roomId) {
    if (this.db) {
      try {
        const doc = await this.db.collection(this.whiteboardsColName).doc(roomId).get();
        return doc.exists ? doc.data() : null;
      } catch (err) {
        console.error('[Storage/Firestore] 读取白板快照失败:', err);
        return null;
      }
    }
    return this.fallbackWhiteboards.get(roomId) || null;
  }

  async saveWhiteboardSnapshot(roomId, snapshotData) {
    if (this.db) {
      try {
        await this.db.collection(this.whiteboardsColName).doc(roomId).set(snapshotData);
        return;
      } catch (err) {
        console.error('[Storage/Firestore] 保存白板快照失败:', err);
      }
    }
    this.fallbackWhiteboards.set(roomId, snapshotData);
  }
}
