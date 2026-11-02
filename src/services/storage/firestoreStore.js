import { BaseMessageStore } from './base.js';

/**
 * Google Cloud Firestore 生产级存储驱动
 * 自动适配 Cloud Run ADC 鉴权 (无须本地密钥文件)
 */
export class FirestoreMessageStore extends BaseMessageStore {
  constructor(options = {}) {
    super('FirestoreMessageStore');
    this.collectionName = options.collection || 'messages';
    this.db = null;
    this.init();
  }

  async init() {
    try {
      // 动态载入官方客户端
      const { Firestore } = await import('@google-cloud/firestore');
      this.db = new Firestore();
      console.log(`[Storage/Firestore] ✅ 成功连接 Google Cloud Firestore (集合: ${this.collectionName})`);
    } catch (err) {
      console.warn('[Storage/Firestore] ⚠️ 未检测到 @google-cloud/firestore 依赖或 GCP 凭据。');
      console.warn('[Storage/Firestore] 提示：在云端 Cloud Run 部署时请执行: npm install @google-cloud/firestore');
      console.warn('[Storage/Firestore] 临时降级至内存暂存模式运行...');
      this.fallbackStore = [];
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

    // 兜底降级处理
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
}
