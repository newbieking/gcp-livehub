import http from 'http';
import assert from 'assert';
import { createApp } from '../src/app.js';
import { userStore } from '../src/services/userStore.js';

async function testAuthApi() {
  console.log('🧪 开始测试 Auth RESTful API...');

  const app = createApp(() => 0);
  const server = http.createServer(app);

  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // 1. 创建游客并获取 Token
    const testDeviceId = 'api_test_device_' + Date.now();
    const guest = await userStore.getOrCreateGuestUser(testDeviceId, 'API测试员');

    // 2. GET /api/auth/me 携带有效 Token
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${guest.token}` }
    });
    assert.strictEqual(meRes.status, 200);
    const meData = await meRes.json();
    assert.strictEqual(meData.data.user.userId, guest.user.userId);
    console.log('✅ 测试通过: GET /api/auth/me 鉴权成功');

    // 3. POST /api/auth/bind 升级绑定
    const testEmail = `api_player_${Date.now()}@test.com`;
    const bindRes = await fetch(`${baseUrl}/api/auth/bind`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${guest.token}`
      },
      body: JSON.stringify({
        identifier: testEmail,
        password: 'password888',
        username: '云端VIP'
      })
    });
    assert.strictEqual(bindRes.status, 200);
    const bindData = await bindRes.json();
    assert.strictEqual(bindData.data.user.authType, 'registered');
    console.log('✅ 测试通过: POST /api/auth/bind 游客升级转正成功');

    // 4. POST /api/auth/login 正式账号登录
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testEmail,
        password: 'password888'
      })
    });
    assert.strictEqual(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.strictEqual(loginData.data.user.userId, guest.user.userId);
    assert(loginData.data.token, '应返回有效 Token');
    console.log('✅ 测试通过: POST /api/auth/login 账号登录成功');

    console.log('🎉 所有 Auth REST API 测试全部通过！');
  } finally {
    server.close();
  }
}

testAuthApi().catch(err => {
  console.error('❌ API 测试失败:', err);
  process.exit(1);
});
