import http from 'http';
import { config, printConfigSummary } from './config/index.js';
import { createApp } from './app.js';
import { initSocketServer } from './sockets/index.js';

let ioInstance = null;

// 打印配置概览
printConfigSummary();

// 创建 Express 应用
const app = createApp(() => (ioInstance ? ioInstance.engine.clientsCount : 0));

// 创建 HTTP 服务
const server = http.createServer(app);

// 挂载 Socket.IO
ioInstance = initSocketServer(server);

// 启动监听
server.listen(config.port, () => {
  console.log(`🚀 实时交互服务已启动 [ESModule 架构]`);
  console.log(`📡 监听端口: ${config.port}`);
  console.log(`🔗 本地地址: http://localhost:${config.port}`);
  console.log(`🩺 健康探针: http://localhost:${config.port}/healthz`);
});

// 优雅停机信号处理（便于 Cloud Run 缩容平滑过渡）
const handleShutdown = (signal) => {
  console.log(`\n接收到 ${signal} 信号，准备平滑关闭服务...`);
  if (ioInstance) {
    ioInstance.close(() => {
      console.log('Socket.IO 服务已关闭所有连接');
      server.close(() => {
        console.log('HTTP 服务已终止');
        process.exit(0);
      });
    });
  } else {
    server.close(() => process.exit(0));
  }
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
