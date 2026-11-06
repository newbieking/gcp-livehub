import crypto from 'crypto';
import QRCode from 'qrcode';

const RFC4648_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Base32 编码 (RFC 4648)
 * @param {Buffer} buffer 
 * @returns {string}
 */
export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += RFC4648_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += RFC4648_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Base32 解码 (RFC 4648)
 * @param {string} input 
 * @returns {Buffer}
 */
export function base32Decode(input) {
  const cleaned = (input || '').toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = RFC4648_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) {
      throw new Error(`非法 Base32 字符: ${cleaned[i]}`);
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * 生成符合安全强度的随机 TOTP Secret (Base32 格式，默认 20 字节 = 160 位熵)
 * @param {number} byteLength 
 * @returns {string}
 */
export function generateSecret(byteLength = 20) {
  return base32Encode(crypto.randomBytes(byteLength));
}

/**
 * 计算特定时间戳下的 6 位 TOTP 动态码 (RFC 6238)
 * @param {string} secretBase32 
 * @param {number} timestamp 
 * @returns {string} 6 位数字验证码
 */
export function generateTOTP(secretBase32, timestamp = Date.now()) {
  const key = base32Decode(secretBase32);
  const epoch = Math.floor(timestamp / 1000);
  const counter = Math.floor(epoch / 30);

  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter), 0);

  const hmac = crypto.createHmac('sha1', key);
  hmac.update(buf);
  const digest = hmac.digest();

  // 动态截断 Dynamic Truncation
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const code = binary % 1000000;
  return code.toString().padStart(6, '0');
}

/**
 * 校验 6 位 TOTP 验证码 (具备前后时钟漂移容差窗口)
 * @param {string} secretBase32 
 * @param {string} token 
 * @param {number} window 容差步数（默认 1，即容许 ±30 秒）
 * @param {number} timestamp 
 * @returns {boolean}
 */
export function verifyTOTP(secretBase32, token, window = 1, timestamp = Date.now()) {
  if (!token || typeof token !== 'string') return false;
  const cleanToken = token.trim();
  if (cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) return false;

  for (let errorWindow = -window; errorWindow <= window; errorWindow++) {
    const testTime = timestamp + errorWindow * 30 * 1000;
    const generated = generateTOTP(secretBase32, testTime);
    if (crypto.timingSafeEqual(Buffer.from(generated), Buffer.from(cleanToken))) {
      return true;
    }
  }
  return false;
}

/**
 * 生成标准 OTPAuth URI (可供 Google Authenticator, Microsoft Authenticator, 1Password 识别)
 * @param {Object} options
 * @param {string} options.secret
 * @param {string} options.accountName
 * @param {string} [options.issuer]
 * @returns {string}
 */
export function generateOtpAuthUri({ secret, accountName, issuer = 'GCP LiveHub' }) {
  const encIssuer = encodeURIComponent(issuer);
  const encAccount = encodeURIComponent(accountName);
  return `otpauth://totp/${encIssuer}:${encAccount}?secret=${secret}&issuer=${encIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * 将 OTPAuth URI 渲染为高清二维码 Base64 DataURL
 * @param {string} otpauthUri 
 * @returns {Promise<string>}
 */
export async function generateQRCodeDataUrl(otpauthUri) {
  return QRCode.toDataURL(otpauthUri, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 220,
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    }
  });
}
