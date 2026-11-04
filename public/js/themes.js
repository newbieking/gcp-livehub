/**
 * GCP LiveHub 主题与装扮清单 (Theme Manifests)
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
      '--text-dim': '#94a3b8',
      '--border-subtle': 'rgba(255, 255, 255, 0.08)',
      '--border-active': 'rgba(56, 189, 248, 0.4)',
      '--accent-primary': '#38bdf8',
      '--accent-hover': '#0ea5e9',
      '--accent-subtle': 'rgba(56, 189, 248, 0.12)',
      '--btn-primary-text': '#0f172a',
      '--bubble-self-bg': '#0284c7',
      '--bubble-self-text': '#ffffff',
      '--bubble-other-bg': '#334155',
      '--bubble-other-text': '#f8fafc',
      '--bubble-dm-bg': '#6366f1',
      '--wb-canvas-bg': '#0b1120',
      '--wb-grid-dot': 'rgba(255, 255, 255, 0.09)',
      '--meta-theme-color': '#0f172a',
      '--input-bg': 'rgba(15, 23, 42, 0.6)',
      '--input-text': '#f8fafc',
      '--card-shadow': '0 8px 24px rgba(0, 0, 0, 0.45)',
      '--modal-backdrop': 'rgba(0, 0, 0, 0.65)'
    },
    cosmetics: {
      chat: {
        bubbleRadius: '12px'
      },
      whiteboard: {
        gridStyle: 'dot',
        gridSpacing: 24
      },
      games: {
        gomokuBoardShadow: '0 12px 36px rgba(0, 0, 0, 0.6)'
      }
    }
  },

  'nordic-clean': {
    id: 'nordic-clean',
    name: '北欧纸白',
    tagline: '迪特·拉姆斯纸感极简，无眩光日间工作流',
    type: 'light',
    tokens: {
      '--bg-app': '#f1f5f9',
      '--bg-surface': '#ffffff',
      '--bg-surface-elevated': '#e2e8f0',
      '--bg-surface-glass': 'rgba(255, 255, 255, 0.85)',
      '--bg-app-glass': 'rgba(241, 245, 249, 0.88)',
      '--text-primary': '#0f172a',
      '--text-secondary': '#334155',
      '--text-dim': '#475569',
      '--border-subtle': 'rgba(0, 0, 0, 0.08)',
      '--border-active': 'rgba(37, 99, 235, 0.4)',
      '--accent-primary': '#2563eb',
      '--accent-hover': '#1d4ed8',
      '--accent-subtle': 'rgba(37, 99, 235, 0.08)',
      '--btn-primary-text': '#ffffff',
      '--bubble-self-bg': '#2563eb',
      '--bubble-self-text': '#ffffff',
      '--bubble-other-bg': '#e2e8f0',
      '--bubble-other-text': '#0f172a',
      '--bubble-dm-bg': '#4f46e5',
      '--wb-canvas-bg': '#ffffff',
      '--wb-grid-dot': 'rgba(0, 0, 0, 0.08)',
      '--meta-theme-color': '#f1f5f9',
      '--input-bg': '#ffffff',
      '--input-text': '#0f172a',
      '--card-shadow': '0 4px 16px rgba(15, 23, 42, 0.08)',
      '--modal-backdrop': 'rgba(15, 23, 42, 0.35)'
    },
    cosmetics: {
      chat: {
        bubbleRadius: '12px'
      },
      whiteboard: {
        gridStyle: 'dot',
        gridSpacing: 24
      },
      games: {
        gomokuBoardShadow: '0 8px 24px rgba(15, 23, 42, 0.12)'
      }
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
      '--text-primary': '#ffffff',
      '--text-secondary': '#d4d4d8',
      '--text-dim': '#a1a1aa',
      '--border-subtle': 'rgba(255, 255, 255, 0.12)',
      '--border-active': 'rgba(16, 185, 129, 0.4)',
      '--accent-primary': '#10b981',
      '--accent-hover': '#059669',
      '--accent-subtle': 'rgba(16, 185, 129, 0.12)',
      '--btn-primary-text': '#000000',
      '--bubble-self-bg': '#059669',
      '--bubble-self-text': '#ffffff',
      '--bubble-other-bg': '#1e1e1e',
      '--bubble-other-text': '#ffffff',
      '--bubble-dm-bg': '#0d9488',
      '--wb-canvas-bg': '#000000',
      '--wb-grid-dot': 'rgba(255, 255, 255, 0.14)',
      '--meta-theme-color': '#000000',
      '--input-bg': '#121212',
      '--input-text': '#ffffff',
      '--card-shadow': '0 8px 30px rgba(0, 0, 0, 0.8)',
      '--modal-backdrop': 'rgba(0, 0, 0, 0.8)'
    },
    cosmetics: {
      chat: {
        bubbleRadius: '8px'
      },
      whiteboard: {
        gridStyle: 'dot',
        gridSpacing: 24
      },
      games: {
        gomokuBoardShadow: '0 12px 36px rgba(0, 0, 0, 0.9)'
      }
    }
  }
};

export const DEFAULT_THEME_ID = 'cyber-slate';
