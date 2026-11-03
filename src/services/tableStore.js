import { gameRegistry } from '../games/registry.js';

/**
 * 实时对战大厅桌台存储管理器 (Table & Room Store)
 */
class TableStore {
  constructor() {
    // tableId -> TableData
    this.tables = new Map();
    // userId -> tableId 索引
    this.userTableMap = new Map();
    this.idCounter = 100;
  }

  /**
   * 创建新桌台
   */
  createTable({ gameId, tableName, hostUser }) {
    const game = gameRegistry.get(gameId);
    if (!game) {
      throw new Error(`未找到游戏类型: ${gameId}`);
    }

    // 如果用户已在某个桌台，先退出
    if (this.userTableMap.has(hostUser.userId)) {
      this.leaveTable(this.userTableMap.get(hostUser.userId), hostUser.userId);
    }

    const tableId = `T${++this.idCounter}`;
    const maxPlayers = game.metadata.maxPlayers;
    const minPlayers = game.metadata.minPlayers;

    // 初始化动态座位列表
    const seats = Array(maxPlayers).fill(null);
    // 房主自动坐进 Seat 0
    seats[0] = {
      seatIndex: 0,
      userId: hostUser.userId,
      username: hostUser.username,
      isHost: true,
      isReady: true // 房主默认就绪
    };

    const table = {
      tableId,
      tableName: tableName || `${hostUser.username} 的游戏桌`,
      gameId,
      gameMeta: game.metadata,
      minPlayers,
      maxPlayers,
      seats,
      hostUserId: hostUser.userId,
      status: 'WAITING', // WAITING | PLAYING
      gameState: null,
      createdAt: Date.now()
    };

    this.tables.set(tableId, table);
    this.userTableMap.set(hostUser.userId, tableId);

    return table;
  }

  getTable(tableId) {
    return this.tables.get(tableId);
  }

  getUserTable(userId) {
    const tableId = this.userTableMap.get(userId);
    return tableId ? this.tables.get(tableId) : null;
  }

  getAllTables() {
    return Array.from(this.tables.values()).map(table => {
      const seatedCount = table.seats.filter(s => s !== null).length;
      return {
        tableId: table.tableId,
        tableName: table.tableName,
        gameId: table.gameId,
        gameName: table.gameMeta.name,
        gameIcon: table.gameMeta.icon,
        minPlayers: table.minPlayers,
        maxPlayers: table.maxPlayers,
        seatedCount,
        status: table.status,
        hostUsername: table.seats.find(s => s?.isHost)?.username || '未知'
      };
    });
  }

  /**
   * 加入桌台并分配座位
   */
  joinTable(tableId, user, preferredSeatIndex = -1) {
    const table = this.tables.get(tableId);
    if (!table) throw new Error('桌台不存在');
    if (table.status === 'PLAYING') throw new Error('该桌台正在游戏中，无法加入');

    // 检查用户是否已在该桌台
    const existingSeat = table.seats.find(s => s?.userId === user.userId);
    if (existingSeat) return { table, seatIndex: existingSeat.seatIndex };

    // 如果在其他桌台，先退出
    if (this.userTableMap.has(user.userId)) {
      this.leaveTable(this.userTableMap.get(user.userId), user.userId);
    }

    let targetIndex = preferredSeatIndex;
    if (targetIndex < 0 || targetIndex >= table.maxPlayers || table.seats[targetIndex] !== null) {
      // 自动查找第一个空座位
      targetIndex = table.seats.findIndex(s => s === null);
    }

    if (targetIndex === -1) {
      throw new Error('该桌台已满座');
    }

    table.seats[targetIndex] = {
      seatIndex: targetIndex,
      userId: user.userId,
      username: user.username,
      isHost: false,
      isReady: false
    };

    this.userTableMap.set(user.userId, tableId);
    return { table, seatIndex: targetIndex };
  }

