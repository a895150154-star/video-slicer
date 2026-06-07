# video-slicer — 设计规范 (DESIGN.md)

> 最后更新：2026-05-19（v2 — 融合组员 brief-cut.html 视觉，主色改 lime green）
> 上游来源：`PRD/03-design-handoff.md` + `PRD/04-pages-components.md`（继承模式 A）+ 组员落地页 `landing/brief-cut.html`
> 交互档位：**L1 静态优雅**（用户拍板）
> 证据等级：🟡 有限 — 继承自 PRD 链条；视觉调性融合组员 Brief Cut 设计（生产力工具风）+ 我们的 6 维度评分差异化

> 📌 **v2 关键变更**（从 v1 到 v2）：
> - 主色从靛蓝 `#1E40AF` → **lime green `#B8F24A`**（采纳组员设计，更符合"工具感 + 鲜活生产力"调性）
> - 字体新增 **Inter**（拉丁文 + 数字优雅度提升），中文继续 Noto Sans SC
> - 借鉴组员设计元素：tag chip 半透明 accent 底 / empty state 胶卷剪刀插画 / 大圆 CTA / accent gradient
> - 暗色主题保留（组员只做明色，我们补完整明暗双主题）
> - 落地页 `landing/brief-cut.html` 独立保留，作 PH 上线门面（不进 /app 工作区）

---

## 1. 设计基调

### 1.1 氛围关键词
**鲜活 · 工具感 · 生产力 · 知识沉淀 · 不喧哗**

### 1.2 一句话定调
> Brief Cut 的鲜亮 lime + Notion 的可阅读 + Linear 的克制 — 让用户打开就感受到"这是个高效工具，而且有点生气"，不会无聊也不会试图取悦你的眼睛。

### 1.3 目标用户视角
- **谁**：30 岁左右的知识类直播博主（商业 / 职场 / AI / 心理 / 教育方向）
- **状态**：直播刚结束 1 小时内，PC 桌面端，专注度高、急切想搞定切片发短视频
- **设计在向他们说**：「我不会浪费你时间，分数和切片都给你看清楚，你点几下就能下载」

### 1.4 目标地区/语言
- **主市场**：中国大陆
- **主语言**：`zh-CN`（V2 PH 出海时加 `en`）
- **特殊字族要求**：思源黑体 Noto Sans SC（主用户界面 + 数字）+ 系统等宽字（时间戳 / 分数 / video_id）

### 1.5 关键反竞品决策（从 PRD/03 §3.4 继承）
- ❌ 不模仿录咖的国内娱乐风（活泼配色 + emoji 装饰）
- ❌ 不模仿 OpusClip 的 AI 神秘感渐变（紫粉 hero）
- ❌ 不模仿抖音 / B 站创作者中心的强营销 banner
- ✅ 主参考 Linear（克制 + 工具感）+ Notion（可阅读性 + 暖中性）

---

## 2. 色彩系统

### 2.1 明色主题（默认 — 白天 PC 主用）

