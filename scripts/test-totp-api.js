import http from 'http';
import assert from 'assert';
import { createApp } from '../src/app.js';
import { userStore } from '../src/services/userStore.js';
import { generateTOTP } from '../src/services/totpService.js';

async function testTOTPWorkflow() {
  console.log('🧪 开始测试 Google Authenticator (TOTP) 两步验证全链路...');

  const app = createApp(() => 0);
  const server = http.createServer(app);

  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // 1. 创建游客并升级绑定为正式账号
    const testDeviceId = 'totp_test_device_' + Date.now();
    const guest = await userStore.getOrCreateGuestUser(testDeviceId, '2FA测试员');
    const testEmail = `totp_user_${Date.now()}@example.com`;
    const testPassword = 'Password_2fa_999';

    const bindRes = await fetch(`${baseUrl}/api/auth/bind`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${guest.token}`
      },
      body: JSON.stringify({
        identifier: testEmail,
        password: testPassword,
        username: '极客安全官'
      })
    });
    assert.strictEqual(bindRes.status, 200);
    const bindData = await bindRes.json();
    let authToken = bindData.data.token;
    console.log('✅ 测试通过: 正式账号绑定完成');

    // 2. 初始登录 (未开启 2FA) 应直接成功
    const login1 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testEmail, password: testPassword })
    });
    assert.strictEqual(login1.status, 200);
    const login1Data = await login1.json();
    assert.strictEqual(login1Data.code, 'SUCCESS');
    assert(login1Data.data.token, '未开 2FA 时直接签发正式 Token');
    console.log('✅ 测试通过: 未开启 2FA 前凭据直接登录');

    // 3. 申请 2FA 设置 (Setup)
    const setupRes = await fetch(`${baseUrl}/api/auth/2fa/setup`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert.strictEqual(setupRes.status, 200);
    const setupData = await setupRes.json();
    assert(setupData.data.secret, '应返回 Base32 密钥');
    assert(setupData.data.qrCode.startsWith('data:image/png;base64,'), '应返回二维码 Data URL');
    assert(setupData.data.otpauthUri.startsWith('otpauth://totp/'), '应返回合规 OTPAuth URI');
    console.log('✅ 测试通过: POST /api/auth/2fa/setup 成功生成密钥与二维码');

    const secret = setupData.data.secret;

    // 4. 激活 2FA：错误验证码应拦截
    const enableFail = await fetch(`${baseUrl}/api/auth/2fa/enable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ code: '000000' })
    });
    assert.strictEqual(enableFail.status, 400);
    console.log('✅ 测试通过: 错误 2FA 验证码激活拦截');

    // 5. 激活 2FA：正确验证码激活
    const validCode = generateTOTP(secret);
    const enableSuccess = await fetch(`${baseUrl}/api/auth/2fa/enable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ code: validCode })
    });
    assert.strictEqual(enableSuccess.status, 200);
    const enableData = await enableSuccess.json();
    assert.strictEqual(enableData.data.user.twoFactorEnabled, true);
    console.log('✅ 测试通过: 正确 2FA 验证码成功激活');

    // 6. 开启 2FA 后的登录拦截挑战 (Challenge)
    const loginChallenge = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testEmail, password: testPassword })
    });
    assert.strictEqual(loginChallenge.status, 200);
    const challengeData = await loginChallenge.json();
    assert.strictEqual(challengeData.code, 'REQUIRES_2FA');
    assert(challengeData.data.tempToken, '应下发用于 2FA 挑战的短期凭证');
    console.log('✅ 测试通过: 开启 2FA 后登录触发挑战阻断');

    const tempToken = challengeData.data.tempToken;

    // 7. 提交错误的 2FA 动态码
    const verifyFail = await fetch(`${baseUrl}/api/auth/2fa/verify-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken, code: '999999' })
    });
    assert.strictEqual(verifyFail.status, 401);
    console.log('✅ 测试通过: 登录挑战阶段错误 2FA 码拦截');

    // 8. 提交正确的 2FA 动态码完成登录
    const currentCode = generateTOTP(secret);
    const verifySuccess = await fetch(`${baseUrl}/api/auth/2fa/verify-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken, code: currentCode })
    });
    assert.strictEqual(verifySuccess.status, 200);
    const verifyData = await verifySuccess.json();
    assert.strictEqual(verifyData.code, 'SUCCESS');
    assert(verifyData.data.token, '两步验证通过后成功签发长效 Token');
    console.log('✅ 测试通过: 2FA 验证码校验成功完成登录换发 Token');

    // 9. 关闭 2FA (使用主密码或当前动态码)
    const disableRes = await fetch(`${baseUrl}/api/auth/2fa/disable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${verifyData.data.token}`
      },
      body: JSON.stringify({ codeOrPassword: testPassword })
    });
    assert.strictEqual(disableRes.status, 200);
    const disableData = await disableRes.json();
    assert.strictEqual(disableData.data.user.twoFactorEnabled, false);
    console.log('✅ 测试通过: POST /api/auth/2fa/disable 成功关闭两步验证');

    console.log('🎉 Google Authenticator (TOTP) 全套流程测试全部通过！');
  } finally {
    server.close();
  }
}

testTOTPWorkflow().catch(err => {
  console.error('❌ TOTP 测试失败:', err);
  process.exit(1);
});