  /**
   * 离开桌台
   */
  leaveTable(tableId, userId) {
    const table = this.tables.get(tableId);
    if (!table) return null;

    const seatIndex = table.seats.findIndex(s => s?.userId === userId);
    if (seatIndex === -1) return null;

    const leavingSeat = table.seats[seatIndex];
    table.seats[seatIndex] = null;
    this.userTableMap.delete(userId);

    const remainingSeats = table.seats.filter(s => s !== null);

    // 如果无人，销毁桌台
    if (remainingSeats.length === 0) {
      this.tables.delete(tableId);
      return { destroyed: true, tableId };
    }

    // 如果房主离开，自动将房主移交给下一个就座玩家
    if (leavingSeat.isHost) {
      remainingSeats[0].isHost = true;
      remainingSeats[0].isReady = true;
      table.hostUserId = remainingSeats[0].userId;
    }

    // 如果处于对战中，通知游戏引擎玩家退出
    let gameOver = null;
    if (table.status === 'PLAYING') {
      const game = gameRegistry.get(table.gameId);
      if (game) {
        const leaveResult = game.onPlayerLeave(userId, table.gameState);
        table.gameState = leaveResult.nextState;
        gameOver = leaveResult.gameOver;
      }
      table.status = 'WAITING';
    }

    return { destroyed: false, table, gameOver };
  }

  /**
   * 切换玩家准备状态
   */
  toggleReady(tableId, userId) {
    const table = this.tables.get(tableId);
    if (!table) throw new Error('桌台不存在');
    if (table.status === 'PLAYING') throw new Error('游戏中不可更改准备状态');

    const seat = table.seats.find(s => s?.userId === userId);
    if (!seat) throw new Error('您不在该桌台上');
    if (seat.isHost) {
      // 房主默认始终就绪
      seat.isReady = true;
      return table;
    }

    seat.isReady = !seat.isReady;
    return table;
  }

  /**
   * 检查是否满足开启游戏条件
   */
  canStartGame(table) {
    const seatedPlayers = table.seats.filter(s => s !== null);
    if (seatedPlayers.length < table.minPlayers) {
      return { canStart: false, reason: `就坐人数不足，该游戏最少需要 ${table.minPlayers} 人` };
    }

    // 除房主外是否所有人均已准备
    const unreadyPlayers = seatedPlayers.filter(s => !s.isReady);
    if (unreadyPlayers.length > 0) {
      return { canStart: false, reason: `尚有玩家未准备: ${unreadyPlayers.map(p => p.username).join(', ')}` };
    }

    return { canStart: true, seatedPlayers };
  }

  /**
   * 房主启动游戏
   */
  startGame(tableId, userId) {
    const table = this.tables.get(tableId);
    if (!table) throw new Error('桌台不存在');
    if (table.hostUserId !== userId) throw new Error('仅房主可以开启游戏');
    if (table.status === 'PLAYING') throw new Error('游戏已经在进行中');

    const check = this.canStartGame(table);
    if (!check.canStart) {
      throw new Error(check.reason);
    }

    const game = gameRegistry.get(table.gameId);
    if (!game) throw new Error('游戏插件未找到');

    // 调用插件的 onGameStart
    table.gameState = game.onGameStart(check.seatedPlayers);
    table.status = 'PLAYING';

    return { table, gameState: table.gameState };
  }

  /**
   * 转发玩家对战指令
   */
  handlePlayerAction(tableId, userId, action) {
    const table = this.tables.get(tableId);
    if (!table) throw new Error('桌台不存在');
    if (table.status !== 'PLAYING') throw new Error('桌台未处于对战状态');

    const game = gameRegistry.get(table.gameId);
    if (!game) throw new Error('游戏未注册');

    const result = game.onPlayerAction(userId, action, table.gameState);
    if (!result.valid) {
      return result;
    }

    table.gameState = result.nextState;

    // 若判定游戏结束
    if (result.gameOver) {
      table.status = 'WAITING';
      // 重置除房主外的准备状态
      table.seats.forEach(s => {
        if (s && !s.isHost) s.isReady = false;
      });
    }

    return {
      ...result,
      table
    };
  }

  /**
   * 重置桌台并返回等待大厅
   */
  resetGame(tableId) {
    const table = this.tables.get(tableId);
    if (!table) return null;
    table.status = 'WAITING';
    table.gameState = null;
    table.seats.forEach(s => {
      if (s && !s.isHost) s.isReady = false;
    });
    return table;
  }
}

export const tableStore = new TableStore();
