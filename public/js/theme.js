/**
 * GCP LiveHub 主题引擎与装扮管理器 (ThemeManager)
 * 采用注册表模式驱动，解耦视图表现与底层状态
 */

import { THEME_MANIFESTS, DEFAULT_THEME_ID } from './themes.js';

const STORAGE_THEME_KEY = 'livehub_theme_preference';

class ThemeManager {
  constructor() {
    this.manifests = new Map(Object.entries(THEME_MANIFESTS));
    this.preference = localStorage.getItem(STORAGE_THEME_KEY) || DEFAULT_THEME_ID;
    this.systemMediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    this.boundSystemListener = this.handleSystemChange.bind(this);
    this.listeners = new Set();
  }

  init() {
    // 监听系统色彩偏好变更
    if (this.systemMediaQuery.addEventListener) {
      this.systemMediaQuery.addEventListener('change', this.boundSystemListener);
    } else if (this.systemMediaQuery.addListener) {
      this.systemMediaQuery.addListener(this.boundSystemListener);
    }

    // 初次生效当前主题
    this.applyCurrent();
  }

  /**
   * 获取解析后的实际生效主题 ID
   */
  getResolvedThemeId() {
    if (this.preference === 'system') {
      return this.systemMediaQuery.matches ? 'nordic-clean' : 'cyber-slate';
    }
    return this.manifests.has(this.preference) ? this.preference : DEFAULT_THEME_ID;
  }

  /**
   * 获取当前用户配置的主题选项 ('cyber-slate' | 'nordic-clean' | 'midnight-oled' | 'system')
   */
  getPreference() {
    return this.preference;
  }

  /**
   * 获取所有已注册主题清单列表（供装扮中心展示）
   */
  getAllThemes() {
    return Array.from(this.manifests.values());
  }

  /**
   * 注册扩展主题（未来可通过 JSON 加载插件主题）
   */
  registerTheme(manifest) {
    if (!manifest || !manifest.id || !manifest.tokens) {
      console.warn('注册无效主题包，缺少必要属性:', manifest);
      return;
    }
    this.manifests.set(manifest.id, manifest);
  }

  /**
   * 设置并应用新主题偏好
   */
  setTheme(themeId) {
    if (themeId !== 'system' && !this.manifests.has(themeId)) {
      console.warn(`未知主题标识: ${themeId}，回退至默认主题`);
      themeId = DEFAULT_THEME_ID;
    }

    this.preference = themeId;
    try {
      localStorage.setItem(STORAGE_THEME_KEY, themeId);
    } catch (err) {
      console.warn('保存主题偏好至本地存储失败:', err);
    }

    this.applyCurrent();
  }

  /**
   * 应用当前解析出的主题到 DOM
   */
  applyCurrent() {
    const resolvedId = this.getResolvedThemeId();
    const manifest = this.manifests.get(resolvedId) || this.manifests.get(DEFAULT_THEME_ID);
    const root = document.documentElement;

    // 1. 设置根属性
    root.setAttribute('data-theme', resolvedId);
    root.setAttribute('data-theme-type', manifest.type || 'dark');

    // 2. 批量注水 CSS 变量 (保证即便外部定义的新主题也能动态生效)
    if (manifest.tokens) {
      Object.entries(manifest.tokens).forEach(([tokenKey, tokenValue]) => {
        root.style.setProperty(tokenKey, tokenValue);
      });
    }

    // 3. 动态更新移动端宿主顶部状态栏色
    this.updateMetaThemeColor(manifest.tokens['--meta-theme-color'] || (manifest.type === 'light' ? '#f1f5f9' : '#0f172a'));

    // 4. 派发全局自定义事件，通知白板和游戏画布更新
    const eventDetail = {
      preference: this.preference,
      resolvedId,
      manifest,
      isDark: manifest.type === 'dark'
    };

    window.dispatchEvent(new CustomEvent('livehub:theme-changed', { detail: eventDetail }));
    this.listeners.forEach(cb => {
      try {
        cb(eventDetail);
      } catch (err) {
        console.error('主题变更回调执行异常:', err);
      }
    });
  }

