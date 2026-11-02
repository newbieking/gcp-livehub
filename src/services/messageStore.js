import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据存放目录
const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'messages.json');

/**
 * 消息持久化服务 (Message Store Repository)
 * 具备本地持久化与游标翻页支持，接口定义可无缝适配 Cloud Firestore
 */
class MessageStore {
  constructor() {
    this.messages = [];
    this.isLoaded = false;
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
        console.log(`[持久化] 已加载历史消息 ${this.messages.length} 条`);
      } else {
        this.saveToFile();
      }
    } catch (err) {
      console.error('[持久化] 初始化读取存储失败:', err);
      this.messages = [];
    }
    this.isLoaded = true;
  }

  saveToFile() {
    try {
      // 保持最近 2000 条活跃记录，防止单文件过度膨胀
      if (this.messages.length > 2000) {
        this.messages = this.messages.slice(-2000);
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.messages, null, 2), 'utf-8');
    } catch (err) {
      console.error('[持久化] 写入文件失败:', err);
    }
  }

  /**
   * 规范化 1v1 私聊会话标识：按照用户 ID 字典序排布
   */
  getCanonicalDMKey(userA, userB) {
    return [userA, userB].sort().join(':');
  }

  /**
   * 持久化一条消息
   */
  async saveMessage(msg) {
    const record = {
      id: msg.id || `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      scope: msg.scope, // 'room' | 'dm'
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
    this.saveToFile();
    return record;
  }

  /**
   * 拉取房间历史消息（按时间倒序截取，正序输出）
   */
  async getRoomHistory(room, limit = 50, beforeTime = null) {
    const list = this.messages.filter(m => {
      if (m.scope !== 'room' || m.room !== room) return false;
      if (beforeTime && m.createdAt >= beforeTime) return false;
      return true;
    });

    // 截取最近的 N 条并保证按时间升序返回给前端渲染
    const sliced = list.slice(-limit);
    return sliced;
  }

  /**
   * 拉取两名用户之间的 1v1 私聊历史
   */
  async getDMHistory(userA, userB, limit = 50, beforeTime = null) {
    const canonicalKey = this.getCanonicalDMKey(userA, userB);
    const list = this.messages.filter(m => {
      if (m.scope !== 'dm' || m.targetId !== canonicalKey) return false;
      if (beforeTime && m.createdAt >= beforeTime) return false;
      return true;
    });

    const sliced = list.slice(-limit);
    return sliced;
  }
}

export const messageStore = new MessageStore();