```css
:root,
[data-theme='light'] {
  /* === 背景层 4 阶 暖灰白（采纳组员配色） === */
  --color-bg: #F4F4F2;              /* rgb: 244, 244, 242  全页背景（暖中性） */
  --color-bg-elevated: #FFFFFF;     /* rgb: 255, 255, 255  卡片浮层 */
  --color-surface: #ECECE8;         /* rgb: 236, 236, 232  输入框/次级容器 */
  --color-surface-hover: #E6E6E2;   /* rgb: 230, 230, 226  surface hover */
  --color-surface-dark: #1A1B1E;    /* rgb: 26, 27, 30     深色按钮 / nav 背景 */

  /* === 边框 2 阶 === */
  --color-border: rgba(26, 27, 30, 0.08);
  --color-border-strong: rgba(26, 27, 30, 0.16);

  /* === 文本 3 阶 深炭（不纯黑） === */
  --color-text: #1A1B1E;            /* rgb: 26, 27, 30   主文本（对 bg 对比度 16:1，AAA） */
  --color-text-muted: #4A4D52;      /* rgb: 74, 77, 82   次文本 */
  --color-text-subtle: #8A8E94;     /* rgb: 138, 142, 148  辅助/禁用 */

  /* === 主强调色 Lime Green（生产力工具感，融合组员设计） === */
  --color-accent: #B8F24A;          /* rgb: 184, 242, 74   主 CTA、主链接、主选中态 */
  --color-accent-hover: #C8FF6B;    /* rgb: 200, 255, 107 */
  --color-accent-pressed: #7CE15B;  /* rgb: 124, 225, 91   accent-deep */
  --color-accent-soft: #D5F894;     /* 浅 lime，用于 hover bg */
  --color-accent-tint: #FBFFEF;     /* 极浅绿，featured 卡片底 */
  --color-accent-foreground: #2A4F0A; /* lime 上深绿文字（确保对比度） */
  --color-accent-text: #2A4F0A;     /* 深绿文字 — 用在 accent 半透明 chip 上 */
  --color-accent-glow: rgba(184, 242, 74, 0.25);
  --color-accent-gradient: linear-gradient(135deg, #D5F894 0%, #B8F24A 45%, #7CE15B 100%);

  /* === 强调色 2：高分（90+ 切片的"金钩子" — 用 accent-deep 深绿同色系，统一调性） === */
  --color-highlight: #2A4F0A;       /* rgb: 42, 79, 10   深绿（在 lime bg 上有强对比）*/
  --color-highlight-bg: var(--color-accent-soft);  /* 浅 lime bg */
  --color-highlight-glow: rgba(42, 79, 10, 0.12);

  /* === 状态色 === */
  --color-success: #16A34A;         /* rgb: 22, 163, 74   绿 */
  --color-success-bg: #DCFCE7;
  --color-warning: #CA8A04;         /* rgb: 202, 138, 4   琥珀 */
  --color-warning-bg: #FEF9C3;
  --color-danger: #DC2626;          /* rgb: 220, 38, 38   红 */
  --color-danger-bg: #FEE2E2;
  --color-info: #0369A1;            /* rgb: 3, 105, 161   信息蓝 */
  --color-info-bg: #DBEAFE;

  /* === 阴影 === */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.03);
  --shadow-card-hover: 0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04);
  --shadow-elevated: 0 8px 24px rgba(0, 0, 0, 0.10);
}
```

### 2.2 暗色主题（深夜处理直播录像场景）

```css
[data-theme='dark'] {
  /* === 背景层 暖中性深灰，不纯黑（参考 Linear dark） === */
  --color-bg: #18181B;              /* rgb: 24, 24, 27 */
  --color-bg-elevated: #27272A;     /* rgb: 39, 39, 42 */
  --color-surface: #3F3F46;         /* rgb: 63, 63, 70 */
  --color-surface-hover: #52525B;   /* rgb: 82, 82, 91 */
  --color-surface-dark: #0E0F11;    /* 比 bg 更深，用作 nav / 按钮底 */

  --color-border: rgba(250, 250, 249, 0.08);
  --color-border-strong: rgba(250, 250, 249, 0.16);

  --color-text: #FAFAF9;            /* rgb: 250, 250, 249 */
  --color-text-muted: #A1A1AA;
  --color-text-subtle: #71717A;

  /* 暗色下 lime 自带高对比度，保持主色不变 */
  --color-accent: #B8F24A;          /* 同明色，暗 bg 上 lime 极抓眼 */
  --color-accent-hover: #C8FF6B;
  --color-accent-pressed: #7CE15B;
  --color-accent-soft: rgba(184, 242, 74, 0.25);
  --color-accent-tint: rgba(184, 242, 74, 0.08);
  --color-accent-foreground: #0E1A05;  /* 暗 lime 上的深绿文字 */
  --color-accent-text: #D5F894;       /* 暗背景下的"绿色文字"用更亮的 lime soft */
  --color-accent-glow: rgba(184, 242, 74, 0.3);
  --color-accent-gradient: linear-gradient(135deg, #D5F894 0%, #B8F24A 45%, #7CE15B 100%);

  --color-highlight: #C8FF6B;       /* 暗 bg 下用更亮 lime 作高分 */
  --color-highlight-bg: rgba(184, 242, 74, 0.15);
  --color-highlight-glow: rgba(184, 242, 74, 0.25);

  --color-success: #4ADE80;
  --color-success-bg: #052E16;
  --color-warning: #FACC15;
  --color-warning-bg: #422006;
  --color-danger: #F87171;
  --color-danger-bg: #450A0A;
  --color-info: #38BDF8;
  --color-info-bg: #082F49;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.2);
  --shadow-card-hover: 0 4px 12px rgba(0, 0, 0, 0.5), 0 2px 4px rgba(0, 0, 0, 0.3);
  --shadow-elevated: 0 8px 24px rgba(0, 0, 0, 0.6);
}
```

