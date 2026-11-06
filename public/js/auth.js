import { state } from './state.js';
import { dom } from './ui.js';

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
      if (!res.ok || json.code !== 'SUCCESS') {
        showError(dom.loginErrorMsg, json.message || '账号或密码错误');
        return;
      }

      const { user, token } = json.data;
      state.updateAuthSession({
        userId: user.userId,
        username: user.username,
        authType: user.authType,
        boundIdentifier: user.boundIdentifier,
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
    } catch (err) {
      showError(dom.loginErrorMsg, `网络请求失败: ${err.message}`);
    } finally {
      dom.loginSubmitBtn.disabled = false;
      dom.loginSubmitBtn.textContent = '登录并同步数据';
    }
  });
}

function syncModalView() {
  const isRegistered = state.user.authType === 'registered';
  if (isRegistered) {
    dom.authAlreadyBound?.classList.remove('hidden');
    dom.bindForm?.classList.add('hidden');
    dom.loginForm?.classList.add('hidden');
    if (dom.tabBtnBind) dom.tabBtnBind.style.display = 'none';
    if (dom.boundAccountText) {
      dom.boundAccountText.textContent = `已绑定账号: ${state.user.boundIdentifier || '保密'}`;
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
  if (dom.bindForm) dom.bindForm.reset();
  if (dom.loginForm) dom.loginForm.reset();
}
