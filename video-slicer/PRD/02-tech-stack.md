# 2. 技术栈与环境配置

> 本文件是 PRD/ 文件夹的第 2 部分。如需了解产品全貌请先读 [README.md](./README.md)。
> 上一模块：[01-overview.md](./01-overview.md) · 下一模块：[04-pages-components.md](./04-pages-components.md)

> 📌 本文件是**现状镜像** — 完全照搬当前代码实际用的技术栈版本，不引入新依赖。

---

## 2.1 技术栈总览

| 层面 | 选型 | 版本 | 用途 |
|---|---|---|---|
| 后端框架 | FastAPI | 0.136.1 | 单文件 `main.py` 832 行承载全部业务 |
| 后端 ASGI 服务器 | uvicorn | 0.46.0 | `uvicorn main:app --reload` 启动 |
| HTTP 客户端 | httpx | 0.28.1 | 调 Claude API |
| Excel 解析 | openpyxl | 3.1.5 | 加载 `sensitive_words.xlsx` 违禁词库 |
| 环境变量 | python-dotenv | 1.2.2 | 加载 `.env` 里的 `CLAUDE_API_KEY` |
| Pydantic | 2.13.4 | — | 请求体 schema 校验 |
| 转录 | whisper.cpp（C++ 二进制） | master 编译版（macOS ARM64） | 本地 CPU 推理，medium 模型（1.4GB） |
| 视频处理 | FFmpeg | 系统级（brew install ffmpeg） | 音频提取 + 切片编码 |
| LLM | Claude Sonnet 4-6 via 蓝衣 API 中转 | OpenAI-兼容协议 | 金句 / 知识点 / 违禁词二校 / 文案生成 |
| 前端框架 | Next.js | 16.2.6 | App Router |
| 前端 React | React | 19.2.4 | — |
| 前端 TS | TypeScript | 5.x | — |
| 前端样式 | Tailwind CSS | v4（@tailwindcss/postcss）| 当前 inline utility，无 design tokens |
| 前端持久化 | `localStorage` | 浏览器原生 | 跨步骤状态（segments / videoId / clipResults / editingCopy 等 11 个 keys） |
| 后端持久化 | 文件系统（`backend/videos/<id>/`）| — | 上传原视频 + 切片产物 + 文案 JSON |

**结构概述**：
- 单文件后端 `main.py`（**有意为之 — 不拆模块，方便面试讲述全流程**）
- 单文件前端 `app/page.tsx`（946 行，4 步流程 + localStorage 全部在一个组件）
- 无数据库，无用户系统，无 Auth

## 2.2 项目初始化命令

```bash
# 1. 后端
cd ~/video-slicer/backend
python3 -m venv venv
source venv/bin/activate           # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# 编辑 .env 填：CLAUDE_API_KEY=sk-xxx（蓝衣中转 key）

uvicorn main:app --reload --host 127.0.0.1 --port 8000

# 2. 前端
cd ~/video-slicer/frontend
npm install
npm run dev                        # localhost:3000

# 3. 系统依赖
brew install ffmpeg                # macOS
# whisper.cpp 二进制已包含在 whisper.cpp-master/build/bin/whisper-cli (macOS ARM64)
# Intel Mac / Windows / Linux 需进 whisper.cpp-master/ 重新编译，参考其 README
```

## 2.3 项目目录结构（现状）

```
~/video-slicer/
├── README.md                                  # 项目快速启动指引
├── PRD/                                       # 本文件夹（V1 PRD）
├── backend/
│   ├── main.py                                # 全部后端逻辑（832 行）
│   ├── requirements.txt
│   ├── .env                                   # CLAUDE_API_KEY（不提交）
│   ├── .env.example
│   ├── venv/                                  # 虚拟环境（不提交）
│   ├── data/
│   │   ├── sensitive_words.xlsx               # 违禁词库
│   │   └── filler_words.txt                   # 口水词列表
│   └── videos/                                # 运行时上传/产物（不提交）
│       └── <video_id>/
│           ├── <video_id>.mp4                 # 上传原视频
│           └── clip_<NN>/
│               ├── clip.mp4                   # 切片视频（横屏）
│               ├── vertical.mp4               # = clip.mp4（V1 不做竖屏裁剪，仅占位）
│               ├── thumb.jpg                  # 中间帧缩略图
│               ├── subtitle.srt               # SRT 字幕（已重置时间）
│               └── meta.json                  # { clip_type, title }
├── frontend/
│   ├── app/
│   │   ├── page.tsx                           # 全部前端（946 行单文件）
│   │   ├── layout.tsx
│   │   └── globals.css                        # Tailwind 入口
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   └── postcss.config.mjs
└── whisper.cpp-master/                        # 嵌入式 whisper.cpp
    ├── build/bin/whisper-cli                  # macOS ARM64 已编译
    └── models/ggml-medium.bin                 # 1.4GB 模型（不入 git）
```

## 2.4 环境变量

后端 `.env`（不入 git）：

```env
CLAUDE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
```

> 当前硬编码项（V2 抽到 env）：
> - `CLAUDE_BASE_URL = "https://lanyiapi.com/v1"` — 蓝衣中转地址
> - `CLAUDE_MODEL = "claude-sonnet-4-6"` — 模型名
> - 前端 `http://127.0.0.1:8000` — 后端地址硬编码在 `page.tsx`

## 2.5 第三方资源清单

| 资源 | 来源 | 协议 / 价格 | V1 阶段用途 |
|---|---|---|---|
| Claude Sonnet 4-6 via lanyiapi.com 中转 | 第三方中转商 | 按 token 计费（蓝衣中转价 ≈ Anthropic 8 折） | 金句 + 知识点 + 违禁词二校 + 文案生成 |
| whisper.cpp medium 模型 | OpenAI 开源 | MIT | 本地 CPU 转录（无外发） |
| FFmpeg | brew install | LGPL | 音频提取 + 切片编码 |
| Tailwind CSS v4 | npm | MIT | 前端样式 |

## 2.6 部署清单（V1 阶段）

V1 暂不部署上云，**纯本地跑**：

- 用户：自己一人在 macOS M 系列芯片本机
- 启动方式：终端跑 2 个进程（uvicorn 后端 + next dev 前端）
- 访问：浏览器 `http://localhost:3000`

> **Product Hunt 上线方案待定**（见 [10-roadmap.md](./10-roadmap.md) V1.5 部署项）：
> - 选项 A：打包 Mac App（py2app + electron-builder）只在 macOS 跑 — 接近本地
> - 选项 B：部署到云端（Vercel 前端 + Render/Fly.io 后端 + 云端 ASR 替换 whisper.cpp）— 工程量大
> - 选项 C：录一段使用 demo 视频上 PH，不开放真实下载 — 1 周可行
>
> **教学项目优先 选项 C**（PH 收集兴趣 + 面试讲述够用）

---

> 后续模块约定：所有版本号、目录路径、API 端点以本模块为唯一来源；其他模块出现不一致以本模块为准。
