import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const targetArg = (process.argv[2] || '').toLowerCase();

const ENV_MAP = {
  dev: 'development',
  development: 'development',
  prod: 'production',
  production: 'production',
  test: 'test'
};

const targetEnv = ENV_MAP[targetArg];

if (!targetEnv) {
  console.log(`
\x1b[33m使用方式:\x1b[0m node scripts/switch-env.js <环境名>

\x1b[36m支持的环境选项:\x1b[0m
  - \x1b[32mdev\x1b[0m        (切换至开发环境: 本地文件存储, 详细日志, 端口 8080)
  - \x1b[32mprod\x1b[0m       (切换至生产环境: GCP Firestore 存储, 规范化日志)
  - \x1b[32mtest\x1b[0m       (切换至测试环境: 纯内存驱动, 端口 8081)

\x1b[90m示例: npm run env:prod\x1b[0m
  `);
  process.exit(1);
}

const sourceFile = path.join(ROOT_DIR, `.env.${targetEnv}`);
const destFile = path.join(ROOT_DIR, '.env');

if (!fs.existsSync(sourceFile)) {
  console.error(`\x1b[31m[错误] 配置文件不存在: .env.${targetEnv}\x1b[0m`);
  process.exit(1);
}

// 拷贝文件至当前激活 .env
fs.copyFileSync(sourceFile, destFile);

console.log('='.repeat(48));
console.log(`\x1b[32m✔ 成功一键切换至 [${targetEnv.toUpperCase()}] 环境！\x1b[0m`);
console.log(`📄 已同步文件: .env.${targetEnv} -> .env`);
console.log('='.repeat(48));
