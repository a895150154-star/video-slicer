# 4. 页面与组件清单

> 本文件是 PRD/ 文件夹的第 4 部分。如需了解产品全貌请先读 [README.md](./README.md)。
> 上一模块：[02-tech-stack.md](./02-tech-stack.md) · 下一模块：[05-ai-capabilities.md](./05-ai-capabilities.md)

> 📌 现状：前端 `app/page.tsx` 是 **946 行单文件 SPA**，4 个步骤通过 `currentStep: 1|2|3|4` state 切换。本 PRD 不要求拆模块（教学项目，单文件方便面试讲述）。

---

## 4.1 页面/步骤路由

无传统多页路由，仅单页 4 步流程，由 `currentStep` 控制。

| 步骤 | 名称 | 触发跳转条件 | 文件 |
|---|---|---|---|
| 1 | 上传视频 | 默认入口 | `app/page.tsx` |
| 2 | AI 分析 | 步骤 1 上传 + 转写成功 | 同上 |
| 3 | 选切片 + 编辑文案 | 步骤 2 三个 AI 分析任务都完成 | 同上 |
| 4 | 切片结果 + 下载 | 步骤 3 用户点"生成切片" | 同上 |

**API 端点（后端 `main.py`）**：

| 路径 | 方法 | 用途 |
|---|---|---|
| `/health` | GET | 健康检查 |
| `/transcribe` | POST | 上传视频 + whisper 转写 |
| `/api/check-words` | POST | 违禁词检测（词库 + AI 二校） |
| `/api/analyze-golden` | POST | 金句识别 (V4 prompt) |
| `/api/analyze-knowledge` | POST | 知识点段落识别 (V4 prompt) |
| `/api/process-clips` | POST | 批量切片 + 文案生成 |
| `/api/regenerate-text` | POST | 重新生成单条文案 |
| `/api/get-clip-video` | GET | 拉取切片视频/缩略图 |
| `/api/download-package` | GET | 打包 ZIP 下载 |
| `/api/save-copy` | POST | 保存用户编辑后的文案 |

## 4.2 步骤 1 — 上传视频

- **元素**：
  - 拖拽区 / 点击选择按钮（`<input type="file" accept=".mp4,.mov,video/mp4,video/quicktime">`）
  - 文件名展示
  - 上传进度条（`progress: number`）
  - 状态文案（"上传中..." / "转写中..." / "完成"）
- **交互**：
  - 用户选文件 → `setFile` → 不立刻上传，等用户点"开始转写"
  - 点击"开始转写" → `POST /transcribe` (multipart) → 拿到 `{ segments, video_id }`
  - 成功后 `currentStep = 2` + localStorage 持久化
- **错误处理**：见 [09-error-handling.md](./09-error-handling.md)

## 4.3 步骤 2 — AI 分析

- **元素**：
  - 视频文件名 + 总时长（基于 segments 最后一个 end）
  - 三个并行进度卡（违禁词 / 金句识别 / 知识点识别）
    - 每卡显示：进度 spinner / 完成 ✓ 数字标
    - 完成后显示命中条数（如「转写完成 共 82 段 / 金句识别完成 共 1 条 / 知识点识别完成 共 1 个」）
  - 可折叠的「查看转写详情（82 段）」面板
- **交互**：
  - 进入步骤 2 自动并行触发 3 个 API（**实际是串行 + sleep 3s** 避免限流，踩坑 #7）
  - 三个任务全部完成（或失败）才允许点击"下一步"
  - 「重新开始」按钮：清 localStorage 回步骤 1
- **数据流**：
  ```
  POST /api/check-words      → wordCheckResult: CheckedSegment[]
  POST /api/analyze-golden   → goldenResult: GoldenSentence[]
  POST /api/analyze-knowledge → knowledgeResult: KnowledgeSegment[]
  ```

## 4.4 步骤 3 — 选切片 + 编辑文案（核心交互页）

- **元素**：
  - 顶部切换：「金句切片」 / 「知识点切片」两 tab
  - 每条切片卡片：
    - 左侧：缩略图占位（步骤 4 之前没有，可改为类型 emoji）
    - 中间：`title`（金句）或 `summary`（知识点）+ 时间戳范围
    - 右侧：**总分数字徽章**（70-100，按分段着色：90+ 金色 / 80-89 蓝 / 70-79 灰）
    - 点击展开：详情面板（V1 增量改动 — 见 §4.4.1）
    - 勾选框：加入"待切片"
  - 列表头排序选择：「按分数 desc」/「按时间 asc」
  - 底部"生成 X 条切片"按钮（X = 已勾选数）
- **交互**：
  - 用户点击展开 → 详情面板显示 6 维度细分得分（V1 新增，见下）
  - 勾选 / 取消勾选 → 加入 `selectedGolden: Set<number>` 或 `selectedKnowledge: Set<number>`
  - 点击"生成切片" → POST `/api/process-clips` → 跳步骤 4

### 4.4.1 6 维度评分展开面板（V1 需补改）