### 2.3 分数着色规则（产品核心差异化）

> 设计取舍：跟主色 lime 同色系（不引入对比色），靠**饱和度 + 加粗 + ⭐ emoji** 区分档位。视觉上更克制统一。

| 总分 | 等级 | 明色 | 暗色 | 配套 |
|---|---|---|---|---|
| **90-100** | 强金句 / 强知识点 | text `#2A4F0A` 深绿 + bg `#D5F894` 浅 lime + 加粗 | text `#C8FF6B` 亮 lime + bg `rgba(184,242,74,0.18)` + 加粗 | ⭐ emoji |
| **80-89** | 可用 | text `#2A4F0A` 深绿 + 透明 bg | text `#B8F24A` lime + 透明 bg | 普通粗体 |
| **70-79** | 备选 | text-text-muted `#4A4D52` | text-text-muted `#A1A1AA` | 普通字重 |
| **60-69** | 弱（默认不显示）| text-text-subtle `#8A8E94` | text-text-subtle `#71717A` | 灰 |

每条切片卡片的**右上大数字**按此规则着色 — 用户一眼能看出哪条值得切。

### 2.4 风险等级 chip 配色

| 风险等级 | 明色 chip | 暗色 chip |
|---|---|---|
| **low** | bg `#DCFCE7` + text `#15803D` | bg `#052E16` + text `#4ADE80` |
| **medium** | bg `#FEF9C3` + text `#A16207` | bg `#422006` + text `#FACC15` |
| **high** | bg `#FEE2E2` + text `#B91C1C` | bg `#450A0A` + text `#F87171` |

### 2.5 类型标签 chip 配色（统一中性灰，避免 10 色花哨）

| 标签类型 | 适用 | 明色 chip | 暗色 chip |
|---|---|---|---|
| **类型标签**（观点型 / 方法论型 / 概念解释型 等 10 种）| 金句 4 类 + 知识点 6 类 | bg `#F4F3F0` + text `#5C5852` + border `#E5E3DE` | bg `#3F3F46` + text `#A1A1AA` + border `#52525B` |

**全部用同样的中性灰** — 10 种类型不同色会让列表花。区分靠**文字**而非颜色。

---

## 3. 字体系统

### 3.1 字体引入（Next.js `next/font/google`）

> 通过 `next/font/google` 自动 subset + 无 FOIT，**不要用 CDN @import**。
> v2 新增 **Inter**（采纳组员设计）— 拉丁文 + 数字优雅度大幅提升。

```typescript
// frontend/app/layout.tsx
import { Inter, Noto_Sans_SC } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
  display: 'swap',
});

const notoSC = Noto_Sans_SC({
  subsets: ['latin'],   // SC 字族 latin 子集已含中文常用字范围
  weight: ['400', '500', '600', '700'],
  variable: '--font-sc',
  display: 'swap',
});

// <html className={`${inter.variable} ${notoSC.variable}`}>
```

### 3.2 CSS 变量绑定

```css
:root {
  /* Inter 处理拉丁文 / 数字，Noto Sans SC 处理中文，浏览器按 fallback 链回退 */
  --font-sans: 'Inter', 'Noto Sans SC', 'PingFang SC', system-ui, sans-serif;
  --font-display: 'Inter', 'Noto Sans SC', 'PingFang SC', sans-serif;
  --font-mono: ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, monospace;
}

html, body {
  font-family: var(--font-sans);
  font-feature-settings: 'kern';
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* 中文字距加一点空气感 */
:lang(zh-CN), [lang='zh-CN'] {
  letter-spacing: 0.02em;
}

/* 数字 / 时间戳必须等宽对齐（产品差异化关键） */
.font-tabular,
.score,
.timestamp,
.video-id {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum';
}
```

### 3.3 字号阶梯（PC 端为主，正文 ≥ 14px）

