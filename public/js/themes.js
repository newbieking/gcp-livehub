/**
 * GCP LiveHub 架构级主题与装扮系统清单 (Theme Manifests & Cosmetics Catalog)
 * 遵循强类型数据契约，前后端解耦，直接对齐 Flutter ThemeData 与 Dart 模型
 */

export const THEME_MANIFESTS = {
  'cyber-slate': {
    id: 'cyber-slate',
    name: '深空矿石',
    tagline: '极客蓝灰，默认高对比暗色体验',
    type: 'dark',
    tokens: {
      '--bg-app': '#0f172a',
      '--bg-surface': '#1e293b',
      '--bg-surface-elevated': '#334155',
      '--bg-surface-glass': 'rgba(30, 41, 59, 0.75)',
      '--bg-app-glass': 'rgba(15, 23, 42, 0.85)',
      '--text-primary': '#f8fafc',
      '--text-secondary': '#cbd5e1',
      '--text-dim': '#9eb0c6',
      '--border-subtle': 'rgba(255, 255, 255, 0.08)',
      '--border-active': 'rgba(56, 189, 248, 0.4)',
      '--accent-primary': '#38bdf8',
      '--accent-hover': '#0ea5e9',
      '--accent-subtle': 'rgba(56, 189, 248, 0.12)',
      '--btn-primary-text': '#0f172a',
      '--bubble-self-bg': '#0369a1',
      '--bubble-self-text': '#ffffff',
      '--bubble-other-bg': '#334155',
      '--bubble-other-text': '#f8fafc',
      '--bubble-dm-bg': '#4f46e5',
      '--bubble-dm-text': '#ffffff',
      '--status-success-fg': '#34d399',
      '--status-success-bg': 'rgba(16, 185, 129, 0.16)',
      '--status-warning-fg': '#fbbf24',
      '--status-warning-bg': 'rgba(245, 158, 11, 0.16)',
      '--status-danger-fg': '#f87171',
      '--status-danger-bg': 'rgba(239, 68, 68, 0.16)',
      '--dm-badge-fg': '#c084fc',
      '--dm-badge-bg': 'rgba(192, 132, 252, 0.15)',
      '--wb-canvas-bg': '#0b1120',
      '--wb-grid-dot': 'rgba(255, 255, 255, 0.09)',
      '--ink-default': '#38bdf8',
      '--meta-theme-color': '#0f172a',
      '--input-bg': 'rgba(15, 23, 42, 0.6)',
      '--input-text': '#f8fafc',
      '--card-shadow': '0 8px 24px rgba(0, 0, 0, 0.45)',
      '--modal-backdrop': 'rgba(0, 0, 0, 0.65)'
    }
  },

  'nordic-clean': {
    id: 'nordic-clean',
    name: '北欧纸白',
    tagline: '温润纸感极简，无眩光日间高对比阅读',
    type: 'light',
    tokens: {
      '--bg-app': '#f6f5f0',
      '--bg-surface': '#ffffff',
      '--bg-surface-elevated': '#eae8e1',
      '--bg-surface-glass': 'rgba(255, 255, 255, 0.88)',
      '--bg-app-glass': 'rgba(246, 245, 240, 0.90)',
      '--text-primary': '#1c1917',
      '--text-secondary': '#44403c',
      '--text-dim': '#57534e',
      '--border-subtle': 'rgba(0, 0, 0, 0.08)',
      '--border-active': 'rgba(29, 78, 216, 0.4)',
      '--accent-primary': '#1d4ed8',
      '--accent-hover': '#1e40af',
      '--accent-subtle': 'rgba(29, 78, 216, 0.08)',
      '--btn-primary-text': '#ffffff',
      '--bubble-self-bg': '#1d4ed8',
      '--bubble-self-text': '#ffffff',
      '--bubble-other-bg': '#eae8e1',
      '--bubble-other-text': '#1c1917',
      '--bubble-dm-bg': '#4338ca',
      '--bubble-dm-text': '#ffffff',
      '--status-success-fg': '#047857',
      '--status-success-bg': 'rgba(4, 120, 87, 0.10)',
      '--status-warning-fg': '#b45309',
      '--status-warning-bg': 'rgba(180, 83, 9, 0.10)',
      '--status-danger-fg': '#b91c1c',
      '--status-danger-bg': 'rgba(185, 28, 28, 0.10)',
      '--dm-badge-fg': '#6b21a8',
      '--dm-badge-bg': 'rgba(107, 33, 168, 0.10)',
      '--wb-canvas-bg': '#ffffff',
      '--wb-grid-dot': 'rgba(0, 0, 0, 0.08)',
      '--ink-default': '#1c1917',
      '--meta-theme-color': '#f6f5f0',
      '--input-bg': '#ffffff',
      '--input-text': '#1c1917',
      '--card-shadow': '0 4px 16px rgba(28, 25, 23, 0.06)',
      '--modal-backdrop': 'rgba(28, 25, 23, 0.35)'
    }
  },

  'midnight-oled': {
    id: 'midnight-oled',
    name: '极夜纯黑',
    tagline: '零发光纯黑底色，移动端 OLED 省电与高反差',
    type: 'dark',
    tokens: {
      '--bg-app': '#000000',
      '--bg-surface': '#121212',
      '--bg-surface-elevated': '#1e1e1e',
      '--bg-surface-glass': 'rgba(18, 18, 18, 0.85)',
      '--bg-app-glass': 'rgba(0, 0, 0, 0.88)',
      '--text-primary': '#ededed',
      '--text-secondary': '#d4d4d8',
      '--text-dim': '#a1a1aa',
      '--border-subtle': 'rgba(255, 255, 255, 0.12)',
      '--border-active': 'rgba(16, 185, 129, 0.4)',
      '--accent-primary': '#10b981',
      '--accent-hover': '#059669',
      '--accent-subtle': 'rgba(16, 185, 129, 0.12)',
      '--btn-primary-text': '#000000',
      '--bubble-self-bg': '#047857',
      '--bubble-self-text': '#ffffff',
      '--bubble-other-bg': '#1e1e1e',
      '--bubble-other-text': '#ededed',
      '--bubble-dm-bg': '#0f766e',
      '--bubble-dm-text': '#ffffff',
      '--status-success-fg': '#34d399',
      '--status-success-bg': 'rgba(52, 211, 153, 0.16)',
      '--status-warning-fg': '#fbbf24',
      '--status-warning-bg': 'rgba(251, 191, 36, 0.16)',
      '--status-danger-fg': '#f87171',
      '--status-danger-bg': 'rgba(248, 113, 113, 0.16)',
      '--dm-badge-fg': '#c084fc',
      '--dm-badge-bg': 'rgba(192, 132, 252, 0.15)',
      '--wb-canvas-bg': '#000000',
      '--wb-grid-dot': 'rgba(255, 255, 255, 0.14)',
      '--ink-default': '#10b981',
      '--meta-theme-color': '#000000',
      '--input-bg': '#121212',
      '--input-text': '#ededed',
      '--card-shadow': '0 8px 30px rgba(0, 0, 0, 0.8)',
      '--modal-backdrop': 'rgba(0, 0, 0, 0.8)'
    }
  },

  'xmas-pine': {
    id: 'xmas-pine',
    name: '冷杉星夜',
    tagline: '圣诞限定：高山深绿冷杉，浆果红与暖金星芒',
    type: 'dark',
    isSeasonal: true,
    collectionId: 'collection.xmas2026',
    tokens: {
      '--bg-app': '#0a1913',
      '--bg-surface': '#132a21',
      '--bg-surface-elevated': '#1d3d30',
      '--bg-surface-glass': 'rgba(19, 42, 33, 0.85)',
      '--bg-app-glass': 'rgba(10, 25, 19, 0.90)',
      '--text-primary': '#f1f5f9',
      '--text-secondary': '#cbd5e1',
      '--text-dim': '#94a3b8',
      '--border-subtle': 'rgba(255, 255, 255, 0.10)',
      '--border-active': 'rgba(244, 63, 94, 0.5)',
      '--accent-primary': '#f43f5e',
      '--accent-hover': '#e11d48',
      '--accent-subtle': 'rgba(244, 63, 94, 0.15)',
      '--btn-primary-text': '#0a1913',
      '--bubble-self-bg': '#991b1b',
      '--bubble-self-text': '#ffffff',
      '--bubble-other-bg': '#1d3d30',
      '--bubble-other-text': '#f1f5f9',
      '--bubble-dm-bg': '#047857',
      '--bubble-dm-text': '#ffffff',
      '--status-success-fg': '#34d399',
      '--status-success-bg': 'rgba(52, 211, 153, 0.16)',
      '--status-warning-fg': '#fbbf24',
      '--status-warning-bg': 'rgba(251, 191, 36, 0.16)',
      '--status-danger-fg': '#f87171',
      '--status-danger-bg': 'rgba(248, 113, 113, 0.16)',
      '--dm-badge-fg': '#f472b6',
      '--dm-badge-bg': 'rgba(244, 114, 182, 0.16)',
      '--wb-canvas-bg': '#0a1913',
      '--wb-grid-dot': 'rgba(255, 255, 255, 0.12)',
      '--ink-default': '#f43f5e',
      '--meta-theme-color': '#0a1913',
      '--input-bg': '#132a21',
      '--input-text': '#f1f5f9',
      '--card-shadow': '0 8px 24px rgba(0, 0, 0, 0.5)',
      '--modal-backdrop': 'rgba(10, 25, 19, 0.75)'
    }
  },

  'xmas-snow': {
    id: 'xmas-snow',
    name: '暖雪红莓',
    tagline: '圣诞限定：初雪纯白底色，复古红莓与常青冬青',
    type: 'light',
    isSeasonal: true,
    collectionId: 'collection.xmas2026',
    tokens: {
      '--bg-app': '#f8fafc',
      '--bg-surface': '#ffffff',
      '--bg-surface-elevated': '#f1f5f9',
      '--bg-surface-glass': 'rgba(255, 255, 255, 0.90)',
      '--bg-app-glass': 'rgba(248, 250, 252, 0.92)',
      '--text-primary': '#0f172a',
      '--text-secondary': '#334155',
      '--text-dim': '#475569',
      '--border-subtle': 'rgba(0, 0, 0, 0.08)',
      '--border-active': 'rgba(185, 28, 28, 0.4)',
      '--accent-primary': '#b91c1c',
      '--accent-hover': '#991b1b',
      '--accent-subtle': 'rgba(185, 28, 28, 0.08)',
      '--btn-primary-text': '#ffffff',
      '--bubble-self-bg': '#b91c1c',
      '--bubble-self-text': '#ffffff',
      '--bubble-other-bg': '#f1f5f9',
      '--bubble-other-text': '#0f172a',
      '--bubble-dm-bg': '#047857',
      '--bubble-dm-text': '#ffffff',
      '--status-success-fg': '#047857',
      '--status-success-bg': 'rgba(4, 120, 87, 0.10)',
      '--status-warning-fg': '#b45309',
      '--status-warning-bg': 'rgba(180, 83, 9, 0.10)',
      '--status-danger-fg': '#b91c1c',
      '--status-danger-bg': 'rgba(185, 28, 28, 0.10)',
      '--dm-badge-fg': '#047857',
      '--dm-badge-bg': 'rgba(4, 120, 87, 0.10)',
      '--wb-canvas-bg': '#ffffff',
      '--wb-grid-dot': 'rgba(0, 0, 0, 0.08)',
      '--ink-default': '#b91c1c',
      '--meta-theme-color': '#f8fafc',
      '--input-bg': '#ffffff',
      '--input-text': '#0f172a',
      '--card-shadow': '0 4px 16px rgba(15, 23, 42, 0.06)',
      '--modal-backdrop': 'rgba(15, 23, 42, 0.35)'
    }
  }
};

