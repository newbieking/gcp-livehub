/**
 * GCP LiveHub 架构级主题引擎与装扮管理器 (ThemeManager)
 * 具备四层解析模型：基础配色 -> 活动叠加层 -> 自选装扮 -> 无障碍覆盖
 */

import {
  THEME_MANIFESTS,
  DEFAULT_THEME_ID,
  SLOT_DEFINITIONS,
  COSMETIC_ITEMS,
  EVENT_COLLECTIONS
} from './themes.js';

const STORAGE_THEME_KEY = 'livehub_theme_preference';
const STORAGE_COSMETICS_KEY = 'livehub_equipped_cosmetics';
const STORAGE_SEASONAL_KEY = 'livehub_seasonal_decor';

class ThemeManager {
  constructor() {
    this.manifests = new Map(Object.entries(THEME_MANIFESTS));
    this.slots = SLOT_DEFINITIONS;
    this.items = COSMETIC_ITEMS;
    this.collections = EVENT_COLLECTIONS;

    this.preference = localStorage.getItem(STORAGE_THEME_KEY) || DEFAULT_THEME_ID;
    this.seasonalDecor = localStorage.getItem(STORAGE_SEASONAL_KEY) || 'auto'; // 'auto' | 'off'
    
    // 从本地存储恢复用户自选装备的装扮槽位
    let savedEquipped = {};
    try {
      savedEquipped = JSON.parse(localStorage.getItem(STORAGE_COSMETICS_KEY) || '{}');
    } catch (e) {
      savedEquipped = {};
    }
    this.equipped = savedEquipped;

    this.systemMediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    this.reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.boundSystemListener = this.handleSystemChange.bind(this);
    this.boundMotionListener = this.handleMotionChange.bind(this);
    this.listeners = new Set();

    // 氛围粒子动效实例引用
    this.ambientParticleEngine = null;
  }

  init() {
    if (this.systemMediaQuery.addEventListener) {
      this.systemMediaQuery.addEventListener('change', this.boundSystemListener);
      this.reducedMotionQuery.addEventListener('change', this.boundMotionListener);
    } else if (this.systemMediaQuery.addListener) {
      this.systemMediaQuery.addListener(this.boundSystemListener);
      this.reducedMotionQuery.addListener(this.boundMotionListener);
    }

    // 初始化氛围粒子画布
    this.initAmbientEngine();

    // 生效当前解析后的全量主题与装扮
    this.applyCurrent();
  }

  /**
   * 解析基础主题 ID
   */
  getResolvedThemeId() {
    if (this.preference === 'system') {
      return this.systemMediaQuery.matches ? 'nordic-clean' : 'cyber-slate';
    }
    return this.manifests.has(this.preference) ? this.preference : DEFAULT_THEME_ID;
  }

  getPreference() {
    return this.preference;
  }

  getSeasonalDecor() {
    return this.seasonalDecor;
  }

  getAllThemes() {
    return Array.from(this.manifests.values());
  }

  getSlotDefinitions() {
    return Object.values(this.slots);
  }

  getItemsBySlot(slotId) {
    return Object.values(this.items).filter(item => item.slotId === slotId);
  }

