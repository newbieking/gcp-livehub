# GCP LiveHub: Node.js + Socket.IO 实时双向交互应用

基于 **Node.js (ESM) + Socket.IO** 构建的高性能实时交互系统，专为 **Google Cloud Run (免费层额度优先)** 优化设计，具备完善的多环境配置切换与持久化扩展架构。

---

## 🌟 核心特性

- **多环境一键切换**：支持 `dev`、`prod`、`test` 多套独立环境，通过环境变量与配置开关一键平滑流转。
- **持久化驱动插拔**：通过 `STORAGE_DRIVER` 切换 `file`（本地文件）/ `firestore`（GCP 数据库）/ `memory`（纯内存）。
- **房间隔离与 1v1 私聊**：支持公共频道广播与好友点对点私信，消息历史自动持久化并支持倒序游标恢复。
- **未读消息红点气泡**：支持频道与好友列表未读消息计数气泡（`1` / `99+`）及浏览器标签页标题通知。
- **精准打字感知（Typing Indicator）**：1v1 私聊定向感知对方输入状态，消除公共房间噪音。
- **自动断线重连**：客户端指数避退自动重试（1~5秒），网络恢复自动无感重新入房。
- **存活探针与单容器省钱架构**：自带 `/healthz`，Cloud Run 限制单实例免除 Redis 开销。

---

## ⚙️ 多环境配置与一键切换

系统内置三套标准化环境：

| 环境 | 配置文件 | 存储驱动 (`STORAGE_DRIVER`) | 日志级别 | 典型场景 |
| :--- | :--- | :--- | :--- | :--- |
| **Development** | `.env.development` | `file` (自动写入 `./data/messages.json`) | `debug` | 本地开发调试 |
| **Production** | `.env.production` | `firestore` (Google Cloud 数据库) | `info` | 云端 Cloud Run 正式上线 |
| **Test** | `.env.test` | `memory` (纯内存，用完即弃) | `warn` | CI/CD 与单元测试 |

### 1. 一键切换当前激活环境
```bash
# 切换到开发环境
npm run env:dev

# 切换到生产环境
npm run env:prod

# 切换到测试环境
npm run env:test
```

### 2. 指定环境直接启动
```bash
# 开发环境（带热重载）
npm run dev

# 生产环境运行
npm run start:prod

# 纯内存测试运行
npm test
```

---

## 🚀 本地运行与体验

```bash
# 启动服务 (读取当前激活的 .env)
npm start
```
浏览器打开：[http://localhost:8080](http://localhost:8080) 即可开始多标签页交互测试。

---

## ☁️ 一键部署到 Google Cloud Run

运行自带的自动化部署脚本（会自动切换为生产配置）：
```powershell
.\deploy.ps1
```

部署完成后，控制台将输出 GCP 自动分配的公网 HTTPS / WSS 访问域名。
