/**
 * 多人协作白板核心引擎 (Multiplayer Collaborative Whiteboard Engine)
 * 双层 Canvas 架构 + 高帧率实时流式绘制 + 多人协同光标与在线感知
 */

export class WhiteboardController {
  constructor(socket, state) {
    this.socket = socket;
    this.state = state;

    // DOM 元素引用
    this.container = document.getElementById('wbCanvasContainer');
    this.baseCanvas = document.getElementById('wbBaseCanvas');
    this.overlayCanvas = document.getElementById('wbOverlayCanvas');
    this.cursorsLayer = document.getElementById('wbCursorsLayer');
    this.baseCtx = this.baseCanvas.getContext('2d');
    this.overlayCtx = this.overlayCanvas.getContext('2d');

    // 工具栏元素引用
    this.toolBtns = document.querySelectorAll('.wb-tool-btn');
    this.colorDots = document.querySelectorAll('.wb-color-dot');
    this.customColorInput = document.getElementById('wbCustomColor');
    this.sizeBtns = document.querySelectorAll('.wb-size-btn');
    this.undoBtn = document.getElementById('wbUndoBtn');
    this.clearBtn = document.getElementById('wbClearBtn');
    this.exportBtn = document.getElementById('wbExportBtn');
    this.collaboratorsCountTag = document.getElementById('wbCollaboratorsCount');

    // 迷你聊天抽屉
    this.miniChatDrawer = document.getElementById('wbMiniChatDrawer');
    this.toggleMiniChatBtn = document.getElementById('wbToggleMiniChatBtn');
    this.closeMiniChatBtn = document.getElementById('wbCloseMiniChatBtn');
    this.miniChatForm = document.getElementById('wbMiniChatForm');
    this.miniChatInput = document.getElementById('wbMiniChatInput');
    this.miniChatMessages = document.getElementById('wbMiniChatMessages');

    // 白板状态
    this.currentTool = 'pencil';
    this.currentColor = '#38bdf8';
    this.strokeWidth = 4;
    this.isDrawing = false;
    this.activeRoom = '多人协同白板';

    // 图元数据存储与远程流
    this.elements = []; // 已确认图元列表
    this.currentPoints = [];
    this.startX = 0;
    this.startY = 0;
    this.activeElementId = null;

    // 远程用户光标与正在绘制流
    this.remoteCursors = new Map(); // userId -> { el, timer }
    this.peerStreams = new Map(); // userId -> streamElement

    // 节流控制器 (光标与点流 30ms 节流)
    this.lastCursorEmitTime = 0;
    this.lastStreamEmitTime = 0;

    // 初始化事件绑定
    this.bindToolbarEvents();
    this.bindCanvasEvents();
    this.bindMiniChatEvents();
    this.bindSocketEvents();

    window.addEventListener('resize', () => this.handleResize());
  }

  /**
   * 初始化与自适应 Canvas 高清分辨率 (HiDPI / Retina)
   */
  initCanvasSize() {
    const rect = this.container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    this.dpr = dpr;
    this.width = rect.width;
    this.height = rect.height;

    // 设置物理像素
    this.baseCanvas.width = this.width * dpr;
    this.baseCanvas.height = this.height * dpr;
    this.overlayCanvas.width = this.width * dpr;
    this.overlayCanvas.height = this.height * dpr;

    // 设置 CSS 样式尺寸
    this.baseCanvas.style.width = `${this.width}px`;
    this.baseCanvas.style.height = `${this.height}px`;
    this.overlayCanvas.style.width = `${this.width}px`;
    this.overlayCanvas.style.height = `${this.height}px`;

    // 缩放上下文保持绘图逻辑坐标一致
    this.baseCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 重绘所有已成型图元
    this.redrawBaseCanvas();
  }

  handleResize() {
    const rect = this.container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    if (rect.width === this.width && rect.height === this.height) return;
    this.initCanvasSize();
  }

  /**
   * 激活白板视口
   */
  activate(roomName = '多人协同白板') {
    this.activeRoom = roomName;
    // 渲染帧确保容器 display 变更已生效
    requestAnimationFrame(() => {
      this.initCanvasSize();
      setTimeout(() => this.initCanvasSize(), 60);
    });
    // 加入服务端白板通道
    this.socket.emit('wb:join', { room: this.activeRoom });
  }

  /**
   * 离开白板视口
   */
  deactivate() {
    this.socket.emit('wb:leave', { room: this.activeRoom });
    this.remoteCursors.forEach(c => c.el.remove());
    this.remoteCursors.clear();
    this.peerStreams.clear();
    this.clearOverlay();
  }

