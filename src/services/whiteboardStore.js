import { messageStore } from './storage/index.js';

/**
 * 白板协同状态与持久化快照管理器 (Whiteboard State & Snapshot Manager)
 * 采用内存热态加速 + 3秒防抖自动异步落盘架构
 */
export class WhiteboardStore {
  constructor() {
    // 房间白板内存缓存: roomId -> { roomId, elements: [], elementsMap: Map, version: number, dirty: boolean, timer: null, loaded: boolean }
    this.rooms = new Map();
  }

  /**
   * 获取或初始化房间白板状态
   */
  async getOrInitRoom(roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        roomId,
        elements: [],
        elementsMap: new Map(),
        version: 0,
        dirty: false,
        timer: null,
        loaded: false
      });
    }

    const roomState = this.rooms.get(roomId);
    if (!roomState.loaded) {
      try {
        const snapshot = await messageStore.getWhiteboardSnapshot(roomId);
        if (snapshot && Array.isArray(snapshot.elements)) {
          roomState.elements = snapshot.elements;
          roomState.elements.forEach(el => {
            roomState.elementsMap.set(el.id, el);
          });
          roomState.version = snapshot.version || roomState.elements.length;
          console.log(`[WhiteboardStore] 成功恢复房间 [${roomId}] 快照，包含图元 ${roomState.elements.length} 个`);
        }
      } catch (err) {
        console.error(`[WhiteboardStore] 读取房间 [${roomId}] 快照失败:`, err);
      }
      roomState.loaded = true;
    }

    return roomState;
  }

  /**
   * 拉取房间白板全量快照
   */
  async getSnapshot(roomId) {
    const roomState = await this.getOrInitRoom(roomId);
    // 过滤出未被删除的图元
    const activeElements = roomState.elements.filter(el => !el.isDeleted);
    return {
      roomId,
      version: roomState.version,
      elements: activeElements,
      totalCount: activeElements.length
    };
  }

  /**
   * 添加新图元
   */
  async addElement(roomId, element) {
    const roomState = await this.getOrInitRoom(roomId);
    const validElement = {
      id: element.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: element.type || 'path',
      ownerId: element.ownerId || 'anonymous',
      ownerName: element.ownerName || '协作者',
      color: element.color || '#3b82f6',
      strokeWidth: Number(element.strokeWidth) || 3,
      points: Array.isArray(element.points) ? element.points : [],
      x: element.x !== undefined ? Math.round(element.x) : undefined,
      y: element.y !== undefined ? Math.round(element.y) : undefined,
      width: element.width !== undefined ? Math.round(element.width) : undefined,
      height: element.height !== undefined ? Math.round(element.height) : undefined,
      text: element.text || '',
      zIndex: element.zIndex || roomState.elements.length + 1,
      createdAt: element.createdAt || Date.now(),
      isDeleted: false
    };

    roomState.elements.push(validElement);
    roomState.elementsMap.set(validElement.id, validElement);
    roomState.version += 1;
    roomState.dirty = true;

    this.scheduleFlush(roomId);
    return validElement;
  }

  /**
   * 撤销图元 (优先撤销指定ID，否则撤销指定用户最近绘制的一条图元)
   */
  async undoElement(roomId, elementId, userId) {
    const roomState = await this.getOrInitRoom(roomId);
    let target = null;

    if (elementId && roomState.elementsMap.has(elementId)) {
      target = roomState.elementsMap.get(elementId);
    } else if (userId) {
      // 倒序寻找该用户最近未被删除的图元
      for (let i = roomState.elements.length - 1; i >= 0; i--) {
        const el = roomState.elements[i];
        if (el.ownerId === userId && !el.isDeleted) {
          target = el;
          break;
        }
      }
    }

    if (target) {
      target.isDeleted = true;
      roomState.version += 1;
      roomState.dirty = true;
      this.scheduleFlush(roomId);
      return target;
    }

    return null;
  }

  /**
   * 清空白板所有图元
   */
  async clearBoard(roomId, userId) {
    const roomState = await this.getOrInitRoom(roomId);
    roomState.elements.forEach(el => {
      el.isDeleted = true;
    });
    roomState.version += 1;
    roomState.dirty = true;
    this.scheduleFlush(roomId);
    return { roomId, clearedBy: userId, version: roomState.version };
  }

  /**
   * 3秒防抖落盘机制 (Debounced Snapshot Flush)
   * 保护 GCP 免费层配额，避免频繁写盘 / Firestore 计费
   */
  scheduleFlush(roomId) {
    const roomState = this.rooms.get(roomId);
    if (!roomState) return;

    if (roomState.timer) {
      clearTimeout(roomState.timer);
    }

    roomState.timer = setTimeout(async () => {
      roomState.timer = null;
      if (!roomState.dirty) return;

      try {
        const activeElements = roomState.elements.filter(el => !el.isDeleted);
        // 如果图元超 1000 个，保留最近 1000 个
        const snapshotElements = activeElements.slice(-1000);
        await messageStore.saveWhiteboardSnapshot(roomId, {
          roomId,
          version: roomState.version,
          elements: snapshotElements,
          updatedAt: Date.now()
        });
        roomState.dirty = false;
        console.log(`[WhiteboardStore] 房间 [${roomId}] 快照已防抖持久化落盘 (图元数: ${snapshotElements.length})`);
      } catch (err) {
        console.error(`[WhiteboardStore] 持久化房间 [${roomId}] 快照失败:`, err);
      }
    }, 3000);
  }

  /**
   * 进程退出前同步刷新所有脏数据
   */
  async flushAll() {
    for (const [roomId, roomState] of this.rooms.entries()) {
      if (roomState.timer) {
        clearTimeout(roomState.timer);
        roomState.timer = null;
      }
      if (roomState.dirty) {
        const activeElements = roomState.elements.filter(el => !el.isDeleted).slice(-1000);
        await messageStore.saveWhiteboardSnapshot(roomId, {
          roomId,
          version: roomState.version,
          elements: activeElements,
          updatedAt: Date.now()
        });
        roomState.dirty = false;
      }
    }
  }
}

export const whiteboardStore = new WhiteboardStore();
