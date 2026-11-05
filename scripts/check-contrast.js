/**
 * WCAG 2.1 对比度自动化核验套件 (Automated Contrast Checker)
 * 验证所有注册主题（含常规与节日扩展包）的文本与背景对比度是否严格达标
 */

function parseRgb(colorStr) {
  if (!colorStr) return null;
  const s = colorStr.trim();
  if (s.startsWith('#')) {
    let hex = s.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const num = parseInt(hex, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
      a: 1.0
    };
  }
  const rgbaMatch = s.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10),
      g: parseInt(rgbaMatch[2], 10),
      b: parseInt(rgbaMatch[3], 10),
      a: rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1.0
    };
  }
  return null;
}

function composite(fg, bg) {
  if (fg.a >= 1) return fg;
  const a = fg.a;
  return {
    r: Math.round(fg.r * a + bg.r * (1 - a)),
    g: Math.round(fg.g * a + bg.g * (1 - a)),
    b: Math.round(fg.b * a + bg.b * (1 - a)),
    a: 1.0
  };
}

function getLuminance(rgb) {
  const norm = [rgb.r, rgb.g, rgb.b].map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * norm[0] + 0.7152 * norm[1] + 0.0722 * norm[2];
}

function getContrastRatio(fgStr, bgStr) {
  const bg = parseRgb(bgStr);
  const fgRaw = parseRgb(fgStr);
  if (!bg || !fgRaw) return 0;
  const fg = composite(fgRaw, bg);
  const l1 = getLuminance(fg);
  const l2 = getLuminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export function auditThemes(themeManifests) {
  let passedCount = 0;
  let failedCount = 0;
  const failures = [];

  console.log('='.repeat(80));
  console.log(' LiveHub WCAG 2.1 对比度自动化审计套件');
  console.log(' 标准阈值: AA级普通文本 >= 4.5:1 | AAA级增强文本 >= 7.0:1');
  console.log('='.repeat(80));

  for (const [themeId, manifest] of Object.entries(themeManifests)) {
    console.log(`\n[主题检验] ${manifest.name} (${themeId}) [${manifest.type || 'dark'}]`);
    const t = manifest.tokens || {};

    const checks = [
      { name: '主标题文本 on 主背景', fg: t['--text-primary'], bg: t['--bg-app'], min: 4.5 },
      { name: '主文本 on 卡片背景', fg: t['--text-primary'], bg: t['--bg-surface'], min: 4.5 },
      { name: '次级正文 on 卡片背景', fg: t['--text-secondary'], bg: t['--bg-surface'], min: 4.5 },
      { name: '弱化标签 on 卡片背景', fg: t['--text-dim'], bg: t['--bg-surface'], min: 4.5 },
      { name: '弱化标签 on 浮动层', fg: t['--text-dim'], bg: t['--bg-surface-elevated'], min: 4.5 },
      { name: '自己气泡文字 on 底色', fg: t['--bubble-self-text'], bg: t['--bubble-self-bg'], min: 4.5 },
      { name: '对方气泡文字 on 底色', fg: t['--bubble-other-text'], bg: t['--bubble-other-bg'], min: 4.5 },
      { name: '私信气泡文字 on 底色', fg: t['--bubble-dm-text'] || t['--bubble-self-text'], bg: t['--bubble-dm-bg'], min: 4.5 },
      { name: '主操作按钮文字 on 强调底色', fg: t['--btn-primary-text'], bg: t['--accent-primary'], min: 4.5 },
      { name: '成功状态文本 on 卡片背景', fg: t['--status-success-fg'], bg: t['--bg-surface'], min: 4.5 },
      { name: '警告状态文本 on 卡片背景', fg: t['--status-warning-fg'], bg: t['--bg-surface'], min: 4.5 },
      { name: '危险状态文本 on 卡片背景', fg: t['--status-danger-fg'], bg: t['--bg-surface'], min: 4.5 },
      { name: '私信标签文本 on 卡片背景', fg: t['--dm-badge-fg'], bg: t['--bg-surface'], min: 4.5 }
    ];

    checks.forEach(c => {
      if (!c.fg || !c.bg) {
        console.log(`  ? [SKIP] ${c.name} (未定义颜色)`);
        return;
      }
      const ratio = getContrastRatio(c.fg, c.bg);
      const isPass = ratio >= c.min;
      const grade = ratio >= 7.0 ? 'AAA' : (ratio >= 4.5 ? 'AA ' : 'FAIL');
      const tag = isPass ? `[PASS ${grade}]` : `[FAIL]`;
      const ratioStr = ratio.toFixed(2).padStart(5);

      if (isPass) {
        passedCount++;
        console.log(`  ${tag} ${ratioStr}:1  ${c.name} (${c.fg} on ${c.bg})`);
      } else {
        failedCount++;
        failures.push({ theme: themeId, check: c.name, ratio, fg: c.fg, bg: c.bg, required: c.min });
        console.error(`  ${tag} ${ratioStr}:1  ${c.name} (${c.fg} on ${c.bg}) - 要求 >= ${c.min}:1`);
      }
    });
  }

  console.log('\n' + '-'.repeat(80));
  console.log(`审计结果统计: 通过 ${passedCount} 项, 失败 ${failedCount} 项`);
  console.log('-'.repeat(80));

  if (failedCount > 0) {
    console.error(`\n发现 ${failedCount} 项色彩对比度未达标！请修正主题色板定义。`);
    return false;
  } else {
    console.log('\n全部主题色彩对比度均达到 WCAG 2.1 AA/AAA 规范！');
    return true;
  }
}

// 独立运行时执行
if (process.argv[1].endsWith('check-contrast.js')) {
  import('../public/js/themes.js').then(({ THEME_MANIFESTS }) => {
    const ok = auditThemes(THEME_MANIFESTS);
    process.exit(ok ? 0 : 1);
  }).catch(err => {
    console.error('加载 themes.js 失败:', err);
    process.exit(1);
  });
}
