const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// 初始化 Socket.IO，支持 websocket 及 polling 降级
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// 托管前端静态文件
app.use(express.static(path.join(__dirname, 'public')));

// 存活探针（适配 Cloud Run 健康检查）
app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    activeConnections: io.engine.clientsCount
  });
});

// 用户会话记录（socket.id => { username, room }）
const socketUsers = new Map();

// 辅助函数：获取指定房间内的所有在线用户列表
function getRoomUsers(room) {
  const users = [];
  const roomSockets = io.sockets.adapter.rooms.get(room);
  if (roomSockets) {
    for (const socketId of roomSockets) {
      const user = socketUsers.get(socketId);
      if (user) {
        users.push(user.username);
      }
    }
  }
  return users;
}

io.on('connection', (socket) => {
  console.log(`[连接建立] Socket ID: ${socket.id}, 当前总连接数: ${io.engine.clientsCount}`);

  // 延迟测速响应
  socket.on('ping_check', (callback) => {
    if (typeof callback === 'function') {
      callback();
    }
  });

  // 1. 用户加入房间
  socket.on('join_room', ({ username, room }) => {
    const cleanUsername = (username || '访客').trim().slice(0, 20);
    const cleanRoom = (room || '默认大厅').trim().slice(0, 30);

    // 如果之前在其他房间，先退出
    const prevSession = socketUsers.get(socket.id);
    if (prevSession && prevSession.room) {
      socket.leave(prevSession.room);
      socket.to(prevSession.room).emit('system_message', {
        type: 'leave',
        text: `${prevSession.username} 离开了房间`,
        time: new Date().toLocaleTimeString()
      });
      io.to(prevSession.room).emit('room_users_updated', {
        room: prevSession.room,
        users: getRoomUsers(prevSession.room)
      });
    }

    // 加入新房间
    socket.join(cleanRoom);
    socketUsers.set(socket.id, { username: cleanUsername, room: cleanRoom });

    // 通知当前用户加入成功
    socket.emit('joined_room_success', {
      username: cleanUsername,
      room: cleanRoom
    });

    // 广播房间内新成员加入
    socket.to(cleanRoom).emit('system_message', {
      type: 'join',
      text: `${cleanUsername} 加入了房间`,
      time: new Date().toLocaleTimeString()
    });

    // 广播更新房间成员名单
    io.to(cleanRoom).emit('room_users_updated', {
      room: cleanRoom,
      users: getRoomUsers(cleanRoom)
    });
  });

  // 2. 接收并广播房间聊天消息
  socket.on('send_message', (data) => {
    const session = socketUsers.get(socket.id);
    if (!session || !session.room) return;

    const messagePayload = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sender: session.username,
      room: session.room,
      text: (data.text || '').trim().slice(0, 1000),
      time: new Date().toLocaleTimeString()
    };

    if (!messagePayload.text) return;

    // 广播给房间内的所有人（包括发送者自己）
    io.to(session.room).emit('new_message', messagePayload);
  });

  // 3. 正在输入指示器 (Typing Indicator)
  socket.on('typing_status', ({ isTyping }) => {
    const session = socketUsers.get(socket.id);
    if (!session || !session.room) return;

    socket.to(session.room).emit('user_typing_update', {
      username: session.username,
      isTyping: !!isTyping
    });
  });

  // 4. 断开连接处理
  socket.on('disconnecting', () => {
    const session = socketUsers.get(socket.id);
    if (session && session.room) {
      socket.to(session.room).emit('system_message', {
        type: 'leave',
        text: `${session.username} 已断开连接`,
        time: new Date().toLocaleTimeString()
      });
    }
  });

  socket.on('disconnect', (reason) => {
    const session = socketUsers.get(socket.id);
    if (session && session.room) {
      io.to(session.room).emit('room_users_updated', {
        room: session.room,
        users: getRoomUsers(session.room)
      });
    }
    socketUsers.delete(socket.id);
    console.log(`[连接断开] Socket ID: ${socket.id}, 原因: ${reason}, 剩余连接: ${io.engine.clientsCount}`);
  });
});

// Cloud Run 默认读取 PORT 环境变量，默认 8080
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 实时双向交互服务启动成功!`);
  console.log(`📡 监听端口: ${PORT}`);
  console.log(`🔗 本地访问: http://localhost:${PORT}`);
});

// 优雅停机信号处理（便于 Cloud Run 缩容平滑过渡）
const handleShutdown = (signal) => {
  console.log(`接收到 ${signal} 信号，准备平滑关闭服务...`);
  io.close(() => {
    console.log('Socket.IO 服务已关闭所有连接');
    server.close(() => {
      console.log('HTTP 服务已终止');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
