import { sessionStore } from '../services/sessionStore.js';
import { tableStore } from '../services/tableStore.js';
import { gameRegistry } from '../games/registry.js';

/**
 * 实时对战大厅与桌台网络信令处理器
 */
export function registerTableHandlers(io, socket) {
  // 1. 获取所有上架游戏元信息
  socket.on('table:get_games', (callback) => {
    const games = gameRegistry.getAllMetadatas();
    if (typeof callback === 'function') {
      callback({ success: true, games });
    } else {
      socket.emit('table:games_list', { games });
    }
  });

  // 2. 获取当前大厅的所有桌台列表
  socket.on('table:get_list', (callback) => {
    const tables = tableStore.getAllTables();
    if (typeof callback === 'function') {
      callback({ success: true, tables });
    } else {
      socket.emit('table:list_response', { tables });
    }
  });

  // 3. 创建桌台
  socket.on('table:create', ({ gameId, tableName }, callback) => {
    const session = sessionStore.getSession(socket.id);
    if (!session) {
      if (typeof callback === 'function') callback({ success: false, error: '用户未登录或会话未就绪' });
      return;
    }

    try {
      const table = tableStore.createTable({
        gameId,
        tableName: (tableName || '').trim().slice(0, 24),
        hostUser: { userId: session.userId, username: session.username }
      });

      // 将该 socket 加入桌台专用频道
      socket.join(`table:${table.tableId}`);

      // 响应创建者
      if (typeof callback === 'function') {
        callback({ success: true, table });
      }
      socket.emit('table:joined', { table, mySeatIndex: 0 });

      // 全局广播大厅桌台列表变动
      io.emit('table:list_updated', { tables: tableStore.getAllTables() });
    } catch (err) {
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      } else {
        socket.emit('table:error', { error: err.message });
      }
    }
  });

  // 4. 加入桌台
  socket.on('table:join', ({ tableId, seatIndex = -1 }, callback) => {
    const session = sessionStore.getSession(socket.id);
    if (!session) {
      if (typeof callback === 'function') callback({ success: false, error: '用户未登录或会话未就绪' });
      return;
    }

    try {
      const { table, seatIndex: assignedSeat } = tableStore.joinTable(
        tableId,
        { userId: session.userId, username: session.username },
        seatIndex
      );

      socket.join(`table:${table.tableId}`);

      if (typeof callback === 'function') {
        callback({ success: true, table, mySeatIndex: assignedSeat });
      }

      // 给当前玩家发送已入桌通知
      socket.emit('table:joined', { table, mySeatIndex: assignedSeat });

      // 给桌台内所有成员广播座位更新
      io.to(`table:${table.tableId}`).emit('table:updated', { table });

      // 全局广播大厅列表人数变动
      io.emit('table:list_updated', { tables: tableStore.getAllTables() });
    } catch (err) {
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      } else {
        socket.emit('table:error', { error: err.message });
      }
    }
  });

  // 5. 切换准备状态
  socket.on('table:ready', ({ tableId }, callback) => {
    const session = sessionStore.getSession(socket.id);
    if (!session) {
      if (typeof callback === 'function') callback({ success: false, error: '用户会话未就绪' });
      return;
    }

    try {
      const table = tableStore.toggleReady(tableId, session.userId);
      const startCheck = tableStore.canStartGame(table);

      if (typeof callback === 'function') {
        callback({ success: true, table, canStart: startCheck.canStart });
      }

      io.to(`table:${table.tableId}`).emit('table:updated', {
        table,
        canStart: startCheck.canStart,
        canStartReason: startCheck.reason
      });
    } catch (err) {
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  // 6. 房主开启游戏
  socket.on('table:start', ({ tableId }, callback) => {
    const session = sessionStore.getSession(socket.id);
    if (!session) {
      if (typeof callback === 'function') callback({ success: false, error: '用户会话未就绪' });
      return;
    }

    try {
      const { table, gameState } = tableStore.startGame(tableId, session.userId);

      if (typeof callback === 'function') {
        callback({ success: true, table, gameState });
      }

      // 桌台全员广播对战开启与初始状态
      io.to(`table:${table.tableId}`).emit('game:started', {
        table,
        gameState
      });

      // 大厅同步桌台状态变为“游戏中”
      io.emit('table:list_updated', { tables: tableStore.getAllTables() });
    } catch (err) {
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      } else {
        socket.emit('table:error', { error: err.message });
      }
    }
  });

  // 7. 游戏对战操作指令透传
  socket.on('game:action', ({ tableId, action }, callback) => {
    const session = sessionStore.getSession(socket.id);
    if (!session) {
      if (typeof callback === 'function') callback({ success: false, error: '用户会话未就绪' });
      return;
    }

    try {
      const result = tableStore.handlePlayerAction(tableId, session.userId, action);

      if (!result.valid) {
        if (typeof callback === 'function') {
          callback({ success: false, error: result.error });
        } else {
          socket.emit('table:error', { error: result.error });
        }
        return;
      }

      if (typeof callback === 'function') {
        callback({ success: true });
      }

      // 广播操作结果
      io.to(`table:${tableId}`).emit('game:state_sync', {
        table: result.table,
        gameState: result.nextState,
        actionEvent: result.broadcastEvent,
        actionPayload: result.broadcastPayload
      });

      // 如果产生胜负或平局
      if (result.gameOver) {
        io.to(`table:${tableId}`).emit('game:over', {
          table: result.table,
          gameOver: result.gameOver
        });
        // 大厅列表同步回 WAITING
        io.emit('table:list_updated', { tables: tableStore.getAllTables() });
      }
    } catch (err) {
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  // 8. 离开桌台
  socket.on('table:leave', ({ tableId }, callback) => {
    const session = sessionStore.getSession(socket.id);
    if (!session) return;

    handleUserLeaveTable(io, socket, tableId, session.userId);
    if (typeof callback === 'function') {
      callback({ success: true });
    }
  });

  // 断线清理
  socket.on('disconnecting', () => {
    const session = sessionStore.getSession(socket.id);
    if (!session) return;

    const userTable = tableStore.getUserTable(session.userId);
    if (userTable) {
      handleUserLeaveTable(io, socket, userTable.tableId, session.userId);
    }
  });
}

function handleUserLeaveTable(io, socket, tableId, userId) {
  const result = tableStore.leaveTable(tableId, userId);
  if (!result) return;

  socket.leave(`table:${tableId}`);
  socket.emit('table:left', { tableId });

  if (result.destroyed) {
    // 桌台解散
    io.emit('table:list_updated', { tables: tableStore.getAllTables() });
  } else {
    // 广播桌台成员变动
    io.to(`table:${tableId}`).emit('table:updated', { table: result.table });
    if (result.gameOver) {
      io.to(`table:${tableId}`).emit('game:over', {
        table: result.table,
        gameOver: result.gameOver
      });
    }
    io.emit('table:list_updated', { tables: tableStore.getAllTables() });
  }
}
