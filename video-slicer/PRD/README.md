# video-slicer — 项目规范（V1 PRD）

> 本文件夹是面向 AI 编程 Agent（Cursor / Claude Code / Trae）+ 面试讲述的项目执行规范。
> 按模块拆成多个文件；Agent 做项目时按任务阶段按需加载对应文件。

| 字段 | 内容 |
|---|---|
| 版本 | v1.0 |
| 创建日期 | 2026-05-19 |
| 最后更新 | 2026-05-19 |
| 目标 Agent | Cursor / Claude Code / Trae / Codex |
| 技术栈 | FastAPI + whisper.cpp + Next.js 16 + Claude Sonnet 4-6 |
| 上游来源 | 现有代码（逆向补 PRD）+ `~/Desktop/ai自动剪辑、/` 4 个 docx |
| 项目性质 | **面试展示 + Product Hunt 上线（1 周内）双优化** |
| 证据等级 | 🟡 有限 — V1 定位是机会驱动（追抖音砥砺计划），无真实知识类直播博主用户访谈数据 |

---

## 30 秒电梯介绍

**产品是什么**：把 1-4 小时的知识类直播录像，4 步全自动生成"陌生观众能独立看懂"的金句切片 + 知识点切片，附带 0 编造的平台文案，下载即用。

**给谁用**：知识类直播博主（商业 / 职场 / AI / 心理 / 教育），每周 1-3 场直播。

**核心价值**：跟录咖 / OpusClip 拉开差距的是 **V4 Prompt 经过 4 版真实迭代沉淀的"完整可独立理解片段"识别能力** — 合并 whisper 语义碎片、指代词回溯、反 AI 编造、完整性硬规则。详见 [APPENDIX-pitfalls.md](./APPENDIX-pitfalls.md)。

**V1 核心功能**（3 个）：
1. **上传 + whisper 转写**（本地推理，1h 视频 ≈ 3-5 分钟）
2. **AI 识别 + 6 维度评分**（违禁词扫描 + 金句 + 知识点；评分让用户筛选）
3. **切片导出 + 双平台文案 + ZIP 打包下载**

---

## 📂 文件导航

| 文件 | 内容 | 什么时候读 |
|---|---|---|
| [01-overview.md](./01-overview.md) | V1 范围、3 个核心功能、不做清单、用户主流程 | **首次必读** |
| [02-tech-stack.md](./02-tech-stack.md) | 当前技术栈现状（FastAPI / whisper.cpp / Next.js 16 / 蓝衣中转）+ 启动命令 + 目录结构 | **首次必读** |
| [03-design-handoff.md](./03-design-handoff.md) | 给 design-spec 的设计输入清单（**不含 token**）| 跑 `/design-spec` 前读 |
| `../DESIGN.md` | 完整视觉规范（hex 色板 / 字体 / 间距 / 动效 / 组件样式），由 `/design-spec` 产出 | 写样式时读 |
| [04-pages-components.md](./04-pages-components.md) | 4 步流程、API 端点表、6 维度评分展开 UI | 改前端 / 加 UI 时读 |
| [05-ai-capabilities.md](./05-ai-capabilities.md) | 3 个调用点（金句 / 知识点 / 文案）+ V4 Prompt 完整摘录 + JSON 兜底 | 改 Prompt 时读 |
| [07-business-logic.md](./07-business-logic.md) | 端到端流程 mermaid + 3 个核心功能的处理流程 / 业务规则 / 边界情况 | 实现具体功能时读 |
| [09-error-handling.md](./09-error-handling.md) | 错误分类表 + 12 个真实坑的对应代码 | 写错误处理时读 |
| [10-roadmap.md](./10-roadmap.md) | V1.1 / V1.5 部署 / V2.0 / V3 长期方向 + 已知技术债 + 30 天停损节点 | 规划下一步时读 |
| [APPENDIX-pitfalls.md](./APPENDIX-pitfalls.md) | **面试讲述的核心资产** — 12 个坑 + V1→V4 Prompt 迭代史 + 4 个 Q&A 储备 | **面试前必读** |
| [NOTES-1week-blockers.md](./NOTES-1week-blockers.md) | 1 周上线 P0/P1/P2 blockers + Build 自查清单 | 上线前必读 |