| 用途 | 字号 (rem / px) | 行高 | 字重 | 用法 |
|---|---|---|---|---|
| **Display**（页面 Hero 标题 — 罕用）| 2rem / 32px | 1.3 | 600 | "video-slicer" 品牌名 |
| **H1**（页面主标题）| 1.5rem / 24px | 1.4 | 600 | 步骤标题 |
| **H2**（区块标题）| 1.25rem / 20px | 1.4 | 600 | 卡片大标题 |
| **H3**（卡片标题、列表项标题）| 1.125rem / 18px | 1.5 | 500 | 切片标题 |
| **Body Large**（重要正文）| 1.0625rem / 17px | 1.7 | 400 | 金句 text 内容 |
| **Body**（默认正文）| 1rem / 16px | 1.7 | 400 | 一般正文 |
| **Body Small**（辅助文本）| 0.875rem / 14px | 1.6 | 400 | 说明文字 / 卡片副标题 |
| **Caption**（标签 / 注释）| 0.75rem / 12px | 1.5 | 500 | chip / 数字单位 |
| **Mono / 等宽**（数字 / 时间戳）| 0.875rem / 14px | 1.5 | 400 | 时间戳 / video_id / 分数底纹 |

### 3.4 中文排版规则

- 行高 ≥ 1.6（中文密集需要呼吸）
- 字距 0.01em（中文等宽特性，加一点空气感）
- 段落间距 ≥ 1.5em
- 长文本最大行宽 ≤ 75 个字符（约 38 个汉字）

---

## 4. 组件样式（核心 7 类）

### 4.1 按钮 Button

```css
/* 基础 */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border-radius: 8px;
  font-weight: 500;
  font-size: 0.9375rem;
  cursor: pointer;
  transition:
    background 200ms ease-out,
    transform 100ms ease-out,
    box-shadow 200ms ease-out;
  min-height: 40px;
  border: 1px solid transparent;
  user-select: none;
  font-variant-numeric: tabular-nums;
}
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.btn:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* Type A 主 CTA */
.btn-primary {
  background: var(--color-accent);
  color: var(--color-accent-foreground);
}
.btn-primary:hover:not(:disabled) {
  background: var(--color-accent-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}
.btn-primary:active:not(:disabled) {
  background: var(--color-accent-pressed);
  transform: translateY(0);
}

/* Type B 次级 */
.btn-secondary {
  background: var(--color-bg-elevated);
  color: var(--color-text);
  border-color: var(--color-border);
}
.btn-secondary:hover:not(:disabled) {
  background: var(--color-surface);
  border-color: var(--color-border-strong);
}

/* Type C Ghost / 第三 */
.btn-ghost {
  background: transparent;
  color: var(--color-text-muted);
}
.btn-ghost:hover:not(:disabled) {
  background: var(--color-surface);
  color: var(--color-text);
}

/* Type D Danger（如"重新开始"清缓存）*/
.btn-danger {
  background: var(--color-danger);
  color: white;
}
.btn-danger:hover:not(:disabled) {
  filter: brightness(1.1);
}

/* 大小变体 */
.btn-sm { padding: 0.375rem 0.75rem; min-height: 32px; font-size: 0.875rem; }
.btn-lg { padding: 0.875rem 1.5rem; min-height: 48px; font-size: 1rem; }
```

### 4.2 卡片 Card（核心 — 切片列表卡片）

```css
.card {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1rem 1.25rem;
  box-shadow: var(--shadow-card);
  transition:
    border-color 200ms ease-out,
    box-shadow 200ms ease-out,
    background 200ms ease-out;
}
.card:hover {
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-card-hover);
}

/* 可点击卡片（选切片）*/
.card-clickable {
  cursor: pointer;
}
.card-clickable:hover {
  background: var(--color-surface);
}

/* 选中态 */
.card-selected {
  border-color: var(--color-accent);
  background: var(--color-accent-glow);
  box-shadow: 0 0 0 3px var(--color-accent-glow);
}

/* 未选中态（视觉弱化）*/
.card-unselected {
  opacity: 0.7;
}
.card-unselected:hover {
  opacity: 1;
}
```

### 4.3 输入框 Input / Textarea

