import { Router } from 'express';
import { userStore } from '../services/userStore.js';

/**
 * 渐进式认证 REST API 路由
 * 完全遵循信令规约：纯 JSON 字典、强类型与错误码规范、对齐 Dart 实体
 */
export function createAuthRouter() {
  const router = Router();

  // 辅助中间件：提取并校验 Bearer Token
  const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: '未提供有效 Token' });
    }

    const user = userStore.getUserByToken(token);
    if (!user) {
      return res.status(401).json({ code: 'TOKEN_EXPIRED_OR_INVALID', message: 'Token 已失效或无效' });
    }

    req.user = user;
    req.token = token;
    next();
  };

  /**
   * GET /api/auth/me
   * 获取当前认证身份信息
   */
  router.get('/me', requireAuth, (req, res) => {
    return res.json({
      code: 'SUCCESS',
      data: {
        user: userStore.toSafeUser(req.user)
      }
    });
  });

  /**
   * POST /api/auth/bind
   * 渐进式绑定：当前游客升级为正式账号
   * Body: { identifier: string, password: string, username?: string }
   */
  router.post('/bind', requireAuth, async (req, res) => {
    try {
      const { identifier, password, username } = req.body || {};
      const result = await userStore.bindAccount(req.user.userId, {
        identifier,
        password,
        username
      });

      return res.json({
        code: 'SUCCESS',
        message: '账号绑定升级成功',
        data: result
      });
    } catch (err) {
      const statusMap = {
        'INVALID_IDENTIFIER': 400,
        'PASSWORD_TOO_SHORT': 400,
        'IDENTIFIER_ALREADY_EXISTS': 409,
        'USER_NOT_FOUND': 404
      };
      const statusCode = statusMap[err.message] || 500;
      return res.status(statusCode).json({
        code: err.message,
        message: getErrorMessage(err.message)
      });
    }
  });

  /**
   * POST /api/auth/login
   * 已有正式账号凭据登录 (支持跨设备多端切换)
   * Body: { identifier: string, password: string }
   */
  router.post('/login', async (req, res) => {
    try {
      const { identifier, password } = req.body || {};
      const result = await userStore.loginWithCredentials(identifier, password);

      return res.json({
        code: 'SUCCESS',
        message: '登录成功',
        data: result
      });
    } catch (err) {
      return res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: '账号或密码错误'
      });
    }
  });

  return router;
}

function getErrorMessage(code) {
  switch (code) {
    case 'INVALID_IDENTIFIER':
      return '账号标识格式无效（至少3个字符）';
    case 'PASSWORD_TOO_SHORT':
      return '密码长度不能少于6位';
    case 'IDENTIFIER_ALREADY_EXISTS':
      return '该账号或邮箱已被绑定，请直接登录';
    case 'USER_NOT_FOUND':
      return '未找到对应用户';
    default:
      return '认证处理遇到错误，请稍后重试';
  }
}
