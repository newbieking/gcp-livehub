/**
 * 游戏生命周期抽象基类 (BaseGame)
 * 所有在线实时交互小游戏插件都必须继承此类
 */
export class BaseGame {
  /**
   * @param {Object} metadata 游戏元数据
   * @param {string} metadata.id 唯一游戏ID (如 'gomoku', 'rps')
   * @param {string} metadata.name 游戏名称
   * @param {string} metadata.description 游戏简述
   * @param {number} metadata.minPlayers 满足开始对战的最低人数
   * @param {number} metadata.maxPlayers 桌台允许的最大人数
   * @param {string} metadata.icon 游戏图标 Emoji
   */
  constructor(metadata) {
    if (!metadata.id || !metadata.name) {
      throw new Error('Game must have id and name');
    }
    this.metadata = {
      minPlayers: 2,
      maxPlayers: 2,
      icon: '🎮',
      ...metadata
    };
  }

  /**
   * 1. 游戏初始化生命周期
   * 当房主点击「开始游戏」时由平台调用
   * @param {Array<{userId: string, username: string, seatIndex: number}>} players 参战玩家列表
   * @returns {Object} 初始游戏状态 (GameState)
   */
  onGameStart(players) {
    throw new Error('onGameStart must be implemented by subclass');
  }

  /**
   * 2. 处理玩家操作指令
   * @param {string} playerId 玩家ID
   * @param {Object} action 操作指令对象 (如 { type: 'PLACE_PIECE', x: 7, y: 7 })
   * @param {Object} currentState 当前对战状态
   * @returns {{
   *   valid: boolean,
   *   error?: string,
   *   nextState?: Object,
   *   broadcastEvent?: string,
   *   broadcastPayload?: any,
   *   gameOver?: { winnerId?: string, isDraw?: boolean, reason?: string }
   * }}
   */
  onPlayerAction(playerId, action, currentState) {
    throw new Error('onPlayerAction must be implemented by subclass');
  }

  /**
   * 3. 玩家中途离线/退出处理
   * @param {string} playerId 离线玩家ID
   * @param {Object} currentState 当前对战状态
   * @returns {{ nextState: Object, gameOver?: Object }}
   */
  onPlayerLeave(playerId, currentState) {
    return {
      nextState: currentState,
      gameOver: {
        winnerId: null,
        reason: `玩家 ${playerId} 离开了对战`
      }
    };
  }
}