> ⚠️ **代码现状不一致**：当前 `GoldenSentence` / `KnowledgeSegment` interface **只有 `score` 单字段**（[page.tsx:24-38](../frontend/app/page.tsx#L24)）。V1 范围内**需要补改 prompt + interface + UI** 让 6 维度细分输出且可展开查看。

**改动清单**（见 [05-ai-capabilities.md](./05-ai-capabilities.md) §5.5 Prompt 改造说明）：

```typescript
// 升级后的 interface
interface ScoreBreakdown {
  completeness: number     // 知识完整性 0-25
  independence: number     // 独立可理解性 0-20
  learning_value: number   // 学习价值 0-20
  clarity: number          // 表达清晰度 0-15
  duration_fit: number     // 时长适配性 0-10
  compliance: number       // 安全合规 0-10
}

interface KnowledgeSegment {
  start_time: string
  end_time: string
  title: string
  summary: string
  score: number              // 0-100 总分（由 6 维度 sum）
  type: 'concept' | 'method' | 'pitfall' | 'case' | 'tool' | 'opinion'
  risk_level: 'low' | 'medium' | 'high'
  score_breakdown: ScoreBreakdown   // V1 新增
  recommendation_reason: string       // V1 新增（AI 推荐理由）
}
```

**UI**：列表卡片**只显总分**；用户点击"展开"看 6 个维度条形图（如 `知识完整性 22/25 ▓▓▓▓▓░░░░░`）+ AI 推荐理由文本。

## 4.5 步骤 4 — 切片结果 + 下载

- **元素**：
  - 顶部切换 Tab：「抖音版」/「B 站版」（V1 砍掉，仅保留"原始版"）
  - 切片卡片列表，每条：
    - 缩略图（`thumb.jpg`，64×64 或更大）
    - 标题 + 时间范围 + 类型徽章
    - 双平台文案预览（可编辑文本框）：
      - 抖音：`title` + `caption`
      - B 站：`title` + `caption`
    - 操作按钮：「在新窗口预览」（拉视频）/「重新生成文案」/「编辑保存」
  - 底部："打包下载全部" → `/api/download-package?video_id=xxx`
- **交互**：
  - 文案手动编辑 → 自动存 `editingCopy[clipIndex]`（localStorage + 防抖 500ms）
  - 点"重新生成文案" → POST `/api/regenerate-text` → 单条文案更新
  - 点"打包下载" → 浏览器直接下载 zip
- **降级清单（V1 砍掉）**：
  - ❌ "抖音版" / "B 站版" tab → 仅展示 1 个版本（**Blockers B-1 决定**）
  - ❌ 视频在线播放器（用户用浏览器原生 `<a href target=_blank>` 跳转视频文件 URL 即可）

## 4.6 关键组件（隐式 — 当前都是 `page.tsx` 内的内联 JSX）

> 当前没拆组件文件，整个 `page.tsx` 是一个 `Home` 函数。本表是**逻辑组件**，不是实际文件。V2 才考虑物理拆分。

| 逻辑组件 | 在 `page.tsx` 中的位置 | 职责 |
|---|---|---|
| `<UploadDropzone />` | 步骤 1 区域 | 拖拽 / 选择文件 |
| `<TranscribeProgress />` | 步骤 2 进度卡 | 3 个并行分析任务状态 |
| `<TranscriptDetailExpand />` | 步骤 2 折叠面板 | 显示 82 段转写文字 |
| `<SegmentCard />` | 步骤 3 列表项 | 单条金句/知识点 + 勾选 + 总分徽章 |
| `<ScoreBreakdownExpand />` ⭐ V1 新增 | 步骤 3 详情展开 | 6 维度条形图 + AI 推荐理由 |
| `<ClipCard />` | 步骤 4 列表项 | 缩略图 + 双平台文案编辑 + 下载 |

⭐ = V1 需新写的组件（约 80-120 行）

## 4.7 localStorage 持久化清单

| Key | 值类型 | 用途 |
|---|---|---|
| `video-slicer:step` | `1\|2\|3\|4` | 当前步骤 |
| `video-slicer:segments` | `Segment[]` | 转写结果 |
| `video-slicer:videoId` | `string` | 后端 video_id |
| `video-slicer:videoFilename` | `string` | 原文件名 |
| `video-slicer:wordCheckResult` | `CheckedSegment[]` | 违禁词命中 |
| `video-slicer:goldenResult` | `GoldenSentence[]` | 金句结果 |
| `video-slicer:knowledgeResult` | `KnowledgeSegment[]` | 知识点结果 |
| `video-slicer:selectedGolden` | `number[]` | 用户勾选的金句索引 |
| `video-slicer:selectedKnowledge` | `number[]` | 用户勾选的知识点索引 |
| `video-slicer:clipResults` | `ClipResult[]` | 步骤 4 切片产物 |
| `video-slicer:editingCopy` | `Record<number, {douyin, bilibili}>` | 用户编辑的文案 |

「重新开始」按钮一次性清除所有 `video-slicer:*` keys（[page.tsx:174](../frontend/app/page.tsx#L174)）。

---

> 当前页面无传统组件文件夹结构，所有 JSX 都在 `app/page.tsx`。这是有意取舍 — 教学项目避免过度拆分；V2 物理拆模块。
