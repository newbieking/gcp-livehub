/**
 * 多环境配置加载与解析模块
 * 支持读取 process.env，具备严格的默认值兜底与环境类型判断
 */

const envName = (process.env.APP_ENV || process.env.NODE_ENV || 'development').toLowerCase();

function parseCorsOrigins(raw) {
  if (!raw || raw.trim() === '*') return '*';
  const list = raw.split(',').map(s => s.trim()).filter(Boolean);
  return list.length === 1 ? list[0] : list;
}

export const config = {
  env: envName,
  isDev: envName === 'development' || envName === 'dev',
  isProd: envName === 'production' || envName === 'prod',
  isTest: envName === 'test',

  // 服务网络
  port: parseInt(process.env.PORT || '8080', 10),

  // 持久化存储驱动开关: 'file' | 'memory' | 'firestore'
  storage: {
    driver: (process.env.STORAGE_DRIVER || 'file').toLowerCase(),
    firestore: {
      collection: process.env.FIRESTORE_COLLECTION || 'messages'
    }
  },

  // 跨域策略
  cors: {
    origin: parseCorsOrigins(process.env.CORS_ORIGIN),
    methods: ['GET', 'POST']
  },

  // 日志输出级别
  logging: {
    level: (process.env.LOG_LEVEL || (envName === 'production' ? 'info' : 'debug')).toLowerCase()
  },

  // Socket.IO 长连接与心跳策略
  socket: {
    pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT || '60000', 10),
    pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL || '25000', 10),
    transports: ['websocket', 'polling']
  }
};

/**
 * 输出格式化环境概览 (便于服务启动时排查配置是否正确生效)
 */
export function printConfigSummary() {
  console.log('='.repeat(52));
  console.log(`🌍 当前运行环境: \x1b[36m${config.env.toUpperCase()}\x1b[0m`);
  console.log(`🔌 监听端口:     \x1b[33m${config.port}\x1b[0m`);
  console.log(`💾 存储驱动:     \x1b[32m${config.storage.driver.toUpperCase()}\x1b[0m`);
  console.log(`🌐 跨域策略:     ${JSON.stringify(config.cors.origin)}`);
  console.log(`📋 日志级别:     ${config.logging.level}`);
  console.log('='.repeat(52));
}
