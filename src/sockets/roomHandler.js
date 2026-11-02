import { sessionStore } from '../services/sessionStore.js';

/**
 * 公共房间/频道业务处理器 (Room Broadcast Handler)
 */
export function registerRoomHandlers(io, socket) {
  // 加入指定公共房间
  socket.on('room:join', ({ room }) => {
    const session = sessionStore.getSession(socket.id);
    if (!session) return;

    const targetRoom = (room || '大厅讨论区').trim().slice(0, 30);
    const prevRoom = session.currentRoom;

    // 退出旧房间
    if (prevRoom && prevRoom !== targetRoom) {
      socket.leave(prevRoom);
      socket.to(prevRoom).emit('system:message', {
        type: 'leave',
        text: `${session.username} 离开了房间`,
        time: new Date().toLocaleTimeString(),
        room: prevRoom
      });
      io.to(prevRoom).emit('room:users_updated', {
        room: prevRoom,
        users: sessionStore.getUsersInRoom(io, prevRoom)
      });
    }

    // 加入新房间
    socket.join(targetRoom);
    sessionStore.saveSession(socket.id, { currentRoom: targetRoom });

    // 回执当前用户成功加入
    socket.emit('room:joined_success', {
      room: targetRoom
    });

    // 广播进入房间通知
    socket.to(targetRoom).emit('system:message', {
      type: 'join',
      text: `${session.username} 加入了房间`,
      time: new Date().toLocaleTimeString(),
      room: targetRoom
    });

    // 同步新房间在线成员
    io.to(targetRoom).emit('room:users_updated', {
      room: targetRoom,
      users: sessionStore.getUsersInRoom(io, targetRoom)
    });
  });

  // 房间公开发言
  socket.on('room:message', ({ text }) => {
    const session = sessionStore.getSession(socket.id);
    if (!session || !session.currentRoom) return;

    const cleanText = (text || '').trim().slice(0, 1000);
    if (!cleanText) return;

    const messagePayload = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      scope: 'room',
      room: session.currentRoom,
      senderId: session.userId,
      senderName: session.username,
      text: cleanText,
      time: new Date().toLocaleTimeString()
    };

    io.to(session.currentRoom).emit('room:new_message', messagePayload);
  });
}