```css
.input,
.textarea {
  width: 100%;
  padding: 0.625rem 0.875rem;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  font-family: var(--font-sc);
  font-size: 0.9375rem;
  line-height: 1.5;
  transition:
    border-color 200ms ease-out,
    box-shadow 200ms ease-out;
}
.textarea {
  min-height: 6rem;
  resize: vertical;
  line-height: 1.7;
}
.input::placeholder,
.textarea::placeholder {
  color: var(--color-text-subtle);
}
.input:hover,
.textarea:hover {
  border-color: var(--color-border-strong);
}
.input:focus,
.textarea:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-glow);
}
.input:disabled,
.textarea:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### 4.4 步骤指示器 StepIndicator（顶部 4 步导航）

```css
.step-indicator {
  display: flex;
  align-items: center;
  gap: 0;
  margin: 1.5rem 0;
}
.step-indicator-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--color-text-subtle);
}
.step-indicator-circle {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--color-surface);
  color: var(--color-text-subtle);
  border: 1px solid var(--color-border);
  transition: all 200ms ease-out;
}

/* 已完成态 */
.step-indicator-item[data-status='done'] .step-indicator-circle {
  background: var(--color-success);
  color: white;
  border-color: var(--color-success);
}
.step-indicator-item[data-status='done'] {
  color: var(--color-text);
}

/* 当前态 */
.step-indicator-item[data-status='current'] .step-indicator-circle {
  background: var(--color-accent);
  color: var(--color-accent-foreground);
  border-color: var(--color-accent);
}
.step-indicator-item[data-status='current'] {
  color: var(--color-text);
  font-weight: 500;
}

/* 连接线 */
.step-indicator-line {
  flex: 1;
  height: 1px;
  background: var(--color-border);
  margin: 0 0.75rem;
}
.step-indicator-line[data-passed='true'] {
  background: var(--color-success);
}
```

### 4.5 分数徽章 ScoreBadge（产品核心）

```css
.score-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.5rem;
  padding: 0.125rem 0.5rem;
  border-radius: 6px;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 1.375rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

/* 90-100 强金句 */
.score-badge[data-tier='excellent'] {
  color: var(--color-highlight);
  background: var(--color-highlight-bg);
}
.score-badge[data-tier='excellent']::before {
  content: '⭐ ';
  font-size: 1rem;
}

/* 80-89 可用 */
.score-badge[data-tier='good'] {
  color: var(--color-accent);
}

/* 70-79 备选 */
.score-badge[data-tier='ok'] {
  color: var(--color-text-muted);
}

/* 60-69 弱 */
.score-badge[data-tier='weak'] {
  color: var(--color-text-subtle);
}
```

### 4.6 6 维度条形图 ScoreBars（产品差异化核心）

```css
.score-bars {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.score-bar-row {
  display: grid;
  grid-template-columns: 6rem 1fr 3rem;
  align-items: center;
  gap: 0.75rem;
}

.score-bar-label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.score-bar-track {
  height: 6px;
  background: var(--color-surface);
  border-radius: 9999px;
  overflow: hidden;
}

.score-bar-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 9999px;
  transition: width 400ms ease-out;
}
/* 高分维度（>80%）填充用 highlight */
.score-bar-fill[data-high='true'] {
  background: var(--color-highlight);
}

.score-bar-value {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  text-align: right;
}

/* 推荐理由 */
.score-bars-reason {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--color-border);
  font-size: 0.8125rem;
  color: var(--color-text);
  font-style: italic;
  line-height: 1.6;
}
```

### 4.7 Chip（类型标签 + 风险等级）

```css
.chip {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  white-space: nowrap;
  border: 1px solid transparent;
}

/* 类型标签（10 种统一中性灰）*/
.chip-type {
  background: var(--color-surface);
  color: var(--color-text-muted);
  border-color: var(--color-border);
}

