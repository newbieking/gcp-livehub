import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';
import {
  generateSecret,
  generateTOTP,
  verifyTOTP,
  generateOtpAuthUri,
  generateQRCodeDataUrl
} from './totpService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 渐进式认证与用户持久化仓储 (Progressive User & Auth Store)
 * 遵循协议契约：纯 JSON 字典、强类型、Dart 序列化友好
 */
class UserStore {
  constructor() {
    this.users = new Map(); // userId -> userEntity
    this.deviceToUser = new Map(); // deviceId -> userId (用于游客快速定位)
    this.identifierToUser = new Map(); // boundIdentifier (如邮箱) -> userId

    this.dataPath = path.resolve(__dirname, '../../data/users.json');
    this.secret = config.auth?.secret || 'livehub-default-auth-secret';
    this.tokenExpiresMs = (config.auth?.tokenExpiresDays || 30) * 24 * 60 * 60 * 1000;

    this.initStore();
  }

  /**
   * 初始化并载入持久化数据
   */
  initStore() {
    try {
      const dir = path.dirname(this.dataPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.dataPath)) {
        const raw = fs.readFileSync(this.dataPath, 'utf-8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const user of list) {
            this.users.set(user.userId, user);
            if (user.deviceId) {
              this.deviceToUser.set(user.deviceId, user.userId);
            }
            if (user.boundIdentifier) {
              this.identifierToUser.set(user.boundIdentifier.toLowerCase(), user.userId);
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[UserStore] 初始化加载持久化数据失败，回退为空状态: ${err.message}`);
    }
  }

  /**
   * 将数据异步刷盘
   */
  async flushToDisk() {
    try {
      const list = Array.from(this.users.values());
      await fs.promises.writeFile(this.dataPath, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.error(`[UserStore] 刷盘持久化用户数据失败: ${err.message}`);
    }
  }

  /**
   * 轻量安全的 Base64URL 编码
   */
  base64UrlEncode(str) {
    return Buffer.from(str)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  /**
   * Base64URL 解码
   */
  base64UrlDecode(str) {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return Buffer.from(base64, 'base64').toString('utf-8');
  }

  /**
   * 签发轻量安全 HMAC-SHA256 Token
   * @param {Object} payload 
   * @returns {string} token
   */
  signToken(payload) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const content = `${encodedHeader}.${encodedPayload}`;

    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(content)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    return `${content}.${signature}`;
  }

  /**
   * 验证 HMAC-SHA256 Token
   * @param {string} token 
   * @returns {Object|null} payload
   */
  verifyToken(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const content = `${encodedHeader}.${encodedPayload}`;

    const expectedSig = crypto
      .createHmac('sha256', this.secret)
      .update(content)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    // 采用常量时间比较抵御时序攻击
    if (signature.length !== expectedSig.length) return null;
    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSig);
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    try {
      const payload = JSON.parse(this.base64UrlDecode(encodedPayload));
      if (payload.exp && Date.now() > payload.exp) {
        return null; // 过期
      }
      return payload;
    } catch {
      return null;
    }
  }

  /**
   * 生成对外安全的纯净用户信息（过滤密码散列与盐）
   * 对齐 Dart Model 字段
   */
  toSafeUser(user) {
    if (!user) return null;
    return {
      userId: user.userId,
      username: user.username,
      authType: user.authType, // 'guest' | 'registered'
      boundIdentifier: user.boundIdentifier || null,
      twoFactorEnabled: !!user.twoFactorEnabled,
      createdAt: user.createdAt
    };
  }

  /**
   * 通过 Token 获取用户
   */
  getUserByToken(token) {
    const payload = this.verifyToken(token);
    if (!payload || !payload.userId) return null;
    return this.users.get(payload.userId) || null;
  }

  /**
   * 通过 ID 获取用户
   */
  getUserById(userId) {
    return this.users.get(userId) || null;
  }

  /**
   * 无感建号 / 游客身份恢复
   * @param {string} deviceId 客户端持久设备凭据
   * @param {string} [preferredUsername] 可选期望昵称
   * @returns {Promise<{ user: Object, token: string, isNew: boolean }>}
   */
  async getOrCreateGuestUser(deviceId, preferredUsername = null) {
    const cleanDeviceId = (deviceId || '').trim();
    const existingUserId = cleanDeviceId ? this.deviceToUser.get(cleanDeviceId) : null;

    if (existingUserId && this.users.has(existingUserId)) {
      const existingUser = this.users.get(existingUserId);
      existingUser.updatedAt = Date.now();

      // 签发新有效期的 Token
      const token = this.signToken({
        userId: existingUser.userId,
        deviceId: cleanDeviceId,
        exp: Date.now() + this.tokenExpiresMs
      });

      return {
        user: this.toSafeUser(existingUser),
        token,
        isNew: false
      };
    }

    // 创建全新游客账号
    const newUserId = 'u_' + crypto.randomBytes(4).toString('hex');
    const defaultUsername = (preferredUsername && preferredUsername.trim()) 
      ? preferredUsername.trim().slice(0, 20)
      : `游客_${Math.floor(100 + Math.random() * 900)}`;

    const newUser = {
      userId: newUserId,
      username: defaultUsername,
      authType: 'guest',
      deviceId: cleanDeviceId || crypto.randomUUID(),
      boundIdentifier: null,
      passwordHash: null,
      salt: null,
      twoFactorEnabled: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.users.set(newUserId, newUser);
    if (newUser.deviceId) {
      this.deviceToUser.set(newUser.deviceId, newUserId);
    }

    await this.flushToDisk();

    const token = this.signToken({
      userId: newUser.userId,
      deviceId: newUser.deviceId,
      exp: Date.now() + this.tokenExpiresMs
    });

    return {
      user: this.toSafeUser(newUser),
      token,
      isNew: true
    };
  }

  /**
   * 密码安全加盐散列 (基于 scrypt)
   */
  hashPassword(password, salt = null) {
    const effectiveSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, effectiveSalt, 64).toString('hex');
    return { hash, salt: effectiveSalt };
  }

  /**
   * 校验密码
   */
  verifyPassword(password, storedHash, salt) {
    if (!password || !storedHash || !salt) return false;
    const { hash } = this.hashPassword(password, salt);
    const hashBuf = Buffer.from(hash);
    const storedBuf = Buffer.from(storedHash);
    if (hashBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(hashBuf, storedBuf);
  }

  /**
   * 绑定账号：游客转正 (Progressive Bind)
   */
  async bindAccount(userId, { identifier, password, username }) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    const cleanIdentifier = (identifier || '').trim().toLowerCase();
    if (!cleanIdentifier || cleanIdentifier.length < 3) {
      throw new Error('INVALID_IDENTIFIER');
    }

    if (!password || password.length < 6) {
      throw new Error('PASSWORD_TOO_SHORT');
    }

    // 检查标识（如邮箱/用户名）是否已被占用
    const existingUserId = this.identifierToUser.get(cleanIdentifier);
    if (existingUserId && existingUserId !== userId) {
      throw new Error('IDENTIFIER_ALREADY_EXISTS');
    }

    // 更新用户凭证
    const { hash, salt } = this.hashPassword(password);
    user.boundIdentifier = cleanIdentifier;
    user.passwordHash = hash;
    user.salt = salt;
    user.authType = 'registered';
    if (username && username.trim()) {
      user.username = username.trim().slice(0, 20);
    }
    user.updatedAt = Date.now();

    this.identifierToUser.set(cleanIdentifier, userId);
    await this.flushToDisk();

    // 签发正式 Token
    const token = this.signToken({
      userId: user.userId,
      deviceId: user.deviceId,
      exp: Date.now() + this.tokenExpiresMs
    });

    return {
      user: this.toSafeUser(user),
      token
    };
  }

  /**
   * 已有正式账号凭据登录 (多端漫游或切换账号)
   * 若启用了 2FA，签发短期 2FA_CHALLENGE Token 阻断直接登录
   */
  async loginWithCredentials(identifier, password) {
    const cleanIdentifier = (identifier || '').trim().toLowerCase();
    const userId = this.identifierToUser.get(cleanIdentifier);
    if (!userId || !this.users.has(userId)) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const user = this.users.get(userId);
    const isValid = this.verifyPassword(password, user.passwordHash, user.salt);
    if (!isValid) {
      throw new Error('INVALID_CREDENTIALS');
    }

    user.updatedAt = Date.now();
    await this.flushToDisk();

    // 若启用了 2FA，返回两步验证挑战与短期凭据 (5分钟有效)
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      const tempToken = this.signToken({
        userId: user.userId,
        stage: '2FA_CHALLENGE',
        exp: Date.now() + 5 * 60 * 1000
      });

      return {
        requires2FA: true,
        tempToken,
        user: this.toSafeUser(user)
      };
    }

    const token = this.signToken({
      userId: user.userId,
      deviceId: user.deviceId,
      exp: Date.now() + this.tokenExpiresMs
    });

    return {
      requires2FA: false,
      user: this.toSafeUser(user),
      token
    };
  }

  /**
   * 登录阶段提交 6 位 TOTP 动态码完成最终验证
   */
  async verifyLoginTwoFactor(tempToken, code) {
    const payload = this.verifyToken(tempToken);
    if (!payload || !payload.userId || payload.stage !== '2FA_CHALLENGE') {
      throw new Error('INVALID_CHALLENGE_TOKEN');
    }

    const user = this.users.get(payload.userId);
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new Error('2FA_NOT_ENABLED');
    }

    const isValid = verifyTOTP(user.twoFactorSecret, code);
    if (!isValid) {
      throw new Error('INVALID_2FA_CODE');
    }

    user.updatedAt = Date.now();
    await this.flushToDisk();

    const token = this.signToken({
      userId: user.userId,
      deviceId: user.deviceId,
      exp: Date.now() + this.tokenExpiresMs
    });

    return {
      user: this.toSafeUser(user),
      token
    };
  }

  /**
   * 准备开启 2FA：生成临时 Secret、OTPAuth URI 与二维码
   */
  async prepareTwoFactor(userId) {
    const user = this.users.get(userId);
    if (!user) throw new Error('USER_NOT_FOUND');
    if (user.authType !== 'registered') throw new Error('MUST_BE_REGISTERED');

    const secret = generateSecret();
    user.tempTwoFactorSecret = secret;
    user.updatedAt = Date.now();
    await this.flushToDisk();

    const accountName = user.boundIdentifier || user.username || user.userId;
    const otpauthUri = generateOtpAuthUri({
      secret,
      accountName,
      issuer: 'GCP LiveHub'
    });

    const qrCode = await generateQRCodeDataUrl(otpauthUri);

    return {
      secret,
      otpauthUri,
      qrCode
    };
  }

  /**
   * 提交 6 位动态验证码激活 2FA
   */
  async enableTwoFactor(userId, code) {
    const user = this.users.get(userId);
    if (!user) throw new Error('USER_NOT_FOUND');
    if (!user.tempTwoFactorSecret) throw new Error('NO_PENDING_2FA');

    const isValid = verifyTOTP(user.tempTwoFactorSecret, code);
    if (!isValid) {
      throw new Error('INVALID_2FA_CODE');
    }

    user.twoFactorSecret = user.tempTwoFactorSecret;
    user.tempTwoFactorSecret = null;
    user.twoFactorEnabled = true;
    user.updatedAt = Date.now();
    await this.flushToDisk();

    return this.toSafeUser(user);
  }

  /**
   * 关闭 2FA (需校验动态验证码或主密码)
   */
  async disableTwoFactor(userId, codeOrPassword) {
    const user = this.users.get(userId);
    if (!user) throw new Error('USER_NOT_FOUND');
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new Error('2FA_NOT_ENABLED');
    }

    const isCodeValid = verifyTOTP(user.twoFactorSecret, codeOrPassword);
    const isPasswordValid = user.passwordHash
      ? this.verifyPassword(codeOrPassword, user.passwordHash, user.salt)
      : false;

    if (!isCodeValid && !isPasswordValid) {
      throw new Error('INVALID_CREDENTIALS');
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.tempTwoFactorSecret = null;
    user.updatedAt = Date.now();
    await this.flushToDisk();

    return this.toSafeUser(user);
  }

  /**
   * 更新用户基础信息 (如昵称)
   */
  async updateUserProfile(userId, { username }) {
    const user = this.users.get(userId);
    if (!user) return null;

    if (username) {
      user.username = username.trim().slice(0, 20);
    }
    user.updatedAt = Date.now();
    await this.flushToDisk();

    return this.toSafeUser(user);
  }
}

export const userStore = new UserStore();