  /**
   * 解析指定槽位当前生效的装备物件 ID
   */
  getEquippedItem(slotId) {
    // 1. 用户自选装备优先
    if (this.equipped[slotId]) {
      return this.equipped[slotId];
    }
    // 2. 检查是否有当前生效的节日活动默认装扮
    if (this.seasonalDecor === 'auto') {
      const activeEvent = this.collections['collection.xmas2026'];
      if (activeEvent && activeEvent.defaultEquipped && activeEvent.defaultEquipped[slotId]) {
        return activeEvent.defaultEquipped[slotId];
      }
    }
    // 3. 回退至槽位系统默认物件
    return this.slots[slotId]?.defaultItemId || null;
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
   * 装备指定槽位的装扮物件
   */
  equipItem(slotId, itemId) {
    if (!this.slots[slotId] || !this.items[itemId]) {
      console.warn(`无效的槽位或物件: ${slotId} -> ${itemId}`);
      return;
    }

    this.equipped[slotId] = itemId;
    try {
      localStorage.setItem(STORAGE_COSMETICS_KEY, JSON.stringify(this.equipped));
    } catch (err) {
      console.warn('保存装扮装备至本地存储失败:', err);
    }

    this.applyCurrent();
  }

  /**
   * 切换节日氛围模式 ('auto' | 'off')
   */
  setSeasonalDecor(mode) {
    this.seasonalDecor = mode === 'off' ? 'off' : 'auto';
    try {
      localStorage.setItem(STORAGE_SEASONAL_KEY, this.seasonalDecor);
    } catch (err) {
      console.warn('保存节日氛围偏好失败:', err);
    }
    this.applyCurrent();
  }

  /**
   * 全量分层解析与应用到 DOM
   */
  applyCurrent() {
    const root = document.documentElement;

    // 开启过渡锁，避免颜色渐变闪烁
    root.classList.add('theme-switching');

    const resolvedId = this.getResolvedThemeId();
    const manifest = this.manifests.get(resolvedId) || this.manifests.get(DEFAULT_THEME_ID);

    // 1. 设置根属性
    root.setAttribute('data-theme', resolvedId);
    root.setAttribute('data-theme-type', manifest.type || 'dark');

    // 2. 批量注水当前配色主题的 CSS 变量
    if (manifest.tokens) {
      Object.entries(manifest.tokens).forEach(([tokenKey, tokenValue]) => {
        root.style.setProperty(tokenKey, tokenValue);
      });
    }

    // 3. 应用各个槽位的装扮物件
    Object.keys(this.slots).forEach(slotId => {
      const itemId = this.getEquippedItem(slotId);
      const item = this.items[itemId];
      if (item && item.tokens) {
        Object.entries(item.tokens).forEach(([tokenKey, tokenValue]) => {
          root.style.setProperty(tokenKey, tokenValue);
        });
      }
    });

    // 4. 更新移动端宿主顶部状态栏色
    this.updateMetaThemeColor(manifest.tokens['--meta-theme-color'] || (manifest.type === 'light' ? '#f6f5f0' : '#0f172a'));

    // 5. 调度全屏氛围动效（雪花等）
    const ambientItemId = this.getEquippedItem('app.ambientEffect');
    if (this.ambientParticleEngine) {
      const isMotionReduced = this.reducedMotionQuery.matches;
      if (ambientItemId === 'effect.snow' && !isMotionReduced && this.seasonalDecor !== 'off') {
        this.ambientParticleEngine.start();
      } else {
        this.ambientParticleEngine.stop();
      }
    }

    // 6. 调度顶栏节日挂饰
    this.renderHeaderOrnament(this.getEquippedItem('app.headerOrnament'));

    // 7. 更新棋盘与白板类名挂载点
    this.syncComponentCosmetics();

    // 解除过渡锁
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove('theme-switching');
      });
    });

    // 8. 派发全局自定义事件，通知白板和游戏画布更新
    const eventDetail = {
      preference: this.preference,
      resolvedId,
      manifest,
      isDark: manifest.type === 'dark',
      equipped: { ...this.equipped },
      seasonalDecor: this.seasonalDecor
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
   * 同步棋盘与白板的装扮类名
   */
  syncComponentCosmetics() {
    // 1. 棋盘装扮外观同步
    const boardEl = document.querySelector('.gomoku-board-wrap') || document.querySelector('.gomoku-board');
    if (boardEl) {
      const boardItemId = this.getEquippedItem('game.gomoku.board');
      const item = this.items[boardItemId];
      boardEl.classList.remove('board-style-classic', 'board-style-obsidian', 'board-style-festive');
      if (item && item.className) {
        boardEl.classList.add(item.className);
      }
    }

    // 2. 白板网格装扮外观同步
    const wbContainer = document.getElementById('wbCanvasContainer') || document.querySelector('.wb-canvas-container') || document.querySelector('.whiteboard-canvas-wrap');
    if (wbContainer) {
      const gridItemId = this.getEquippedItem('whiteboard.grid');
      const item = this.items[gridItemId];
      wbContainer.classList.remove('grid-style-dot', 'grid-style-blueprint', 'grid-style-blank');
      if (item && item.className) {
        wbContainer.classList.add(item.className);
      }
    }
  }

  /**
   * 渲染顶栏节日挂饰 (矢量 SVG)
   */
  renderHeaderOrnament(ornamentId) {
    const wrapTargets = [
      document.getElementById('headerOrnamentWrap'),
      document.getElementById('chatHeaderOrnamentWrap')
    ].filter(Boolean);

    const isFestiveActive = (ornamentId === 'ornament.xmasBells' || (this.seasonalDecor === 'auto' && !this.equipped['app.headerOrnament'])) && this.seasonalDecor !== 'off';

    const ornamentSvg = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent-primary);vertical-align:middle;margin-left:6px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.2));" aria-label="圣诞冬青挂饰">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        <circle cx="19" cy="4" r="2.5" fill="#f43f5e" stroke="none"></circle>
        <circle cx="15.5" cy="3" r="2" fill="#10b981" stroke="none"></circle>
      </svg>
    `;

    wrapTargets.forEach(target => {
      target.innerHTML = isFestiveActive ? ornamentSvg : '';
    });
  }

  /**
   * 初始化环境氛围动效引擎（轻量飘雪粒子）
   */
  initAmbientEngine() {
    let canvas = document.getElementById('ambientParticleCanvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'ambientParticleCanvas';
      document.body.appendChild(canvas);
    }

    const ctx = canvas.getContext('2d');
    let animationFrameId = null;
    let isRunning = false;
    const isMobile = window.innerWidth <= 768;
    const MAX_PARTICLES = isMobile ? 30 : 55;
    const particles = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize, { passive: true });
    resize();

    for (let i = 0; i < MAX_PARTICLES; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 2.2 + 1.2,
        speedY: Math.random() * 0.9 + 0.4,
        speedX: Math.random() * 0.5 - 0.25,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.03 + 0.01,
        opacity: Math.random() * 0.5 + 0.4
      });
    }

    const render = () => {
      if (!isRunning) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const isDark = document.documentElement.getAttribute('data-theme-type') === 'dark';

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.wobble += p.wobbleSpeed;
        const currentX = p.x + Math.sin(p.wobble) * 1.5;

        ctx.beginPath();
        ctx.arc(currentX, p.y, p.radius, 0, Math.PI * 2);

        if (isDark) {
          ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity * 0.9})`;
        } else {
          // 浅色纸白主题下使用微蓝雪晶灰，保证高辨识度与极简纸感
          ctx.fillStyle = `rgba(100, 116, 139, ${p.opacity * 0.75})`;
        }
        ctx.fill();

        p.y += p.speedY;
        p.x += p.speedX;

        if (p.y > canvas.height + 5) {
          p.y = -5;
          p.x = Math.random() * canvas.width;
        }
        if (p.x > canvas.width) p.x = 0;
        if (p.x < 0) p.x = canvas.width;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    // 监听页面可见性，隐藏时自动休眠以节省电量
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
      } else if (isRunning) {
        animationFrameId = requestAnimationFrame(render);
      }
    });

    this.ambientParticleEngine = {
      start: () => {
        if (isRunning) return;
        isRunning = true;
        canvas.style.display = 'block';
        animationFrameId = requestAnimationFrame(render);
      },
      stop: () => {
        isRunning = false;
        canvas.style.display = 'none';
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }

  onThemeChanged(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  handleSystemChange() {
    if (this.preference === 'system') {
      this.applyCurrent();
    }
  }

  handleMotionChange() {
    this.applyCurrent();
  }

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

  function updateSegmentUI(preference) {
    segmentBtns.forEach(btn => {
      const themeId = btn.getAttribute('data-theme-id');
      btn.classList.toggle('active', themeId === preference);
    });
  }

  // 装扮中心渲染逻辑
  function renderCosmeticsModal() {
    if (!cosmeticsModal) return;

    // 选项卡切换
    const tabBtns = cosmeticsModal.querySelectorAll('.cosmetics-tab-btn');
    const tabPanes = cosmeticsModal.querySelectorAll('.cosmetics-tab-pane');

    tabBtns.forEach(btn => {
      btn.onclick = () => {
        const targetTab = btn.getAttribute('data-tab');
        tabBtns.forEach(b => b.classList.toggle('active', b === btn));
        tabPanes.forEach(p => p.classList.toggle('active', p.id === targetTab));
      };
    });

    // 1. 渲染主题网格
    const themesGrid = document.getElementById('cosmeticsThemesGrid');
    if (themesGrid) {
      themesGrid.innerHTML = '';
      const allThemes = manager.getAllThemes();
      const currentPreference = manager.getPreference();

      allThemes.forEach(manifest => {
        const card = document.createElement('div');
        card.className = `cosmetics-theme-card ${manifest.id === currentPreference ? 'active' : ''}`;
        card.setAttribute('data-theme-id', manifest.id);

        const typeLabel = manifest.type === 'dark' ? '暗色' : '浅色';
        const seasonBadge = manifest.isSeasonal ? `<span class="cosmetics-badge" style="background:var(--accent-subtle);color:var(--accent-primary);font-weight:700;">限定</span>` : '';
        const bgApp = manifest.tokens['--bg-app'] || '#000';
        const bgSurface = manifest.tokens['--bg-surface'] || '#222';
        const accent = manifest.tokens['--accent-primary'] || '#38bdf8';

        card.innerHTML = `
          <div class="cosmetics-theme-header">
            <span class="cosmetics-theme-title">${manifest.name}</span>
            <div style="display:flex;gap:4px;">
              ${seasonBadge}
              <span class="cosmetics-badge">${typeLabel}</span>
            </div>
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

    // 2. 渲染节日活动包
    const eventContainer = document.getElementById('cosmeticsEventsContainer');
    if (eventContainer) {
      eventContainer.innerHTML = '';
      const xmas = manager.collections['collection.xmas2026'];
      if (xmas) {
        const card = document.createElement('div');
        card.className = 'event-pack-card';
        const isDecorActive = manager.getSeasonalDecor() === 'auto';

        card.innerHTML = `
          <span class="event-pack-badge">${xmas.badge}</span>
          <div class="event-pack-title">${xmas.name}</div>
          <div class="event-pack-desc">${xmas.tagline}</div>
          <div class="event-pack-actions">
            <button class="btn ${isDecorActive ? 'btn-primary' : 'btn-secondary'}" id="toggleSeasonalDecorBtn">
              ${isDecorActive ? '节日氛围已开启 (飘雪与挂饰)' : '开启圣诞狂欢氛围'}
            </button>
            <button class="btn btn-secondary" id="applyXmasThemeBtn">应用圣诞专属配色</button>
          </div>
        `;

        eventContainer.appendChild(card);

        const toggleBtn = card.querySelector('#toggleSeasonalDecorBtn');
        if (toggleBtn) {
          toggleBtn.onclick = () => {
            manager.setSeasonalDecor(isDecorActive ? 'off' : 'auto');
            renderCosmeticsModal();
          };
        }

        const applyThemeBtn = card.querySelector('#applyXmasThemeBtn');
        if (applyThemeBtn) {
          applyThemeBtn.onclick = () => {
            const isDark = document.documentElement.getAttribute('data-theme-type') === 'dark';
            manager.setTheme(isDark ? 'xmas-pine' : 'xmas-snow');
            renderCosmeticsModal();
          };
        }
      }
    }

    // 3. 渲染槽位个性装扮
    const slotsContainer = document.getElementById('cosmeticsSlotsContainer');
    if (slotsContainer) {
      slotsContainer.innerHTML = '';
      const slots = manager.getSlotDefinitions();

      slots.forEach(slot => {
        const group = document.createElement('div');
        group.className = 'cosmetics-slot-group';

        const currentItemId = manager.getEquippedItem(slot.slotId);
        const items = manager.getItemsBySlot(slot.slotId);

        let itemsHtml = '';
        items.forEach(item => {
          const isActive = item.id === currentItemId;
          itemsHtml += `<button class="cosmetics-item-chip ${isActive ? 'active' : ''}" data-slot-id="${slot.slotId}" data-item-id="${item.id}">${item.name}</button>`;
        });

        group.innerHTML = `
          <div class="cosmetics-slot-header">
            <div>
              <div class="cosmetics-slot-title">${slot.name}</div>
              <div class="cosmetics-slot-desc">${slot.description}</div>
            </div>
          </div>
          <div class="cosmetics-items-row">${itemsHtml}</div>
        `;

        group.querySelectorAll('.cosmetics-item-chip').forEach(btn => {
          btn.onclick = () => {
            const sId = btn.getAttribute('data-slot-id');
            const iId = btn.getAttribute('data-item-id');
            manager.equipItem(sId, iId);
            renderCosmeticsModal();
          };
        });

        slotsContainer.appendChild(group);
      });
    }
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
      // 移动端若抽屉侧边栏处于展开状态，自动收起以避免图层阻挡
      const sidebar = document.getElementById('sidebar');
      const backdrop = document.getElementById('sidebarBackdrop');
      if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
      }
      if (backdrop && !backdrop.classList.contains('hidden')) {
        backdrop.classList.add('hidden');
      }

      renderCosmeticsModal();
      cosmeticsModal.classList.remove('hidden');
    });
  }

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
  });

  // 初始化高亮
  updateSegmentUI(manager.getPreference());
}
