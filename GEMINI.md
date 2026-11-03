# GCP LiveHub 项目专属开发规约 (Workspace Guidelines)

> 本文件仅在当前项目工作区 (`gcloud`) 生效，完全独立于其他项目。

## 🎯 核心定位与技术路线
- **Web 端定位**：当前实现的 Web 前端（Node.js + 原生 H5/CSS/JS）作为 **App 原型验证沙箱（Prototype & Testbed）**。
- **最终主端形态**：最终商业化落地形态为 **Flutter 跨平台原生客户端（iOS / Android / Desktop）**。
- **开发硬性要求**：任何后续功能开发、架构设计、信令协议与规则实现，必须严格考虑并兼容后期的 Flutter 客户端落地。

---

## 1. 后端与网络信令协议铁律 (Backend & Protocol)
1. **绝对平台解耦**：
   - 后端服务（Node.js / Express / Socket.IO）只能收发标准的纯 JSON 字典，严禁将任何 Web 专有概念（如 HTML 字符串、DOM 属性、特定浏览器上下文）侵入到信令与存储中。
2. **强类型与 Dart 序列化友好**：
   - 所有事件名必须语义统一，格式遵循 `scope:action`（如 `table:create`, `game:action`）；
   - Payload 字段名使用驼峰命名（CamelCase），字段类型必须明确且稳定，确保未来可直接一对一生成 Dart `@freezed` 或 `json_serializable` 实体模型类。
3. **权威状态机架构**：
   - 游戏规则校验与胜负裁决必须完全驻留在后端插件（继承 `BaseGame`），客户端只做“操作输入采集”与“状态插值/渲染展示”，确保未来 Flutter 接入时零后端改造。

---

## 2. 小游戏插件抽象契约 (Game Plugin Contract)
所有新游戏开发必须严格遵循两端对称架构：
- **后端规则生命周期**：位于 `src/games/plugins/*.js`（实现 `BaseGame`：`onGameStart`, `onPlayerAction`, `onPlayerLeave`）。
- **前端表现层**：仅通过通用挂载点渲染，后期一对一迁移至 Flutter 的 `BaseGameArenaWidget`（使用 `CustomPainter` 或 `Flame` 引擎）。

---

## 3. Web 原型交互设计原则 (Mobile-First Prototype)
- **触控体验优先**：可交互控件、按钮、棋格有效触控面积必须满足苹果人机界面指南（HIG，不小于 `44×44px` 或配备移动端选点与确认条）。
- **移动视口自适应**：全站禁止硬编码大屏固定宽度，采用流式布局与 `100dvh`，原生兼容软键盘弹出与安全区域。
- **导航形态对齐 App**：采用抽屉式侧滑导航（Drawer），交互动效贴近原生体验。
