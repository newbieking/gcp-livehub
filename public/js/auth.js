import { state } from './state.js';
import { dom } from './ui.js';

let pending2FAToken = null;

/**
 * 渐进式认证前端交互与网络控制器 (Progressive Auth Controller)
 */
export function initAuthManager(socket) {
  if (!dom.authModal) return;

  // 1. 打开认证模态弹窗
  dom.openAuthModalBtn?.addEventListener('click', () => {
    resetAuthForms();
    syncModalView();
    dom.authModal.classList.remove('hidden');
  });

  // 2. 关闭弹窗
  dom.closeAuthModalBtn?.addEventListener('click', () => {
    dom.authModal.classList.add('hidden');
  });

  dom.authModal.addEventListener('click', (e) => {
    if (e.target === dom.authModal) {
      dom.authModal.classList.add('hidden');
    }
  });

  // 3. Tab 切换
  dom.tabBtnBind?.addEventListener('click', () => {
    switchTab('bind');
  });

  dom.tabBtnLogin?.addEventListener('click', () => {
    switchTab('login');
  });

  // 4. 提交升级绑定当前游客表单
  dom.bindForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideErrors();

    const identifier = dom.bindIdentifierInput.value.trim();
    const password = dom.bindPasswordInput.value;

    if (!identifier || !password) return;

    dom.bindSubmitBtn.disabled = true;
    dom.bindSubmitBtn.textContent = '正在升级...';

    try {
      const res = await fetch('/api/auth/bind', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.user.token || ''}`
        },
        body: JSON.stringify({
          identifier,
          password,
          username: state.user.username
        })
      });

      const json = await res.json();
      if (!res.ok || json.code !== 'SUCCESS') {
        showError(dom.bindErrorMsg, json.message || '绑定失败，请稍后重试');
        return;
      }

      // 升级成功，权威更新会话
      const { user, token } = json.data;
      state.updateAuthSession({
        userId: user.userId,
        username: user.username,
        authType: user.authType,
        boundIdentifier: user.boundIdentifier,
        twoFactorEnabled: !!user.twoFactorEnabled,
        token
      });

      // 实时向长连接发送 auth:refresh 携带最新 Token，实现无感热刷新（无需 F5 刷新页面）
      socket.auth = {
        token,
        deviceId: state.user.deviceId,
        username: user.username
      };
      socket.emit('auth:refresh', { token });

      // 立即刷新弹窗内部视图状态并展示成功提示
      syncModalView();
      showSuccessNotice('🎉 恭喜！已成功升级为正式账号，您的对战战绩与好友聊天记录已完整持久化。');
      setTimeout(() => {
        dom.authModal.classList.add('hidden');
      }, 1200);
    } catch (err) {
      showError(dom.bindErrorMsg, `网络请求失败: ${err.message}`);
    } finally {
      dom.bindSubmitBtn.disabled = false;
      dom.bindSubmitBtn.textContent = '立即升级转正';
    }
  });

  // 5. 提交已有账号登录表单
  dom.loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideErrors();

    const identifier = dom.loginIdentifierInput.value.trim();
    const password = dom.loginPasswordInput.value;

    if (!identifier || !password) return;

    dom.loginSubmitBtn.disabled = true;
    dom.loginSubmitBtn.textContent = '正在登录...';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ identifier, password })
      });

      const json = await res.json();
      if (!res.ok) {
        showError(dom.loginErrorMsg, json.message || '账号或密码错误');
        return;
      }

      // 若检测到该账号启用了两步验证 (2FA)，进入挑战态
      if (json.code === 'REQUIRES_2FA') {
        pending2FAToken = json.data.tempToken;
        dom.loginCredentialsFields?.classList.add('hidden');
        dom.login2FAChallenge?.classList.remove('hidden');
        if (dom.login2FACodeInput) {
          dom.login2FACodeInput.value = '';
          dom.login2FACodeInput.focus();
        }
        return;
      }

      if (json.code !== 'SUCCESS') {
        showError(dom.loginErrorMsg, json.message || '登录失败');
        return;
      }

      const { user, token } = json.data;
      handleLoginSuccess(user, token, socket);
    } catch (err) {
      showError(dom.loginErrorMsg, `网络请求失败: ${err.message}`);
    } finally {
      dom.loginSubmitBtn.disabled = false;
      dom.loginSubmitBtn.textContent = '登录并同步数据';
    }
  });

  // 6. 提交 2FA 两步验证动态码完成登录
  dom.login2FASubmitBtn?.addEventListener('click', async () => {
    hideErrors();
    const code = (dom.login2FACodeInput?.value || '').trim();
    if (!code || code.length !== 6) {
      showError(dom.login2FAErrorMsg, '请输入 6 位动态验证码');
      return;
    }

    if (!pending2FAToken) {
      showError(dom.login2FAErrorMsg, '验证状态已失效，请重新输入密码登录');
      return;
    }

    dom.login2FASubmitBtn.disabled = true;
    dom.login2FASubmitBtn.textContent = '验证中...';

    try {
      const res = await fetch('/api/auth/2fa/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken: pending2FAToken, code })
      });

      const json = await res.json();
      if (!res.ok || json.code !== 'SUCCESS') {
        showError(dom.login2FAErrorMsg, json.message || '动态验证码错误');
        return;
      }

      const { user, token } = json.data;
      pending2FAToken = null;
      handleLoginSuccess(user, token, socket);
    } catch (err) {
      showError(dom.login2FAErrorMsg, `验证请求异常: ${err.message}`);
    } finally {
      dom.login2FASubmitBtn.disabled = false;
      dom.login2FASubmitBtn.textContent = '验证并完成登录';
    }
  });

  // 取消 2FA 挑战，返回重新输入密码
  dom.cancel2FALoginBtn?.addEventListener('click', () => {
    pending2FAToken = null;
    hideErrors();
    dom.login2FAChallenge?.classList.add('hidden');
    dom.loginCredentialsFields?.classList.remove('hidden');
  });

  // 7. 打开 2FA 绑定向导面板
  dom.open2FASetupBtn?.addEventListener('click', async () => {
    hideErrors();
    dom.open2FASetupBtn.disabled = true;
    dom.open2FASetupBtn.textContent = '正在生成...';

    try {
      const res = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${state.user.token || ''}`
        }
      });

      const json = await res.json();
      if (!res.ok || json.code !== 'SUCCESS') {
        alert(json.message || '生成两步验证密钥失败');
        return;
      }

      const { secret, qrCode } = json.data;
      if (dom.twoFactorQrCodeImg) dom.twoFactorQrCodeImg.src = qrCode;
      if (dom.twoFactorSecretCode) dom.twoFactorSecretCode.textContent = secret;
      if (dom.twoFactorSetupCodeInput) dom.twoFactorSetupCodeInput.value = '';

      dom.authAlreadyBound?.classList.add('hidden');
      dom.twoFactorSetupView?.classList.remove('hidden');
    } catch (err) {
      alert(`网络异常: ${err.message}`);
    } finally {
      dom.open2FASetupBtn.disabled = false;
      dom.open2FASetupBtn.textContent = '开启两步验证';
    }
  });

  // 返回账号设置面板
  dom.backFrom2FASetupBtn?.addEventListener('click', () => {
    dom.twoFactorSetupView?.classList.add('hidden');
    dom.authAlreadyBound?.classList.remove('hidden');
  });

  // 复制 2FA 密钥文本
  dom.copy2FASecretBtn?.addEventListener('click', () => {
    const text = dom.twoFactorSecretCode?.textContent;
    if (!text || text === '--') return;
    navigator.clipboard?.writeText(text).then(() => {
      dom.copy2FASecretBtn.textContent = '已复制！';
      setTimeout(() => {
        if (dom.copy2FASecretBtn) dom.copy2FASecretBtn.textContent = '复制';
      }, 1500);
    });
  });

  // 提交并激活 2FA
  dom.confirmEnable2FABtn?.addEventListener('click', async () => {
    hideErrors();
    const code = (dom.twoFactorSetupCodeInput?.value || '').trim();
    if (!code || code.length !== 6) {
      showError(dom.twoFactorSetupErrorMsg, '请输入 6 位动态验证码');
      return;
    }

    dom.confirmEnable2FABtn.disabled = true;
    dom.confirmEnable2FABtn.textContent = '激活中...';

    try {
      const res = await fetch('/api/auth/2fa/enable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.user.token || ''}`
        },
        body: JSON.stringify({ code })
      });

      const json = await res.json();
      if (!res.ok || json.code !== 'SUCCESS') {
        showError(dom.twoFactorSetupErrorMsg, json.message || '激活失败，请检查验证码');
        return;
      }

      state.updateAuthSession({
        twoFactorEnabled: true
      });

      dom.twoFactorSetupView?.classList.add('hidden');
      dom.authAlreadyBound?.classList.remove('hidden');
      syncModalView();
      showSuccessNotice('🛡️ 两步验证 (TOTP / 身份验证器) 已成功开启，您的账号已获得金融级防护！');
    } catch (err) {
      showError(dom.twoFactorSetupErrorMsg, `网络请求异常: ${err.message}`);
    } finally {
      dom.confirmEnable2FABtn.disabled = false;
      dom.confirmEnable2FABtn.textContent = '确认并激活两步验证';
    }
  });

  // 关闭 2FA
  dom.disable2FABtn?.addEventListener('click', async () => {
    const codeOrPassword = prompt('为了安全，请输入身份验证器 6 位动态验证码或您的登录密码以关闭两步验证:');
    if (!codeOrPassword || !codeOrPassword.trim()) return;

    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.user.token || ''}`
        },
        body: JSON.stringify({ codeOrPassword: codeOrPassword.trim() })
      });

      const json = await res.json();
      if (!res.ok || json.code !== 'SUCCESS') {
        alert(json.message || '关闭两步验证失败');
        return;
      }

      state.updateAuthSession({
        twoFactorEnabled: false
      });

      syncModalView();
      showSuccessNotice('两步验证已关闭。');
    } catch (err) {
      alert(`请求异常: ${err.message}`);
    }
  });
}

function handleLoginSuccess(user, token, socket) {
  state.updateAuthSession({
    userId: user.userId,
    username: user.username,
    authType: user.authType,
    boundIdentifier: user.boundIdentifier,
    twoFactorEnabled: !!user.twoFactorEnabled,
    token
  });

  // 重新鉴权并无感刷新
  socket.auth = {
    token,
    deviceId: state.user.deviceId,
    username: user.username
  };
  socket.emit('auth:refresh', { token });

  syncModalView();
  showSuccessNotice(`✅ 登录成功！已无感切换至正式账号【${user.username}】`);
  setTimeout(() => {
    dom.authModal.classList.add('hidden');
  }, 1200);
}

function syncModalView() {
  const isRegistered = state.user.authType === 'registered';
  dom.twoFactorSetupView?.classList.add('hidden');

  if (isRegistered) {
    dom.authAlreadyBound?.classList.remove('hidden');
    dom.bindForm?.classList.add('hidden');
    dom.loginForm?.classList.add('hidden');
    if (dom.tabBtnBind) dom.tabBtnBind.style.display = 'none';
    if (dom.boundAccountText) {
      dom.boundAccountText.textContent = `已绑定账号: ${state.user.boundIdentifier || '保密'}`;
    }

    // 2FA 状态刷新
    if (dom.twoFactorStatusBadge) {
      if (state.user.twoFactorEnabled) {
        dom.twoFactorStatusBadge.textContent = '已开启 (安全)';
        dom.twoFactorStatusBadge.className = 'security-status-badge on';
        dom.open2FASetupBtn?.classList.add('hidden');
        dom.disable2FABtn?.classList.remove('hidden');
      } else {
        dom.twoFactorStatusBadge.textContent = '未开启';
        dom.twoFactorStatusBadge.className = 'security-status-badge off';
        dom.open2FASetupBtn?.classList.remove('hidden');
        dom.disable2FABtn?.classList.add('hidden');
      }
    }

    dom.tabBtnLogin?.classList.add('active');
  } else {
    dom.authAlreadyBound?.classList.add('hidden');
    if (dom.tabBtnBind) dom.tabBtnBind.style.display = 'block';
    switchTab('bind');
  }
}

function switchTab(tab) {
  hideErrors();
  dom.twoFactorSetupView?.classList.add('hidden');
  if (tab === 'bind') {
    dom.tabBtnBind?.classList.add('active');
    dom.tabBtnLogin?.classList.remove('active');
    dom.bindForm?.classList.remove('hidden');
    dom.loginForm?.classList.add('hidden');
    dom.authAlreadyBound?.classList.add('hidden');
  } else {
    dom.tabBtnLogin?.classList.add('active');
    dom.tabBtnBind?.classList.remove('active');
    dom.loginForm?.classList.remove('hidden');
    dom.bindForm?.classList.add('hidden');
    dom.authAlreadyBound?.classList.add('hidden');

    // 恢复常规账号密码输入视图
    dom.login2FAChallenge?.classList.add('hidden');
    dom.loginCredentialsFields?.classList.remove('hidden');
  }
}

function hideErrors() {
  if (dom.authSuccessMsg) {
    dom.authSuccessMsg.classList.add('hidden');
    dom.authSuccessMsg.textContent = '';
  }
  if (dom.bindErrorMsg) {
    dom.bindErrorMsg.classList.add('hidden');
    dom.bindErrorMsg.textContent = '';
  }
  if (dom.loginErrorMsg) {
    dom.loginErrorMsg.classList.add('hidden');
    dom.loginErrorMsg.textContent = '';
  }
  if (dom.login2FAErrorMsg) {
    dom.login2FAErrorMsg.classList.add('hidden');
    dom.login2FAErrorMsg.textContent = '';
  }
  if (dom.twoFactorSetupErrorMsg) {
    dom.twoFactorSetupErrorMsg.classList.add('hidden');
    dom.twoFactorSetupErrorMsg.textContent = '';
  }
}

function showSuccessNotice(msg) {
  if (dom.authSuccessMsg) {
    dom.authSuccessMsg.textContent = msg;
    dom.authSuccessMsg.classList.remove('hidden');
  }
}

function showError(el, msg) {
  if (el) {
    el.textContent = msg;
    el.classList.remove('hidden');
  }
}

function resetAuthForms() {
  hideErrors();
  pending2FAToken = null;
  if (dom.bindForm) dom.bindForm.reset();
  if (dom.loginForm) dom.loginForm.reset();
  dom.login2FAChallenge?.classList.add('hidden');
  dom.loginCredentialsFields?.classList.remove('hidden');
  dom.twoFactorSetupView?.classList.add('hidden');
}

