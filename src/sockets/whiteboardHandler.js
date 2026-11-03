import { sessionStore } from '../services/sessionStore.js';
import { whiteboardStore } from '../services/whiteboardStore.js';

/**
 * 多人协同白板实时事件处理器 (Whiteboard Real-time Socket Handler)
 */
export function registerWhiteboardHandlers(io, socket) {
  // 1. 用户进入白板房间并拉取全量快照
  socket.on('wb:join', async ({ room }) => {
    const session = sessionStore.getSession(socket.id);
    if (!session) return;

    const roomId = (room || '多人协同白板').trim();
    const channelName = `wb:${roomId}`;

    // 加入 Socket.IO 白板通信频道
    socket.join(channelName);

    // 获取并下发房间最新快照数据
    const snapshot = await whiteboardStore.getSnapshot(roomId);
    socket.emit('wb:init_state', snapshot);

    // 广播成员加入
    socket.to(channelName).emit('wb:user_joined', {
      userId: session.userId,
      username: session.username
    });
  });

  // 2. 实时光标位置广播 (30ms 节流下发)
  socket.on('wb:cursor_move', ({ room, x, y }) => {
    const session = sessionStore.getSession(socket.id);
    if (!session) return;

    const roomId = (room || '多人协同白板').trim();
    socket.to(`wb:${roomId}`).emit('wb:user_cursor', {
      userId: session.userId,
      username: session.username,
      x: Math.round(x),
      y: Math.round(y)
    });
  });

  // 3. 实时绘制中的流式笔迹预览 (实时性与交互体验)
  socket.on('wb:draw_stream', ({ room, elementId, type, color, strokeWidth, partialPoints, x, y, width, height }) => {
    const session = sessionStore.getSession(socket.id);
    if (!session) return;

    const roomId = (room || '多人协同白板').trim();
    socket.to(`wb:${roomId}`).emit('wb:peer_draw_stream', {
      userId: session.userId,
      elementId,
      type,
      color,
      strokeWidth,
      partialPoints,
      x,
      y,
      width,
      height
    });
  });

  // 4. 图元绘制完成并最终提交
  socket.on('wb:element_create', async ({ room, element }) => {
    const session = sessionStore.getSession(socket.id);
    if (!session || !element) return;

    const roomId = (room || '多人协同白板').trim();
    const created = await whiteboardStore.addElement(roomId, {
      ...element,
      ownerId: session.userId,
      ownerName: session.username
    });

    // 回执发起者
    socket.emit('wb:element_created_ack', {
      elementId: created.id,
      status: 'ok'
    });

    // 广播至该白板房间所有协作者
    socket.to(`wb:${roomId}`).emit('wb:element_created', {
      element: created
    });
  });

  // 5. 撤销图元
  socket.on('wb:element_undo', async ({ room, elementId }) => {
    const session = sessionStore.getSession(socket.id);
    if (!session) return;

    const roomId = (room || '多人协同白板').trim();
    const undone = await whiteboardStore.undoElement(roomId, elementId, session.userId);

    if (undone) {
      io.to(`wb:${roomId}`).emit('wb:element_undone', {
        elementId: undone.id,
        ownerId: undone.ownerId,
        undoneBy: session.username
      });
    }
  });

  // 6. 清空白板
  socket.on('wb:clear', async ({ room }) => {
    const session = sessionStore.getSession(socket.id);
    if (!session) return;

    const roomId = (room || '多人协同白板').trim();
    await whiteboardStore.clearBoard(roomId, session.userId);

    io.to(`wb:${roomId}`).emit('wb:cleared', {
      roomId,
      by: session.username
    });
  });

  // 7. 离开白板通道
  socket.on('wb:leave', ({ room }) => {
    const session = sessionStore.getSession(socket.id);
    if (!session) return;

    const roomId = (room || '多人协同白板').trim();
    socket.leave(`wb:${roomId}`);
    socket.to(`wb:${roomId}`).emit('wb:user_cursor_leave', {
      userId: session.userId
    });
  });
}
