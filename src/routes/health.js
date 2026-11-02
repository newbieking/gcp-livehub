import { Router } from 'express';

export function createHealthRouter(getSocketCount) {
  const router = Router();

  router.get(['/healthz', '/health', '/api/health'], (req, res) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      activeConnections: typeof getSocketCount === 'function' ? getSocketCount() : 0,
      timestamp: new Date().toISOString()
    });
  });

  return router;
}
