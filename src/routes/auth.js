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

      // 若需要两步验证，返回挑战态阻断直登
      if (result.requires2FA) {
        return res.json({
          code: 'REQUIRES_2FA',
          message: '该账号已开启两步验证，请输入动态口令',
          data: {
            requires2FA: true,
            tempToken: result.tempToken,
            user: result.user
          }
        });
      }

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

  /**
   * POST /api/auth/2fa/verify-login
   * 登录阶段提交 6 位两步验证动态码换发正式 Token
   * Body: { tempToken: string, code: string }
   */
  router.post('/2fa/verify-login', async (req, res) => {
    try {
      const { tempToken, code } = req.body || {};
      const result = await userStore.verifyLoginTwoFactor(tempToken, code);

      return res.json({
        code: 'SUCCESS',
        message: '两步验证通过，登录成功',
        data: result
      });
    } catch (err) {
      const status = (err.message === 'INVALID_2FA_CODE' || err.message === 'INVALID_CHALLENGE_TOKEN') ? 401 : 400;
      return res.status(status).json({
        code: err.message,
        message: err.message === 'INVALID_2FA_CODE' ? '动态验证码错误或已过期，请核对手机时间' : '两步验证挑战已过期，请重新登录'
      });
    }
  });

  /**
   * POST /api/auth/2fa/setup
   * 请求生成两步验证临时密钥与绑定二维码
   */
  router.post('/2fa/setup', requireAuth, async (req, res) => {
    try {
      const setupData = await userStore.prepareTwoFactor(req.user.userId);
      return res.json({
        code: 'SUCCESS',
        message: '已生成两步验证密钥',
        data: setupData
      });
    } catch (err) {
      return res.status(400).json({
        code: err.message,
        message: err.message === 'MUST_BE_REGISTERED' ? '游客账号无法绑定两步验证，请先升级为正式账号' : '生成两步验证密钥失败'
      });
    }
  });

  /**
   * POST /api/auth/2fa/enable
   * 提交 6 位验证码确认激活两步验证
   * Body: { code: string }
   */
  router.post('/2fa/enable', requireAuth, async (req, res) => {
    try {
      const { code } = req.body || {};
      const safeUser = await userStore.enableTwoFactor(req.user.userId, code);
      return res.json({
        code: 'SUCCESS',
        message: '两步验证已成功激活启用',
        data: { user: safeUser }
      });
    } catch (err) {
      return res.status(400).json({
        code: err.message,
        message: err.message === 'INVALID_2FA_CODE' ? '动态验证码不正确，请确保手机时间已同步' : '激活两步验证失败'
      });
    }
  });

  /**
   * POST /api/auth/2fa/disable
   * 关闭两步验证
   * Body: { codeOrPassword: string }
   */
  router.post('/2fa/disable', requireAuth, async (req, res) => {
    try {
      const { codeOrPassword } = req.body || {};
      const safeUser = await userStore.disableTwoFactor(req.user.userId, codeOrPassword);
      return res.json({
        code: 'SUCCESS',
        message: '两步验证已成功关闭',
        data: { user: safeUser }
      });
    } catch (err) {
      return res.status(400).json({
        code: err.message,
        message: '验证失败，请输入正确的 6 位动态验证码或登录密码'
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