> 本项目**不需要** `06-data-model.md`（无数据库；localStorage + 文件系统）
> 本项目**不需要** `08-state-management.md`（已在 [04-pages-components.md §4.7](./04-pages-components.md) 内说明 localStorage 持久化）

---

## 🤖 Agent 加载建议

**首次启动必读**（按顺序）：
1. [README.md](./README.md)（本文件）
2. [01-overview.md](./01-overview.md) — 确认 V1 范围
3. [02-tech-stack.md](./02-tech-stack.md) — 知道技术栈和启动命令
4. [APPENDIX-pitfalls.md](./APPENDIX-pitfalls.md) — 了解为什么是这套 Prompt 设计

**按任务加载**：
- 改前端 / 加 6 维度 UI → [04-pages-components.md](./04-pages-components.md) + [05-ai-capabilities.md §5.5](./05-ai-capabilities.md)
- 改后端 / 改 Prompt → [05-ai-capabilities.md](./05-ai-capabilities.md) + [07-business-logic.md](./07-business-logic.md)
- 加错误处理 → [09-error-handling.md](./09-error-handling.md) + [APPENDIX-pitfalls.md](./APPENDIX-pitfalls.md)
- 规划下一步 / 看为什么不做某功能 → [10-roadmap.md](./10-roadmap.md)
- 面试前讲述准备 → [APPENDIX-pitfalls.md](./APPENDIX-pitfalls.md)

**执行原则**：
- 改 Prompt 必须用真实直播数据跑回归（不要凭空改）
- 6 维度评分升级（V1 范围内）按 [05 §5.5](./05-ai-capabilities.md) 走
- 任何 V2 待办（[10 §10.4](./10-roadmap.md)）想顺手做，**停下来问用户**

---

## 🚫 V1 不做清单（最重要）

完整见 [01-overview.md §1.5](./01-overview.md)。最关键的 5 件：

1. ❌ **多平台 OAuth 自动分发** — 抖音 / 小红书无 API；B 站 / 快手 / 视频号审核 5-10 工作日
2. ❌ **9:16 竖屏真裁剪** — 你已决定横屏直发
3. ❌ **6 类知识点分类筛选 UI** — Prompt 已输出 type 字段；前端 V1 暂不展示
4. ❌ **批量上传 / 定时识别 / 发布历史** — 单文件单次跑通即 MVP
5. ❌ **登录 / 付费 / 用户系统** — 本地匿名跑通即可

---

## 📋 V1 阶段 30 天后的停损节点

| 30 天付费用户数 | 决策 |
|---|---|
| ≥ 10 | 进 V2，按 [10 §10.4](./10-roadmap.md) 推进 |
| 5-9 | 诊断漏斗瓶颈再定 |
| < 5 | 停损 + 重新定位（旅游博主 / 个人 IP 切片 / B2B / 转博客）|

**面试场景**：完整 demo + 12 个坑讲清楚 + V1→V4 迭代讲清楚 = 工程纪律达标 — 即便商业失败，也是个人作品集资产。

---

## 📎 上游来源（逆向补 PRD 的输入）

- `~/Desktop/ai自动剪辑、/AI 视频切片自动化.docx` — 知识点段落识别 PRD（旧版，过度详细）
- `~/Desktop/ai自动剪辑、/产品名称.docx` — 分发功能 PRD（过度企业级，全部进 V2）
- `~/Desktop/ai自动剪辑、/研究领域.docx` — 用户访谈（实际是 1 个旅游博主样本，与"知识类直播博主"定位不匹配）
- `~/Desktop/ai自动剪辑、/阶段一踩坑笔记.docx` — **真正最有价值的资产**，已在 [APPENDIX-pitfalls.md](./APPENDIX-pitfalls.md) 完整整合
- 现有代码：`backend/main.py` 832 行 + `frontend/app/page.tsx` 946 行

---

> 本 PRD 由 Claude 在 2026-05-19 基于"逆向补 PRD"模式产出 — 以现有代码 + 4 个旧文档为输入，输出与代码 1:1 对齐的精简规范。所有 V2 待办都明确标记，避免范围蠕变。
