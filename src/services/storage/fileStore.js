import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BaseMessageStore } from './base.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../../data');
const DATA_FILE = path.join(DATA_DIR, 'messages.json');

/**
 * 本地文件存储驱动 (开发环境默认)
 */
export class FileMessageStore extends BaseMessageStore {
  constructor() {
    super('FileMessageStore');
    this.messages = [];
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        this.messages = JSON.parse(raw || '[]');
        console.log(`[Storage/File] 已从本地文件加载历史消息 ${this.messages.length} 条`);
      } else {
        this.flush();
      }
    } catch (err) {
      console.error('[Storage/File] 读取数据文件失败:', err);
      this.messages = [];
    }
  }

  flush() {
    try {
      if (this.messages.length > 2000) {
        this.messages = this.messages.slice(-2000);
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.messages, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Storage/File] 写入数据文件失败:', err);
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
    this.flush();
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