export const DEFAULT_THEME_ID = 'cyber-slate';

/**
 * 装扮槽位定义注册表 (Slot Definitions)
 */
export const SLOT_DEFINITIONS = {
  'chat.bubble': {
    slotId: 'chat.bubble',
    name: '聊天气泡风格',
    description: '定制聊天对话框的气泡圆角与质感',
    category: 'ui',
    defaultItemId: 'bubble.default'
  },
  'game.gomoku.board': {
    slotId: 'game.gomoku.board',
    name: '五子棋盘材质',
    description: '棋局对战视口的实木与纹理材质',
    category: 'game',
    defaultItemId: 'board.classic'
  },
  'whiteboard.grid': {
    slotId: 'whiteboard.grid',
    name: '协同白板网格',
    description: '白板画布工程点阵与网格线导引',
    category: 'canvas',
    defaultItemId: 'grid.dot'
  },
  'app.ambientEffect': {
    slotId: 'app.ambientEffect',
    name: '全屏环境氛围',
    description: '沉浸式轻量全屏环境动效（自动适配无障碍性能预算）',
    category: 'ambient',
    defaultItemId: 'effect.none'
  },
  'app.headerOrnament': {
    slotId: 'app.headerOrnament',
    name: '顶栏节日挂饰',
    description: '侧栏与顶栏角落的主题徽饰',
    category: 'ambient',
    defaultItemId: 'ornament.none'
  }
};