/* 风险等级 */
.chip-risk[data-level='low'] {
  background: var(--color-success-bg);
  color: var(--color-success);
}
.chip-risk[data-level='medium'] {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}
.chip-risk[data-level='high'] {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}
```

---

## 5. 布局原则

### 5.1 断点

```css
/* PC 工具优先；移动端简单适配不优化 */
/* mobile 默认: < 640px (基础 fallback) */
@media (min-width: 641px) { /* tablet: 凑合用 */ }
@media (min-width: 1025px) { /* desktop: 主要优化对象 */ }
```

### 5.2 容器宽度

| 场景 | max-width | 水平 padding |
|---|---|---|
| 步骤 1 上传 | 640px | 1.5rem |
| 步骤 2 AI 分析 | 800px | 1.5rem |
| **步骤 3 选切片**（核心交互页）| 960px | 1.5rem |
| 步骤 4 切片结果 | 1100px | 1.5rem |
| 全局头部 / 步骤指示器 | 1100px | 1.5rem |

### 5.3 间距梯度（4px 基础栅格 = Tailwind 默认）

```css
:root {
  --space-0: 0;
  --space-1: 0.25rem;   /*  4px */
  --space-2: 0.5rem;    /*  8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
  --space-20: 5rem;     /* 80px */
}
```

### 5.4 圆角

```css
:root {
  --radius-sm: 6px;     /* chip / 小按钮 */
  --radius: 8px;        /* 按钮 / 输入框 */
  --radius-md: 10px;    /* 中等容器 */
  --radius-lg: 12px;    /* 卡片（默认）*/
  --radius-xl: 16px;    /* 大容器 / 主面板 */
  --radius-full: 9999px; /* 圆形 / chip */
}
```

### 5.5 栅格

- **主流程**：单列流（content stack），不用多列
- **步骤 4 双平台对比**：抖音 / B 站 tab 切换，单列内嵌
- **步骤 3 列表**：单列卡片堆叠，不分双列（信息密度高的卡片单列读得更顺）

---

## 6. 动效与交互（L1 静态优雅）

> PRD/03 §3.5 明确"必须避免浮夸动效"。L1 锁定。

### 6.1 通用过渡曲线

```css
:root {
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --duration-fast: 100ms;
  --duration-base: 200ms;
  --duration-slow: 400ms;
}
```

### 6.2 L1 必须实现的动效

- **按钮 hover**：`transition: background 200ms ease-out, transform 100ms ease-out`，颜色变化 + `translateY(-1px)`
- **卡片 hover**：边框 + 阴影 200ms 渐变
- **卡片展开 6 维度详情**：max-height + opacity 300ms slide-down + fade（用 `<details>` 元素或 CSS `grid-template-rows: 0fr → 1fr` trick）
- **页面切换 / 步骤切换**：fade 300ms（不要 slide / push 这种重动效）
- **输入框 focus**：边框色 200ms + accent-glow 200ms 渐入
- **主题切换**：所有色相属性 400ms 渐变（让 light ↔ dark 切换不突兀）

### 6.3 L1 禁用的动效

- ❌ 滚动 reveal（IntersectionObserver 触发的入场）
- ❌ 视差 / pin
- ❌ 自动 carousel / 轮播 banner
- ❌ 光标跟随光圈
- ❌ 3D / WebGL / Lottie
- ❌ 持续呼吸 / pulse 动画（除非 loading spinner）

### 6.4 prefers-reduced-motion 降级（必须实现）

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 6.5 Loading 动效

```css
/* Spinner — 抽签 / 上传 / 文案生成 */
.spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 800ms linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Skeleton — SSR 列表加载 */
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-surface) 0%,
    var(--color-surface-hover) 50%,
    var(--color-surface) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius);
}
@keyframes shimmer {
  to { background-position: -200% 0; }
}
```

### 6.6 主题切换器 UI

- **位置**：全局右上角（与品牌名 logo 同一行）
- **形态**：Sun / Moon icon 切换按钮（lucide-react `Sun` / `Moon`）
- **机制**：
  - 首次访问读 `prefers-color-scheme` 媒体查询
  - 用户点击切换 → 写 `localStorage.video-slicer:theme = 'light' | 'dark'`
  - `<html data-theme="light|dark">` 切换 → 触发所有 token CSS 变量切换
- **过渡**：400ms 渐变（§6.2 已含）

---

## 7. Do's & Don'ts

### Do（推荐）

- ✅ **所有颜色走 CSS 变量**，绝不硬编码 hex 到 className
- ✅ **数字用 `font-variant-numeric: tabular-nums`** — 分数 / 时间戳 / 时长必须等宽对齐（产品差异化关键，体现"专业 / 工具感"）
- ✅ **PC 优先**写样式（不用 mobile-first） — 知识类博主主用 PC
- ✅ **总分徽章按 4 档着色**（excellent / good / ok / weak） — 用户一眼能看出"哪条值得切"
- ✅ **6 维度条形图条 fill 用 accent**；维度得分超过 80% 时切换为 highlight 暖橙 — 让"高分维度"自然跳出
- ✅ **明色为默认，暗色可切换**；右上角 Sun/Moon 切换 + localStorage 持久化
- ✅ **所有可交互元素必有 `hover` + `focus-visible` + `disabled` 三态**
- ✅ **chip 类标签全部圆角胶囊** + 中性灰底（类型）/ 状态色底（风险）
- ✅ **过渡曲线统一**用 `--ease-out` cubic-bezier(0.16, 1, 0.3, 1) — Linear 同款，跟调性一致

### Don't（禁止）

- ❌ **不用紫粉渐变** — PRD/03 §3.5 硬约束，避开 AI 工具审美疲劳
- ❌ **不用大面积彩色 banner** — 视觉服从内容，不让 UI 比金句文本更扎眼
- ❌ **不给类型标签 chip 用 10 种不同色** — 区分靠文字，不是色彩
- ❌ **不浮夸动效** — 没有滚动 reveal / 视差 / 光标跟随 / 持续呼吸 / 自动轮播
- ❌ **不堆 emoji 装饰** — 仅保留 ⭐（高分徽章）/ ⚠️（高风险）/ ✓ ✗ 这种"功能性 emoji"
- ❌ **不为 V1 砍掉的功能**（多平台 OAuth 分发 / 竖屏裁剪等，见 PRD/01 §1.5）做视觉占位
- ❌ **不强制中文字段名英化**（保留"抖音 / B 站"中文 chip） — 用户认得中文标签更亲切
- ❌ **不在主用户路径上加多语言切换器** — V1 锁定 zh-CN

---

## 📎 实现交接（供下游 Claude Code 读取）

```yaml
design_status: ready
theme: ['沉静', '工具感', '知识沉淀', '不喧哗', '像深夜书桌']
interaction_level: L1
default_color_scheme: light
supported_color_schemes: ['light', 'dark']
color_system: |
  靛蓝 #1E40AF / #3B82F6（主强调，知识沉淀感）+ 暖橙 #B45309 / #FB923C（90+ 高分钩子）。
  双主题完整 CSS 变量见 §2。
  零硬编码颜色，全部走 var(--color-*)。
