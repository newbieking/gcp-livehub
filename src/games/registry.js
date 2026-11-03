import { GomokuGame } from './plugins/gomoku.js';
import { DiceBattleGame } from './plugins/diceBattle.js';

/**
 * 游戏注册中心 (Game Registry)
 * 统一管理所有上架的在线实时小游戏插件
 */
class GameRegistry {
  constructor() {
    this.games = new Map();
    // 注册内置游戏
    this.register(new GomokuGame());
    this.register(new DiceBattleGame());
  }

  register(gameInstance) {
    if (!gameInstance.metadata || !gameInstance.metadata.id) {
      throw new Error('Invalid game instance: missing metadata.id');
    }
    this.games.set(gameInstance.metadata.id, gameInstance);
  }

  get(gameId) {
    return this.games.get(gameId);
  }

  getAllMetadatas() {
    return Array.from(this.games.values()).map(g => g.metadata);
  }
}

export const gameRegistry = new GameRegistry();
