/**
 * 消息持久化仓储抽象基类 (Base Message Store)
 * 规范化公共频道与 1v1 私聊历史记录读写接口
 */
export class BaseMessageStore {
  constructor(driverName) {
    this.driverName = driverName;
  }

  /**
   * 规范化 1v1 私聊复合键: 按用户 ID 字典序排布
   */
  getCanonicalDMKey(userA, userB) {
    return [userA, userB].sort().join(':');
  }

  /**
   * 保存单条消息
   * @param {Object} msg 
   * @returns {Promise<Object>}
   */
  async saveMessage(msg) {
    throw new Error(`[${this.driverName}] saveMessage 方法未实现`);
  }

  /**
   * 拉取房间历史消息
   * @param {string} room 
   * @param {number} limit 
   * @param {number|null} beforeTime 
   * @returns {Promise<Array>}
   */
  async getRoomHistory(room, limit = 50, beforeTime = null) {
    throw new Error(`[${this.driverName}] getRoomHistory 方法未实现`);
  }

  /**
   * 拉取 1v1 私聊历史消息
   * @param {string} userA 
   * @param {string} userB 
   * @param {number} limit 
   * @param {number|null} beforeTime 
   * @returns {Promise<Array>}
   */
  async getDMHistory(userA, userB, limit = 50, beforeTime = null) {
    throw new Error(`[${this.driverName}] getDMHistory 方法未实现`);
  }

  /**
   * 保存用户在特定会话的水位线 (Read Cursor)
   * @param {string} userId
   * @param {string} targetId (e.g. 'room:大厅讨论区' 或 'dm:u_123:u_456')
   * @param {number} lastReadTime
   */
  async saveReadState(userId, targetId, lastReadTime) {
    throw new Error(`[${this.driverName}] saveReadState 方法未实现`);
  }

  /**
   * 计算指定用户所有会话的服务端权威未读计数
   * @param {string} userId
   * @returns {Promise<Object>} e.g. { 'room:大厅讨论区': 0, 'dm:u_456': 2 }
   */
  async getUnreadSummary(userId) {
    throw new Error(`[${this.driverName}] getUnreadSummary 方法未实现`);
  }

  /**
   * 获取指定用户的最近私聊联系人列表（服务端权威聚合）
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  async getRecentConversations(userId) {
    throw new Error(`[${this.driverName}] getRecentConversations 方法未实现`);
  }
}