/**
 * 具体装扮物件列表 (Cosmetic Items Catalog)
 */
export const COSMETIC_ITEMS = {
  // 气泡装扮
  'bubble.default': {
    id: 'bubble.default',
    slotId: 'chat.bubble',
    name: '经典圆角',
    description: '简约 12px 规整圆角',
    tokens: {
      '--chat-bubble-radius': '12px'
    }
  },
  'bubble.pill': {
    id: 'bubble.pill',
    slotId: 'chat.bubble',
    name: '胶囊微圆',
    description: '高亲和度 18px 饱满胶囊',
    tokens: {
      '--chat-bubble-radius': '18px'
    }
  },
  'bubble.compact': {
    id: 'bubble.compact',
    slotId: 'chat.bubble',
    name: '极客紧凑',
    description: '硬朗 6px 规整工业风',
    tokens: {
      '--chat-bubble-radius': '6px'
    }
  },

  // 棋盘装扮
  'board.classic': {
    id: 'board.classic',
    slotId: 'game.gomoku.board',
    name: '经典原木',
    description: '经典浅木纹与高精刻线',
    className: 'board-style-classic'
  },
  'board.obsidian': {
    id: 'board.obsidian',
    slotId: 'game.gomoku.board',
    name: '黑曜玄石',
    description: '深邃高贵黑曜石镜面反射质感',
    className: 'board-style-obsidian'
  },
  'board.festive': {
    id: 'board.festive',
    slotId: 'game.gomoku.board',
    name: '冬日松木',
    description: '温润胡桃木与红金星点包边',
    className: 'board-style-festive'
  },

  // 白板网格
  'grid.dot': {
    id: 'grid.dot',
    slotId: 'whiteboard.grid',
    name: '极简点阵',
    description: '低对比圆点阵列，保证视线专注',
    className: 'grid-style-dot'
  },
  'grid.blueprint': {
    id: 'grid.blueprint',
    slotId: 'whiteboard.grid',
    name: '工程蓝图',
    description: '高精连续细线坐标方格',
    className: 'grid-style-blueprint'
  },
  'grid.blank': {
    id: 'grid.blank',
    slotId: 'whiteboard.grid',
    name: '无瑕纯白',
    description: '无任何网格干扰的素面纯净画布',
    className: 'grid-style-blank'
  },

  // 全屏氛围动效
  'effect.none': {
    id: 'effect.none',
    slotId: 'app.ambientEffect',
    name: '静谧无动效',
    description: '关闭环境粒子，维持零 GPU 损耗',
    type: 'none'
  },
  'effect.snow': {
    id: 'effect.snow',
    slotId: 'app.ambientEffect',
    name: '初雪落白',
    description: '轻量优雅的冬日飘雪粒子（≤25粒子，低功耗）',
    type: 'particle',
    particleType: 'snow'
  },

  // 顶栏挂饰
  'ornament.none': {
    id: 'ornament.none',
    slotId: 'app.headerOrnament',
    name: '无挂饰',
    description: '清爽原生界面'
  },
  'ornament.xmasBells': {
    id: 'ornament.xmasBells',
    slotId: 'app.headerOrnament',
    name: '冬青金铃',
    description: '角落点缀冬青松枝与微光铃铛'
  }
};

/**
 * 节日活动包注册表 (Event Collections)
 */
export const EVENT_COLLECTIONS = {
  'collection.xmas2026': {
    id: 'collection.xmas2026',
    name: '2026 圣诞冬日狂欢',
    tagline: '落雪冬青，温暖相聚与实时棋局对弈',
    badge: '限时活动',
    palettes: ['xmas-pine', 'xmas-snow'],
    defaultEquipped: {
      'chat.bubble': 'bubble.pill',
      'game.gomoku.board': 'board.festive',
      'app.ambientEffect': 'effect.snow',
      'app.headerOrnament': 'ornament.xmasBells'
    }
  }
};
