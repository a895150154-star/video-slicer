# landing/

组员设计的 **Brief Cut 落地页**，作 PH 上线门面 / marketing site 用。

## 这是什么

`index.html` = 完整自包含的单文件落地页（93KB），含：
- Hero（标题 + CTA + 1,348,400+ 创作者数据）
- Features section
- Workflow（从原片到成片 3 步流程）
- Showcase（用户证言 + 数据）
- Pricing（¥0 免费版 / ¥39 专业版 / ¥199 团队版）
- FAQ
- Footer

**完全静态**：HTML + 内联 CSS + 内联 JS（hash router + reveal 动画）+ Inter / Noto Sans SC Google Fonts CDN。无需 build。

## 跟 `frontend/` 关系

**两套独立的东西**：
- `landing/index.html` = 公开落地页（用户首次访问、PH 上线门面、不进应用）
- `frontend/` = Next.js 应用工具（用户上传录像 → AI 切片 → 下载），4 步流程

视觉调性：DESIGN.md v2 已**采纳 landing 的 lime 主色** + Inter 字体，让两边视觉一致。

## 部署建议

```bash
# 选项 A：Vercel 静态部署（推荐）
cd landing/
vercel --prod
# 拿到 briefcut-landing.vercel.app

# 选项 B：GitHub Pages
# 把 landing/ push 到 gh-pages 分支或 docs/

# 选项 C：放到 frontend/public/ 让 Next.js 服务
mv landing/index.html ../frontend/public/landing.html
# 然后访问 /landing.html
```

## 不要在这里改代码

如果要改 landing 视觉：
1. 直接编辑 `index.html`（内联 CSS / JS 都在一个文件里）
2. 改完用浏览器双击打开测试
3. 不要把它当 Next.js 项目处理

## 跟组员的协作约定

下次她改任何视觉时：
1. 让她**参考 `~/video-slicer/DESIGN.md` v2 的色板和字体**
2. landing 内 token 跟 DESIGN.md 保持一致：
   - 主色 `--accent: #B8F24A`
   - 文本 `--text: #1A1B1E`
   - bg `--bg: #F4F4F2`
3. 让她 PR 到 `landing/` 目录而不是 `frontend/`
