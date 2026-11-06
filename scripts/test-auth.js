import { userStore } from '../src/services/userStore.js';
import assert from 'assert';

async function testUserStore() {
  console.log('🧪 开始测试 UserStore 渐进式认证流程...');

  // 1. 无感游客创建 (使用随机 deviceId 确保测试隔离)
  const deviceA = 'device_test_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const guest1 = await userStore.getOrCreateGuestUser(deviceA, '测试游客A');
  assert(guest1.user, '游客用户应成功创建');
  assert(guest1.user.authType === 'guest', '初始身份应为 guest');
  assert(guest1.token, '应下发有效 Token');
  console.log('✅ 测试通过: 首次设备访问成功无感建号, UserId:', guest1.user.userId);

  // 2. 相同设备二次访问恢复
  const guest2 = await userStore.getOrCreateGuestUser(deviceA);
  assert.strictEqual(guest2.user.userId, guest1.user.userId, '相同设备应能自动识别同一游客');
  assert(!guest2.isNew, '二次访问不应是新用户');
  console.log('✅ 测试通过: 相同设备二次免密恢复');

  // 3. Token 校验
  const payload = userStore.verifyToken(guest2.token);
  assert(payload && payload.userId === guest1.user.userId, 'Token 应正确验签');
  console.log('✅ 测试通过: HMAC-SHA256 Token 签名与常量时间校验');

  // 4. 游客升级转正 (Bind)
  const uniqueEmail = `test_player_${Date.now()}@example.com`;
  const bindRes = await userStore.bindAccount(guest1.user.userId, {
    identifier: uniqueEmail,
    password: 'password_123456',
    username: '荣耀王者'
  });
  assert.strictEqual(bindRes.user.authType, 'registered', '升级后身份应为 registered');
  assert.strictEqual(bindRes.user.boundIdentifier, uniqueEmail);
  console.log('✅ 测试通过: 游客一键转正升级');

  // 5. 使用正式凭证跨设备登录 (Login)
  const loginRes = await userStore.loginWithCredentials(uniqueEmail, 'password_123456');
  assert.strictEqual(loginRes.user.userId, guest1.user.userId, '登录应返回相同的权威 UserID');
  console.log('✅ 测试通过: 正式账号密码登录与多端漫游');

  // 6. 密码错误测试
  let caught = false;
  try {
    await userStore.loginWithCredentials(uniqueEmail, 'wrong_password');
  } catch (err) {
    caught = true;
  }
  assert(caught, '密码错误时应拒绝认证');
  console.log('✅ 测试通过: 密码错误安全拦截');

  console.log('🎉 所有渐进式认证单元测试全部通过！');
}

testUserStore().catch(err => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
