# GCP LiveHub: Node.js + Socket.IO 实时双向交互原型

基于 **Node.js + Socket.IO** 构建的高性能实时双向交互系统，专为 **Google Cloud Run (免费层额度优先)** 优化设计。

---

## 🌟 核心特性

- **房间隔离与广播（Room Broadcast）**：支持多频道切换（大厅、对战大厅、白板协同、自定义房间），支持加入/离开广播与在线成员列表同步。
- **自动断线重连（Auto Reconnection）**：客户端内置指数避退自动重连（Exponential Backoff）机制与重连恢复后自动重新入房。
- **输入状态指示（Typing Indicator）**：实时感知对方“正在输入...”。
- **网络状态与测速面板**：实时 Ping-Pong 往返延迟探测与传输协议（WebSocket / Polling）动态显示。
- **优雅停机与存活探针**：内置 `/healthz` 检查端点与 `SIGTERM/SIGINT` 信号优雅关闭处理。

---

## 🚀 本地极速运行

```bash
# 1. 安装依赖（已内置）
npm install

# 2. 启动服务
npm start

# 或热重载开发模式
npm run dev
```

浏览器打开：[http://localhost:8080](http://localhost:8080) 即可开始多标签页模拟多人互动。

---

## ☁️ 一键部署到 Google Cloud Run（零额外开销方案）

本项目针对 GCP 免费体验额度做了专属配置：
- **`--max-instances 1`**：锁定单容器实例，进程内完成所有房间广播，**彻底无需引入昂贵的 GCP Memorystore Redis（每月省下约 $35+）**。
- **`--concurrency 250`**：单实例轻松承载多达 250 个长连接。
- **`--timeout 3600`**：设置 60 分钟 WebSocket 连接生存周期。
- **`--session-affinity`**：启用粘性会话。

### 运行部署命令：
```powershell
.\deploy.ps1
```
或者手动执行：
```bash
gcloud run deploy livehub \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --max-instances=1 \
  --concurrency=250 \
  --timeout=3600 \
  --session-affinity \
  --memory=512Mi \
  --cpu=1
```
*(部署完成后，GCP 将自动提供一个免费的 HTTPS/WSS 域名)*