  /**
   * 更新协同者在线状态看板
   */
  updateCollaboratorsUI(collaborators = []) {
    if (!this.collaboratorsCountTag) return;
    const count = collaborators.length;
    if (count <= 1) {
      this.collaboratorsCountTag.textContent = '⚡ 协作准备就绪 (1人)';
      this.collaboratorsCountTag.style.color = '#38bdf8';
    } else {
      const names = collaborators.map(u => u.username).join(', ');
      this.collaboratorsCountTag.textContent = `⚡ 正在协作 (${count}人: ${names})`;
      this.collaboratorsCountTag.style.color = '#10b981';
    }
  }

  /**
   * 绑定控制栏按钮
   */
  bindToolbarEvents() {
    // 绘图工具切换
    this.toolBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.toolBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentTool = btn.dataset.tool;
      });
    });

    // 调色板预设
    this.colorDots.forEach(dot => {
      dot.addEventListener('click', () => {
        this.colorDots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        this.currentColor = dot.dataset.color;
        this.customColorInput.value = this.currentColor;
      });
    });

    // 取色器联动
    this.customColorInput.addEventListener('input', (e) => {
      this.currentColor = e.target.value;
      this.colorDots.forEach(d => d.classList.remove('active'));
    });

    // 粗细控制
    this.sizeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.sizeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.strokeWidth = Number(btn.dataset.size) || 4;
      });
    });

    // 撤销操作
    this.undoBtn.addEventListener('click', () => this.handleUndo());

    // 快捷键 Ctrl+Z 撤销
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (!document.getElementById('whiteboardViewport').classList.contains('hidden')) {
          e.preventDefault();
          this.handleUndo();
        }
      }
    });

    // 清屏操作
    this.clearBtn.addEventListener('click', () => {
      if (confirm('确定要清空白板上的所有内容吗？此操作将同步给所有协作者。')) {
        this.socket.emit('wb:clear', { room: this.activeRoom });
      }
    });

    // 导出为 PNG
    this.exportBtn.addEventListener('click', () => this.exportAsPNG());
  }

  /**
   * 绑定 Canvas 鼠标与触控事件
   */
  bindCanvasEvents() {
    const canvas = this.overlayCanvas;

    const getCoord = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const clientY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      return {
        x: Math.round(clientX - rect.left),
        y: Math.round(clientY - rect.top)
      };
    };

    // 1. 指针按下
    const onDown = (e) => {
      if (e.button !== undefined && e.button !== 0) return; // 仅左键响应
      this.isDrawing = true;
      const { x, y } = getCoord(e);
      this.startX = x;
      this.startY = y;
      const currentUid = this.state.user ? this.state.user.userId : 'u_guest';
      this.activeElementId = `${currentUid}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      this.currentPoints = [{ x, y }];

      // 实时清空交互层
      this.clearOverlay();
      this.drawLocalPreview(x, y);
    };

    // 2. 指针移动
    const onMove = (e) => {
      const { x, y } = getCoord(e);

      // 30ms 节流向服务端广播当前用户的实时光标坐标
      const now = Date.now();
      if (now - this.lastCursorEmitTime > 30) {
        this.lastCursorEmitTime = now;
        this.socket.emit('wb:cursor_move', {
          room: this.activeRoom,
          x,
          y
        });
      }

      if (!this.isDrawing) return;

      this.currentPoints.push({ x, y });
      this.drawLocalPreview(x, y);

      // 30ms 节流向服务端广播实时笔画流预览（传输当前完整笔画点序列，杜绝折叠错乱）
      if (now - this.lastStreamEmitTime > 30) {
        this.lastStreamEmitTime = now;
        this.socket.emit('wb:draw_stream', {
          room: this.activeRoom,
          elementId: this.activeElementId,
          type: this.currentTool,
          color: this.currentColor,
          strokeWidth: this.strokeWidth,
          points: this.currentPoints,
          x: Math.min(this.startX, x),
          y: Math.min(this.startY, y),
          width: Math.abs(x - this.startX),
          height: Math.abs(y - this.startY),
          startX: this.startX,
          startY: this.startY,
          endX: x,
          endY: y
        });
      }
    };

    // 3. 指针松开与绘制提交
    const onUp = (e) => {
      if (!this.isDrawing) return;
      this.isDrawing = false;
      const { x, y } = getCoord(e);

      this.finalizeElement(x, y);
      this.clearOverlay();
      this.redrawPeerStreams();
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', onUp);
  }

  /**
   * 绘制本地高帧率预览 (Overlay Canvas)
   */
  drawLocalPreview(currentX, currentY) {
    this.clearOverlay();
    this.redrawPeerStreams();

    const ctx = this.overlayCtx;
    ctx.save();
    ctx.strokeStyle = this.currentTool === 'eraser' ? '#ffffff' : this.currentColor;
    ctx.lineWidth = this.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (this.currentTool === 'eraser') {
      ctx.setLineDash([4, 4]);
    }

    if (this.currentTool === 'pencil' || this.currentTool === 'eraser') {
      this.renderPoints(ctx, this.currentPoints);
    } else if (this.currentTool === 'rect') {
      const left = Math.min(this.startX, currentX);
      const top = Math.min(this.startY, currentY);
      const w = Math.abs(currentX - this.startX);
      const h = Math.abs(currentY - this.startY);
      ctx.strokeRect(left, top, w, h);
    } else if (this.currentTool === 'circle') {
      const radiusX = Math.abs(currentX - this.startX) / 2;
      const radiusY = Math.abs(currentY - this.startY) / 2;
      const centerX = Math.min(this.startX, currentX) + radiusX;
      const centerY = Math.min(this.startY, currentY) + radiusY;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, Math.max(1, radiusX), Math.max(1, radiusY), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.currentTool === 'line') {
      ctx.beginPath();
      ctx.moveTo(this.startX, this.startY);
      ctx.lineTo(currentX, currentY);
      ctx.stroke();
    } else if (this.currentTool === 'arrow') {
      this.renderArrow(ctx, this.startX, this.startY, currentX, currentY, this.strokeWidth);
    }

    ctx.restore();
  }

  /**
   * 最终定型图元并提交至服务端
   */
  finalizeElement(endX, endY) {
    if (this.currentPoints.length < 2 && this.currentTool === 'pencil') return;

    const element = {
      id: this.activeElementId,
      type: this.currentTool,
      color: this.currentColor,
      strokeWidth: this.strokeWidth,
      points: this.currentPoints,
      x: Math.min(this.startX, endX),
      y: Math.min(this.startY, endY),
      width: Math.abs(endX - this.startX),
      height: Math.abs(endY - this.startY),
      startX: this.startX,
      startY: this.startY,
      endX,
      endY,
      createdAt: Date.now()
    };

    // 乐观渲染到底层 Canvas
    this.elements.push(element);
    this.renderSingleElement(this.baseCtx, element);

    // 提交服务端持久化与协同广播
    this.socket.emit('wb:element_create', {
      room: this.activeRoom,
      element
    });
  }

  /**
   * 处理撤销
   */
  handleUndo() {
    this.socket.emit('wb:element_undo', {
      room: this.activeRoom
    });
  }

  /**
   * 重绘底层静态 Canvas (包含所有已确认图元)
   */
  redrawBaseCanvas() {
    this.baseCtx.clearRect(0, 0, this.width || 800, this.height || 600);
    for (const el of this.elements) {
      if (!el.isDeleted) {
        this.renderSingleElement(this.baseCtx, el);
      }
    }
  }

  /**
   * 渲染单个图元
   */
  renderSingleElement(ctx, el) {
    ctx.save();
    if (el.type === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = el.strokeWidth * 3;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = el.color || '#38bdf8';
      ctx.lineWidth = el.strokeWidth || 4;
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (el.type) {
      case 'pencil':
      case 'eraser':
        if (el.points && el.points.length > 0) {
          this.renderPoints(ctx, el.points);
        }
        break;

      case 'rect':
        ctx.strokeRect(el.x, el.y, el.width, el.height);
        break;

      case 'circle': {
        const radiusX = (el.width || 0) / 2;
        const radiusY = (el.height || 0) / 2;
        const centerX = (el.x || 0) + radiusX;
        const centerY = (el.y || 0) + radiusY;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, Math.max(1, radiusX), Math.max(1, radiusY), 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }

      case 'line':
        ctx.beginPath();
        ctx.moveTo(el.startX ?? el.x, el.startY ?? el.y);
        ctx.lineTo(el.endX ?? (el.x + el.width), el.endY ?? (el.y + el.height));
        ctx.stroke();
        break;

      case 'arrow': {
        const sX = el.startX ?? el.x;
        const sY = el.startY ?? el.y;
        const eX = el.endX ?? (el.x + el.width);
        const eY = el.endY ?? (el.y + el.height);
        this.renderArrow(ctx, sX, sY, eX, eY, el.strokeWidth);
        break;
      }
    }

    ctx.restore();
  }

  /**
   * 贝塞尔二次曲线平滑渲染连续点序列
   */
  renderPoints(ctx, points) {
    if (!points || points.length === 0) return;
    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }

    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }

  /**
   * 绘制带箭头的矢量线段
   */
  renderArrow(ctx, fromX, fromY, toX, toY, width) {
    const headLength = Math.max(12, (width || 4) * 3.5);
    const angle = Math.atan2(toY - fromY, toX - fromX);

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    // 箭头头部
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headLength * Math.cos(angle - Math.PI / 6),
      toY - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      toX - headLength * Math.cos(angle + Math.PI / 6),
      toY - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  }

  clearOverlay() {
    this.overlayCtx.clearRect(0, 0, this.width || 800, this.height || 600);
  }

  redrawPeerStreams() {
    for (const [userId, stream] of this.peerStreams.entries()) {
      this.overlayCtx.save();
      this.overlayCtx.strokeStyle = stream.color || '#a855f7';
      this.overlayCtx.lineWidth = stream.strokeWidth || 4;
      this.overlayCtx.lineCap = 'round';
      this.overlayCtx.lineJoin = 'round';

      if (stream.type === 'pencil' && stream.points) {
        this.renderPoints(this.overlayCtx, stream.points);
      } else if (stream.type === 'rect') {
        this.overlayCtx.strokeRect(stream.x, stream.y, stream.width, stream.height);
      } else if (stream.type === 'circle') {
        const radiusX = (stream.width || 0) / 2;
        const radiusY = (stream.height || 0) / 2;
        const centerX = (stream.x || 0) + radiusX;
        const centerY = (stream.y || 0) + radiusY;
        this.overlayCtx.beginPath();
        this.overlayCtx.ellipse(centerX, centerY, Math.max(1, radiusX), Math.max(1, radiusY), 0, 0, Math.PI * 2);
        this.overlayCtx.stroke();
      } else if (stream.type === 'line') {
        this.overlayCtx.beginPath();
        this.overlayCtx.moveTo(stream.startX ?? stream.x, stream.startY ?? stream.y);
        this.overlayCtx.lineTo(stream.endX ?? (stream.x + stream.width), stream.endY ?? (stream.y + stream.height));
        this.overlayCtx.stroke();
      } else if (stream.type === 'arrow') {
        const sX = stream.startX ?? stream.x;
        const sY = stream.startY ?? stream.y;
        const eX = stream.endX ?? (stream.x + stream.width);
        const eY = stream.endY ?? (stream.y + stream.height);
        this.renderArrow(this.overlayCtx, sX, sY, eX, eY, stream.strokeWidth);
      }
      this.overlayCtx.restore();
    }
  }

  /**
   * 绑定服务端 Socket 协作事件
   */
  bindSocketEvents() {
    // 1. 白板初始全量快照加载
    this.socket.on('wb:init_state', ({ elements, collaborators }) => {
      this.elements = Array.isArray(elements) ? elements : [];
      this.redrawBaseCanvas();
      if (Array.isArray(collaborators)) {
        this.updateCollaboratorsUI(collaborators);
      }
    });

    // 2. 在线白板协作者更新
    this.socket.on('wb:collaborators_updated', ({ collaborators }) => {
      if (Array.isArray(collaborators)) {
        this.updateCollaboratorsUI(collaborators);
      }
    });

    // 3. 协作者创建了新图元
    this.socket.on('wb:element_created', ({ element }) => {
      if (!this.elements.some(e => e.id === element.id)) {
        this.elements.push(element);
        this.renderSingleElement(this.baseCtx, element);
      }
      // 移除该协作者的临时流
      if (element.ownerId) {
        this.peerStreams.delete(element.ownerId);
        this.clearOverlay();
        this.redrawPeerStreams();
      }
    });

    // 4. 协作者撤销了图元
    this.socket.on('wb:element_undone', ({ elementId }) => {
      const target = this.elements.find(e => e.id === elementId);
      if (target) {
        target.isDeleted = true;
        this.redrawBaseCanvas();
      }
    });

    // 5. 白板全量清空
    this.socket.on('wb:cleared', () => {
      this.elements = [];
      this.peerStreams.clear();
      this.clearOverlay();
      this.redrawBaseCanvas();
    });

    // 6. 远程协作者实时流预览 (全量点序列平滑对接)
    this.socket.on('wb:peer_draw_stream', (data) => {
      if (data.userId === this.state.user.userId) return;

      this.peerStreams.set(data.userId, {
        type: data.type,
        color: data.color,
        strokeWidth: data.strokeWidth,
        points: data.points || [],
        x: data.x,
        y: data.y,
        width: data.width,
        height: data.height,
        startX: data.startX,
        startY: data.startY,
        endX: data.endX,
        endY: data.endY
      });

      this.clearOverlay();
      this.redrawPeerStreams();
    });

    // 7. 远程协同光标追踪 (过滤自身光标)
    this.socket.on('wb:user_cursor', ({ userId, username, x, y }) => {
      if (userId === this.state.user.userId) return;
      this.renderRemoteCursor(userId, username, x, y);
    });

    // 8. 远程协同光标离场
    this.socket.on('wb:user_cursor_leave', ({ userId }) => {
      this.removeRemoteCursor(userId);
    });
  }

  /**
   * 渲染远程协作者光标与昵称
   */
  renderRemoteCursor(userId, username, x, y) {
    let cursorObj = this.remoteCursors.get(userId);

    if (!cursorObj) {
      const el = document.createElement('div');
      el.className = 'wb-remote-cursor';

      // 根据 userId 生成一致的明亮色调
      const hashColor = this.getUserColor(userId);

      el.innerHTML = `
        <svg class="wb-cursor-pointer" viewBox="0 0 24 24" fill="${hashColor}">
          <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.36z" stroke="#ffffff" stroke-width="1.5"/>
        </svg>
        <div class="wb-cursor-label" style="background:${hashColor}">${escapeHTML(username || '协作者')}</div>
      `;

      this.cursorsLayer.appendChild(el);
      cursorObj = { el, timer: null };
      this.remoteCursors.set(userId, cursorObj);
    }

    // 平滑位移
    cursorObj.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;

    // 5秒无位移自动淡出
    if (cursorObj.timer) clearTimeout(cursorObj.timer);
    cursorObj.timer = setTimeout(() => {
      this.removeRemoteCursor(userId);
    }, 5000);
  }

  removeRemoteCursor(userId) {
    const cursorObj = this.remoteCursors.get(userId);
    if (cursorObj) {
      if (cursorObj.timer) clearTimeout(cursorObj.timer);
      cursorObj.el.remove();
      this.remoteCursors.delete(userId);
    }
  }

  getUserColor(id) {
    const colors = ['#38bdf8', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
    let hash = 0;
    for (let i = 0; i < (id || '').length; i++) {
      hash = (hash << 5) - hash + id.charCodeAt(i);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  /**
   * 导出白板为 PNG 图片
   */
  exportAsPNG() {
    const offscreen = document.createElement('canvas');
    offscreen.width = this.width || 800;
    offscreen.height = this.height || 600;
    const offCtx = offscreen.getContext('2d');

    // 填充科技暗黑底色
    offCtx.fillStyle = '#0b1120';
    offCtx.fillRect(0, 0, offscreen.width, offscreen.height);

    // 绘制所有成型图元
    for (const el of this.elements) {
      if (!el.isDeleted) {
        this.renderSingleElement(offCtx, el);
      }
    }

    const dataUrl = offscreen.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `whiteboard-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }

  /**
   * 迷你聊天抽屉逻辑
   */
  bindMiniChatEvents() {
    this.toggleMiniChatBtn.addEventListener('click', () => {
      this.miniChatDrawer.classList.toggle('hidden');
      if (!this.miniChatDrawer.classList.contains('hidden')) {
        this.miniChatInput.focus();
        this.scrollMiniChatBottom();
      }
    });

    this.closeMiniChatBtn.addEventListener('click', () => {
      this.miniChatDrawer.classList.add('hidden');
    });

    this.miniChatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.miniChatInput.value.trim();
      if (!text) return;

      this.socket.emit('room:message', {
        room: this.activeRoom,
        text
      });
      this.miniChatInput.value = '';
    });
  }

  appendMiniChatMessage(msg) {
    const myId = this.state.user ? this.state.user.userId : 'u_guest';
    const isSelf = msg.fromUserId === myId;
    const msgDiv = document.createElement('div');
    msgDiv.className = `wb-mini-msg ${isSelf ? 'self' : 'other'}`;
    msgDiv.innerHTML = `
      <div class="wb-mini-msg-meta">${escapeHTML(msg.fromUsername || '用户')} · ${msg.time || ''}</div>
      <div class="wb-mini-msg-bubble">${escapeHTML(msg.text || '')}</div>
    `;
    this.miniChatMessages.appendChild(msgDiv);
    this.scrollMiniChatBottom();
  }

  scrollMiniChatBottom() {
    this.miniChatMessages.scrollTop = this.miniChatMessages.scrollHeight;
  }
}

function escapeHTML(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
