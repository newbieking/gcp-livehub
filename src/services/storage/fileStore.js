import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BaseMessageStore } from './base.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../../data');
const DATA_FILE = path.join(DATA_DIR, 'messages.json');
const READ_STATES_FILE = path.join(DATA_DIR, 'read_states.json');

/**
 * 本地文件存储驱动 (开发环境默认)
 * 包含消息持久化与服务端权威已读水位线持久化
 */
export class FileMessageStore extends BaseMessageStore {
  constructor() {
    super('FileMessageStore');
    this.messages = [];
    this.readStates = new Map(); // `${userId}:${targetId}` -> { userId, targetId, lastReadTime, updatedAt }
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      // 载入历史消息
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        this.messages = JSON.parse(raw || '[]');
        console.log(`[Storage/File] 已从本地文件加载历史消息 ${this.messages.length} 条`);
      } else {
        this.flushMessages();
      }

      // 载入已读水位线状态
      if (fs.existsSync(READ_STATES_FILE)) {
        const rawStates = fs.readFileSync(READ_STATES_FILE, 'utf-8');
        const stateObj = JSON.parse(rawStates || '{}');
        this.readStates = new Map(Object.entries(stateObj));
        console.log(`[Storage/File] 已从本地文件加载已读水位线 ${this.readStates.size} 条记录`);
      } else {
        this.flushReadStates();
      }
    } catch (err) {
      console.error('[Storage/File] 读取数据文件失败:', err);
      this.messages = [];
      this.readStates = new Map();
    }
  }

  flushMessages() {
    try {
      if (this.messages.length > 2000) {
        this.messages = this.messages.slice(-2000);
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.messages, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Storage/File] 写入消息数据失败:', err);
    }
  }

  flushReadStates() {
    try {
      const obj = Object.fromEntries(this.readStates);
      fs.writeFileSync(READ_STATES_FILE, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Storage/File] 写入已读水位线失败:', err);
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

    this.messages.push(record);
    this.flushMessages();
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

  /**
   * 服务端记录用户的已读时间戳 (High-Water Mark)
   */
  async saveReadState(userId, targetId, lastReadTime) {
    const key = `${userId}:${targetId}`;
    const readTimestamp = Number(lastReadTime) || Date.now();
    this.readStates.set(key, {
      userId,
      targetId,
      lastReadTime: readTimestamp,
      updatedAt: Date.now()
    });
    this.flushReadStates();
    return readTimestamp;
  }

  getReadStateTime(userId, targetId) {
    const key = `${userId}:${targetId}`;
    const record = this.readStates.get(key);
    return record ? record.lastReadTime : 0;
  }

  /**
   * 服务端权威计算用户的未读消息概览
   */
  async getUnreadSummary(userId) {
    const summary = {};

    for (const m of this.messages) {
      if (m.scope === 'room') {
        // 用户自己发的消息不计入未读
        if (m.fromUserId === userId) continue;
        const targetId = `room:${m.room}`;
        const cursor = this.getReadStateTime(userId, targetId);
        if (m.createdAt > cursor) {
          summary[targetId] = (summary[targetId] || 0) + 1;
        }
      } else if (m.scope === 'dm') {
        // 仅他人发送给当前用户的私聊计入未读
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

  /**
   * 服务端权威聚合用户的最近联系人列表（不论对方当前是否在线）
   */
  async getRecentConversations(userId) {
    const partners = new Map(); // partnerId -> { userId, username, lastMessage, lastActive }

    // 倒序遍历消息获取最新会话伙伴与最新一条消息
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
