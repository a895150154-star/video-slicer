# Brief Cut · 视频自动切片工具

把一段长视频（直播/口播）自动转成文字、用 AI 找出金句和知识点、切成多个短视频片段并生成多平台文案。

- **前端**：Next.js 16 + TypeScript（4 步切片工作流）
- **后端**：FastAPI + Python（转录 + AI 切片）
- **语音转写**：whisper.cpp（本地运行）

---

## ⚠️ 下载后请先看这里

这是一份**纯源码包**，为了体积，仓库里**不包含**以下东西，需要你自己装/下载（都是免费的、可自动重建的）：

| 没包含的东西 | 怎么获取 |
|---|---|
| 前端依赖 `node_modules` | 进 `frontend` 跑 `npm install`，自动装 |
| 后端依赖 / Python 环境 | 进 `backend` 建 venv 后 `pip install -r requirements.txt` |
| whisper.cpp + 语音模型（约 1.5GB） | 见下方完整教程，`git clone` + 编译 + 下载脚本 |
| API key（`.env`） | 复制 `.env.example` 改名为 `.env`，填入你自己的 key |

> 👉 **详细一步步教程在这里：[`video-slicer/SETUP-FOR-TEAMMATE.md`](video-slicer/SETUP-FOR-TEAMMATE.md)**（强烈建议从这份看起）

---

## 🚀 三种用法，按需求选

### 路径 A：只看界面（最快，5 分钟，不需要后端/不需要 API key）

```bash
cd video-slicer/frontend
npm install
npm run dev
```

打开 http://localhost:3000/app 就能看到完整界面（上传视频会失败，属正常，看视觉不受影响）。

### 路径 B：跑通完整切片功能（30–45 分钟）

需要装后端 + whisper.cpp + 配 API key。**完整步骤见 [`video-slicer/SETUP-FOR-TEAMMATE.md`](video-slicer/SETUP-FOR-TEAMMATE.md)**，那里写得最细。

### 路径 C：macOS 一键启动（依赖装好之后才能用）

确认前端依赖、后端环境都装好后，可以直接**双击**项目根目录里的：

- `启动前端.command` → 前端跑在 http://localhost:3001/app
- `启动后端.command` → 后端跑在 http://127.0.0.1:8010

> ⚠️ 这两个脚本只是"快捷启动键"，**第一次用之前必须先按路径 A/B 把依赖装好**，否则双击会报错。

---

## 📦 环境要求

- macOS（Windows/Linux 需自行调整 whisper 编译步骤）
- Node.js 20+
- Python 3.11+
- FFmpeg（`brew install ffmpeg`）

---

## 📁 项目结构

```
video-slicer/
├── frontend/   前端 Next.js 应用
├── backend/    后端 FastAPI（main.py 是核心）
├── landing/    落地页
├── PRD/        10 份产品文档
├── DESIGN.md   设计规范
└── SETUP-FOR-TEAMMATE.md   ⭐ 完整安装教程
```

---

## 📄 更多文档

- 完整安装教程：[`video-slicer/SETUP-FOR-TEAMMATE.md`](video-slicer/SETUP-FOR-TEAMMATE.md)
- 项目说明：[`video-slicer/README.md`](video-slicer/README.md)
- 产品文档：[`video-slicer/PRD/`](video-slicer/PRD/)