  /**
   * 订阅主题变更事件
   */
  onThemeChanged(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * 响应系统偏好变更
   */
  handleSystemChange() {
    if (this.preference === 'system') {
      this.applyCurrent();
    }
  }

  /**
   * 同步更新 <meta name="theme-color">
   */
  updateMetaThemeColor(color) {
    let metaTag = document.querySelector('meta[name="theme-color"]');
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.setAttribute('name', 'theme-color');
      document.head.appendChild(metaTag);
    }
    metaTag.setAttribute('content', color);
  }
}

export const themeManager = new ThemeManager();

/**
 * 初始化前端主题切换器与装扮中心交互
 */
export function initThemeUI(manager = themeManager) {
  const segmentBtns = document.querySelectorAll('.theme-segment-btn');
  const cosmeticsModal = document.getElementById('cosmeticsHubModal');
  const openModalBtn = document.getElementById('openCosmeticsHubBtn');
  const closeModalBtn = document.getElementById('closeCosmeticsHubBtn');
  const confirmModalBtn = document.getElementById('confirmCosmeticsBtn');
  const themesGrid = document.getElementById('cosmeticsThemesGrid');

  function updateSegmentUI(preference) {
    segmentBtns.forEach(btn => {
      const themeId = btn.getAttribute('data-theme-id');
      btn.classList.toggle('active', themeId === preference);
    });
  }

  function renderCosmeticsGrid() {
    if (!themesGrid) return;
    const allThemes = manager.getAllThemes();
    const currentPreference = manager.getPreference();

    themesGrid.innerHTML = '';
    allThemes.forEach(manifest => {
      const card = document.createElement('div');
      card.className = `cosmetics-theme-card ${manifest.id === currentPreference ? 'active' : ''}`;
      card.setAttribute('data-theme-id', manifest.id);

      const typeLabel = manifest.type === 'dark' ? '暗色极客' : '纸感明亮';
      const bgApp = manifest.tokens['--bg-app'] || '#000';
      const bgSurface = manifest.tokens['--bg-surface'] || '#222';
      const accent = manifest.tokens['--accent-primary'] || '#38bdf8';

      card.innerHTML = `
        <div class="cosmetics-theme-header">
          <span class="cosmetics-theme-title">${manifest.name}</span>
          <span class="cosmetics-badge">${typeLabel}</span>
        </div>
        <div class="cosmetics-theme-tagline">${manifest.tagline || ''}</div>
        <div class="cosmetics-preview-palette">
          <div class="palette-swatch" style="background:${bgApp}" title="主背景色"></div>
          <div class="palette-swatch" style="background:${bgSurface}" title="卡片色"></div>
          <div class="palette-swatch" style="background:${accent}" title="主强调色"></div>
        </div>
      `;

      card.addEventListener('click', () => {
        manager.setTheme(manifest.id);
      });

      themesGrid.appendChild(card);
    });
  }

  // 绑定胶囊切换事件
  segmentBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTheme = btn.getAttribute('data-theme-id');
      if (targetTheme) {
        manager.setTheme(targetTheme);
      }
    });
  });

  // 打开装扮中心
  if (openModalBtn && cosmeticsModal) {
    openModalBtn.addEventListener('click', () => {
      renderCosmeticsGrid();
      cosmeticsModal.classList.remove('hidden');
    });
  }

  // 关闭装扮中心
  const closeModal = () => {
    if (cosmeticsModal) cosmeticsModal.classList.add('hidden');
  };

  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
  if (confirmModalBtn) confirmModalBtn.addEventListener('click', closeModal);
  if (cosmeticsModal) {
    cosmeticsModal.addEventListener('click', (e) => {
      if (e.target === cosmeticsModal) closeModal();
    });
  }

  // 监听主题全局同步
  manager.onThemeChanged(({ preference }) => {
    updateSegmentUI(preference);
    renderCosmeticsGrid();
  });

  // 初始化高亮
  updateSegmentUI(manager.getPreference());
}
