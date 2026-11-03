import { sessionStore } from '../services/sessionStore.js';
import { whiteboardStore } from '../services/whiteboardStore.js';

/**
 * 获取当前 socket 的有效会话，若尚未完成 auth:init 则自动生成安全降级会话
 */
function getEffectiveSession(socket) {
  let session = sessionStore.getSession(socket.id);
  if (!session) {
    session = sessionStore.saveSession(socket.id, {
      userId: `u_${socket.id.slice(0, 8)}`,
      username: '协作者'
    });
  }
  return session;
}

/**
 * 多人协同白板实时事件处理器 (Whiteboard Real-time Socket Handler)
 */
export function registerWhiteboardHandlers(io, socket) {
  // 1. 用户进入白板房间并拉取全量快照与协作者名单
  socket.on('wb:join', async ({ room }) => {
    const session = getEffectiveSession(socket);
    const roomId = (room || '多人协同白板').trim();
    const channelName = `wb:${roomId}`;

    // 加入 Socket.IO 白板通信频道
    socket.join(channelName);

    // 登记为在线白板协作者
    const collaborators = whiteboardStore.addCollaborator(roomId, socket.id, session);

    // 获取并下发房间最新快照数据
    const snapshot = await whiteboardStore.getSnapshot(roomId);
    socket.emit('wb:init_state', {
      ...snapshot,
      collaborators
    });

    // 广播房间最新协作者名单
    io.to(channelName).emit('wb:collaborators_updated', {
      roomId,
      collaborators
    });
  });

  // 2. 实时光标位置广播 (30ms 节流下发)
  socket.on('wb:cursor_move', ({ room, x, y }) => {
    const session = getEffectiveSession(socket);
    const roomId = (room || '多人协同白板').trim();

    socket.to(`wb:${roomId}`).emit('wb:user_cursor', {
      userId: session.userId,
      username: session.username,
      x: Math.round(x),
      y: Math.round(y)
    });
  });

  // 3. 实时绘制中的流式笔迹预览 (全量点序列平滑广播，杜绝断线与跳点)
  socket.on('wb:draw_stream', ({ room, elementId, type, color, strokeWidth, points, x, y, width, height, startX, startY, endX, endY }) => {
    const session = getEffectiveSession(socket);
    const roomId = (room || '多人协同白板').trim();

    socket.to(`wb:${roomId}`).emit('wb:peer_draw_stream', {
      userId: session.userId,
      elementId,
      type,
      color,
      strokeWidth,
      points: Array.isArray(points) ? points : [],
      x,
      y,
      width,
      height,
      startX,
      startY,
      endX,
      endY
    });
  });

  // 4. 图元绘制完成并最终提交
  socket.on('wb:element_create', async ({ room, element }) => {
    const session = getEffectiveSession(socket);
    if (!element) return;

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
    const session = getEffectiveSession(socket);
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
    const session = getEffectiveSession(socket);
    const roomId = (room || '多人协同白板').trim();
    await whiteboardStore.clearBoard(roomId, session.userId);

    io.to(`wb:${roomId}`).emit('wb:cleared', {
      roomId,
      by: session.username
    });
  });

  // 7. 离开白板通道
  socket.on('wb:leave', ({ room }) => {
    const session = getEffectiveSession(socket);
    const roomId = (room || '多人协同白板').trim();
    const channelName = `wb:${roomId}`;

    const remaining = whiteboardStore.removeCollaborator(roomId, socket.id);
    socket.leave(channelName);

    socket.to(channelName).emit('wb:user_cursor_leave', {
      userId: session.userId
    });

    io.to(channelName).emit('wb:collaborators_updated', {
      roomId,
      collaborators: remaining
    });
  });
}
