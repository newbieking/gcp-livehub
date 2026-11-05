import { BaseGame } from '../baseGame.js';

/**
 * 经典五子棋 (Gomoku) 实时对战插件
 * 规格：15x15 棋盘，黑子先手 (1: 黑子, 2: 白子)
 */
export class GomokuGame extends BaseGame {
  constructor() {
    super({
      id: 'gomoku',
      name: '五子棋 (Gomoku)',
      description: '经典双人轮流落子，横竖斜率先连成五子者获胜',
      minPlayers: 2,
      maxPlayers: 2,
      iconKey: 'gomoku',
      icon: ''
    });
    this.BOARD_SIZE = 15;
  }

  onGameStart(players) {
    // 随机或按座位顺序分配黑白棋：Seat 0 黑子先手，Seat 1 白子后手
    const playerRoles = {};
    playerRoles[players[0].userId] = { role: 1, roleName: '黑子', username: players[0].username };
    playerRoles[players[1].userId] = { role: 2, roleName: '白子', username: players[1].username };

    // 初始化 15x15 空棋盘 (0: 空, 1: 黑, 2: 白)
    const board = Array(this.BOARD_SIZE).fill(0).map(() => Array(this.BOARD_SIZE).fill(0));

    return {
      gameId: this.metadata.id,
      board,
      playerRoles,
      currentTurnPlayerId: players[0].userId, // 黑子先行
      currentTurnRole: 1,
      moveHistory: [],
      winnerId: null,
      isFinished: false
    };
  }

  onPlayerAction(playerId, action, currentState) {
    if (currentState.isFinished) {
      return { valid: false, error: '对战已结束' };
    }

    if (action.type !== 'PLACE_PIECE') {
      return { valid: false, error: '未知操作指令' };
    }

    // 校验是否轮到该玩家
    if (currentState.currentTurnPlayerId !== playerId) {
      return { valid: false, error: '尚未轮到您的回合' };
    }

    const { x, y } = action;
    if (x < 0 || x >= this.BOARD_SIZE || y < 0 || y >= this.BOARD_SIZE) {
      return { valid: false, error: '落子坐标超出棋盘边界' };
    }

    if (currentState.board[y][x] !== 0) {
      return { valid: false, error: '该位置已有棋子' };
    }

    const role = currentState.playerRoles[playerId].role;
    // 拷贝并更新棋盘
    const nextBoard = currentState.board.map(row => [...row]);
    nextBoard[y][x] = role;

    const nextHistory = [
      ...currentState.moveHistory,
      { x, y, role, playerId, timestamp: Date.now() }
    ];

    // 检查是否获胜 (连成五子)
    const isWin = this.checkWin(nextBoard, x, y, role);
    let nextTurnPlayerId = null;
    let nextTurnRole = null;
    let gameOver = null;

    if (isWin) {
      gameOver = {
        winnerId: playerId,
        winnerName: currentState.playerRoles[playerId].username,
        roleName: currentState.playerRoles[playerId].roleName,
        reason: `${currentState.playerRoles[playerId].username} (${currentState.playerRoles[playerId].roleName}) 达成五子连珠，获得胜利！`
      };
    } else if (nextHistory.length >= this.BOARD_SIZE * this.BOARD_SIZE) {
      gameOver = {
        isDraw: true,
        reason: '棋盘已满，双方握手言和！'
      };
    } else {
      // 换手到另一位玩家
      const otherPlayerId = Object.keys(currentState.playerRoles).find(id => id !== playerId);
      nextTurnPlayerId = otherPlayerId;
      nextTurnRole = currentState.playerRoles[otherPlayerId].role;
    }

    const nextState = {
      ...currentState,
      board: nextBoard,
      moveHistory: nextHistory,
      currentTurnPlayerId: nextTurnPlayerId,
      currentTurnRole: nextTurnRole,
      isFinished: !!gameOver,
      winnerId: gameOver ? gameOver.winnerId : null
    };

    return {
      valid: true,
      nextState,
      broadcastEvent: 'game:piece_placed',
      broadcastPayload: { x, y, role, playerId, nextTurnPlayerId },
      gameOver
    };
  }

  checkWin(board, x, y, role) {
    const directions = [
      [1, 0],  // 水平
      [0, 1],  // 垂直
      [1, 1],  // 主对角线 \
      [1, -1]  // 副对角线 /
    ];

    for (const [dx, dy] of directions) {
      let count = 1;
      // 正向探测
      let nx = x + dx;
      let ny = y + dy;
      while (nx >= 0 && nx < this.BOARD_SIZE && ny >= 0 && ny < this.BOARD_SIZE && board[ny][nx] === role) {
        count++;
        nx += dx;
        ny += dy;
      }
      // 反向探测
      nx = x - dx;
      ny = y - dy;
      while (nx >= 0 && nx < this.BOARD_SIZE && ny >= 0 && ny < this.BOARD_SIZE && board[ny][nx] === role) {
        count++;
        nx -= dx;
        ny -= dy;
      }

      if (count >= 5) {
        return true;
      }
    }
    return false;
  }
}
