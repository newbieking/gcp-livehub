import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHealthRouter } from './routes/health.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(getSocketCount) {
  const app = express();

  // JSON 解析中间件
  app.use(express.json());

  // 挂载静态资源（前端 public 目录）
  const publicDir = path.resolve(__dirname, '../public');
  app.use(express.static(publicDir));

  // 挂载存活探针路由
  app.use('/', createHealthRouter(getSocketCount));

  return app;
}