font_system: |
  Noto Sans SC（主中文 + 数字）+ system mono（等宽数字）。
  通过 next/font/google 引入。PC 端正文 ≥ 16px，行高 ≥ 1.6。详见 §3。
core_components:
  - Button (4 type: primary / secondary / ghost / danger)
  - Card (default / hover / selected / unselected 4 态)
  - Input / Textarea
  - StepIndicator (4 步顶部导航)
  - ScoreBadge (4 档着色 — 产品核心)
  - ScoreBars (6 维度条形图 — 产品差异化核心)
  - Chip (type / risk 两类)
breakpoints:
  mobile: '< 640px'  # fallback 不优化
  tablet: '641-1024px'  # 凑合
  desktop: '>= 1025px'  # 主要优化对象
motion_libs: []  # L1 锁定，纯 CSS transition + keyframes
language_default: zh-CN
mvp_scope:
  - 'V1-F1 视频上传 + whisper 转写'
  - 'V1-F2 AI 识别 + 6 维度评分（产品差异化核心）'
  - 'V1-F3 切片导出 + 双平台文案生成'
hard_constraints:
  - '不用紫粉渐变（AI 工具审美疲劳）'
  - '不堆 emoji 装饰（仅 ⭐ ⚠️ ✓ ✗ 功能性 emoji）'
  - '类型标签 10 种统一中性灰（不花哨）'
  - '数字 / 时间戳 / 分数必须等宽对齐 tabular-nums'
  - 'L1 锁定，禁滚动 reveal / 视差 / 光标跟随'
  - '明色为默认，暗色 localStorage 持久化切换'
