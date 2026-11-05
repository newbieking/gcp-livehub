import { BaseGame } from '../baseGame.js';

/**
 * 骰子大乱斗 (Dice Battle)
 * 支持 2 ~ 4 人动态人数在线对战
 * 规则：每位玩家掷 3 枚骰子，点数之和最大者获胜。支持 2 人、3 人或 4 人开局。
 */
export class DiceBattleGame extends BaseGame {
  constructor() {
    super({
      id: 'dice_battle',
      name: '骰子大决战 (Dice Battle)',
      description: '动态 2~4 人对战！每人掷骰比拼点数总和与幸运组合',
      minPlayers: 2,
      maxPlayers: 4,
      iconKey: 'dice',
      icon: ''
    });
  }

  onGameStart(players) {
    const playerStates = {};
    players.forEach((p, idx) => {
      playerStates[p.userId] = {
        userId: p.userId,
        username: p.username,
        seatIndex: p.seatIndex,
        dices: [],
        totalScore: 0,
        hasRolled: false
      };
    });

    return {
      gameId: this.metadata.id,
      playerStates,
      playersList: players.map(p => p.userId),
      isFinished: false,
      winnerId: null
    };
  }

  onPlayerAction(playerId, action, currentState) {
    if (currentState.isFinished) {
      return { valid: false, error: '对战已结束' };
    }

    if (action.type !== 'ROLL_DICE') {
      return { valid: false, error: '未知操作指令' };
    }

    const player = currentState.playerStates[playerId];
    if (!player) {
      return { valid: false, error: '您不是对战玩家' };
    }

    if (player.hasRolled) {
      return { valid: false, error: '您本轮已经掷过骰子了' };
    }

    // 生成 3 枚随机骰子 (1~6)
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const d3 = Math.floor(Math.random() * 6) + 1;
    const totalScore = d1 + d2 + d3;

    const nextPlayerStates = {
      ...currentState.playerStates,
      [playerId]: {
        ...player,
        dices: [d1, d2, d3],
        totalScore,
        hasRolled: true
      }
    };

    // 检查是否所有在局玩家均已掷骰
    const allRolled = Object.values(nextPlayerStates).every(p => p.hasRolled);
    let gameOver = null;

    if (allRolled) {
      // 评选最高分
      let maxScore = -1;
      let winner = null;
      let isDraw = false;

      Object.values(nextPlayerStates).forEach(p => {
        if (p.totalScore > maxScore) {
          maxScore = p.totalScore;
          winner = p;
          isDraw = false;
        } else if (p.totalScore === maxScore) {
          isDraw = true;
        }
      });

      if (isDraw) {
        gameOver = {
          isDraw: true,
          reason: `双方掷出相同最高点数 ${maxScore} 点，平局！`
        };
      } else {
        gameOver = {
          winnerId: winner.userId,
          winnerName: winner.username,
          score: maxScore,
          reason: `玩家 ${winner.username} 以 ${maxScore} 点 (${winner.dices.join('+')}) 赢得全场冠军！`
        };
      }
    }

    const nextState = {
      ...currentState,
      playerStates: nextPlayerStates,
      isFinished: !!gameOver,
      winnerId: gameOver ? gameOver.winnerId : null
    };

    return {
      valid: true,
      nextState,
      broadcastEvent: 'game:dice_rolled',
      broadcastPayload: { playerId, dices: [d1, d2, d3], totalScore },
      gameOver
    };
  }
}
