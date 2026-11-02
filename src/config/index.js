export const config = {
  port: parseInt(process.env.PORT || '8080', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  socket: {
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
  }
};