upstream_chain: '现有代码(逆向补) → PRD(🟡) → DESIGN.md(🟡)'
```

---

## 📎 给 Claude Code 的实现指令（MVP 落地）

> 本节是 DESIGN.md 的最后一节。Claude Code 拿到 `PRD/` + `DESIGN.md` 后，**严格按下面规则改前端**。

### 实现纪律（MVP 优先，不可破）

1. **只重构 PRD/01 列出的 V1 三个功能**——「不做清单」就是不做，不要"顺手"加
2. **每个页面分步重构**：globals.css 注入 tokens → 步骤 1 → 步骤 2 → 步骤 3 → 步骤 4 → 一步跑通一步验证
3. **不引入新依赖**——除了可能补一个 `lucide-react`（图标 / Sun-Moon 切换），不装其他
4. **零硬编码颜色**：所有 className 里的 `bg-yellow-50` / `text-blue-600` 这种 Tailwind 内联颜色**全部替换**为 `var(--color-*)` 或 Tailwind v4 token 别名
5. **图标用 `lucide-react`**：Sun / Moon / Check / X / ChevronDown / Download / Loader
6. **所有可交互元素**：必有 `hover` + `focus-visible` + `disabled` 三态（如缺失立刻补）
7. **数字 / 时间戳 / 分数**：必须套 `.font-tabular` 或 `font-variant-numeric: tabular-nums` — 视觉差异感最强的细节
8. **不写测试 / 不写 README / 不接 SEO / 不接 Sentry**——MVP 阶段噪音
9. **每改完一个步骤的页面，停下来告诉用户**："步骤 X 已重构，要不要看一眼？" — 避免一次改 946 行才发现方向错了
10. **保留现有逻辑不动**：所有 useState / useEffect / fetch / localStorage 持久化 / 6 维度展开逻辑全部保留；**只动 className 和样式**

### 重构顺序（按依赖最小化）

```
Day 1 上午：
  - frontend/app/globals.css 注入 §2 + §3 + §5 + §6 完整 CSS 变量和 keyframes
  - frontend/app/layout.tsx 注入 next/font 加载 Noto Sans SC + 设置 <html className={notoSC.variable}>
  - 在 layout.tsx 或单独 ThemeProvider 实现 localStorage 主题切换 + 右上角 Sun/Moon 按钮
  - 跑 npm run dev 看页面 token 是否注入正确

Day 1 下午：
  - 重构步骤 1 上传页：dropzone + CTA 用 §4.1 .btn-primary / §4.3 .input + .btn-lg
  - 重构步骤 2 AI 分析页：3 个进度卡用 §4.2 .card；状态用 §4.7 .chip-risk

Day 2 上午：
  - 重构步骤 3 选切片页（**核心**）：
    - 列表卡片用 §4.2 .card-clickable + .card-selected
    - 总分徽章用 §4.5 .score-badge[data-tier]
    - 类型标签用 §4.7 .chip-type
    - 风险等级用 §4.7 .chip-risk[data-level]
    - 6 维度展开用 §4.6 .score-bars + .score-bar-row

Day 2 下午：
  - 重构步骤 4 切片结果页：
    - 切片卡片用 §4.2 .card
    - 双平台文案文本框用 §4.3 .textarea
    - 抖音 / B 站 tab 切换沿用现有，但 active 态用 accent border
    - 重新生成 / 下载按钮用 §4.1 .btn-secondary / .btn-primary

Day 3：
  - 测试明色 ↔ 暗色切换无视觉 bug
  - prefers-reduced-motion 降级验证
  - 跑完整 4 步流程录屏作 PH demo 视频
```

### 反模式（看到立刻停下来问）

- 想加紫粉渐变 hero → 看 §7 Don't，立刻 stop
- 想加滚动 reveal / 视差动效 → 看 §6.3 L1 禁用清单
- 想给 10 种类型标签 chip 用不同颜色 → 看 §7 Don't
- 想砍 6 维度展开（"太复杂"）→ 这是产品**核心差异化**（PRD/01 §1.3），不能砍
- 想新加一个 V2 砍掉的功能 → 看 [PRD/10-roadmap.md](./PRD/10-roadmap.md)，全部 V2/V3
- 想加 emoji 装饰让"亲切" → 看 §7 Don't，仅保留 ⭐ ⚠️ ✓ ✗ 功能性 emoji

### DESIGN 没覆盖的事如何处理

如果重构时发现某个组件细节 DESIGN.md 没明示：
- 基于 §1.1 调性关键词推 → **然后告诉用户你推了什么**
- DESIGN.md 与 PRD/04 冲突 → 以本 DESIGN.md 为准
- 颜色不在 §2 变量表 → 停下问用户加变量，不要 hardcode hex

---

> 本文档由 design-spec skill 产出。规格层结束，下游 Claude Code 拿 `PRD/` + 本 DESIGN.md 直接改 frontend。
> 任何 V1 范围外的需求（多平台分发、竖屏裁剪、登录、付费）都属于 V2/V3，**遇到先停下问用户**。
