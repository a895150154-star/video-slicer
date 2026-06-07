# Brief Cut · 给组员的本地启动指南

> 你拿到的是一份**不含依赖、不含 API key、不含视频数据**的纯源码包。
> 跑起来需要：Node 20+、Python 3.11+、macOS。

---

## 📦 你拿到了什么

| 文件夹 / 文件 | 内容 |
|--------------|------|
| `frontend/` | Next.js 16 工具流应用（4 步切片流程） |
| `backend/` | FastAPI 后端（转录 + AI 切片） |
| `landing/` | 你之前设计的落地页（已同步） |
| `PRD/` | 10 份产品文档（反推现有代码） |
| `DESIGN.md` | 设计规范 v2（lime green 主题） |
| `CONVERSATION-SUMMARY.md` 等 | 项目复盘 |

---

## 🎯 推荐路径：只看视觉（5 分钟）

最简单。**不需要 Python 环境、不需要 API key、不需要 whisper**。
你看不到真实切片功能，但能看到所有 UI 组件、动效、布局。

### 步骤

```bash
# 1. 解压到任意目录，进入 frontend
cd path/to/解压的/video-slicer/frontend

# 2. 安装依赖（首次需要 1-2 分钟）
npm install

# 3. 启动 dev server
npm run dev
```

打开浏览器：

- **http://localhost:3000** — 你设计的 Brief Cut 落地页
- **http://localhost:3000/app** — 工具流首页（双栏 SaaS shell）
- **http://localhost:3000/app** → 点侧栏"历史记录" — 你设计的历史页

> ⚠️ 上传视频会失败（因为没启动后端）。这是预期行为，不影响看视觉。

---

## 🔥 完整路径：跑通切片功能（30-45 分钟）

要看 AI 切片真实效果，需要后端 + whisper.cpp + Claude API key。

### 1. 启动后端

```bash
cd backend

# 创建 Python 虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置 API key
cp .env.example .env
# 编辑 .env，填入你的 Claude API key
# （如果没有，让群主给你他的 lanyiapi.com 转发地址 + key）

# 启动
uvicorn main:app --reload
```

后端跑在 **http://127.0.0.1:8000**。

### 2. 安装 whisper.cpp（用于语音转写）

```bash
cd ..  # 回到项目根目录

git clone https://github.com/ggerganov/whisper.cpp.git whisper.cpp-master
cd whisper.cpp-master

# 编译（需要 Xcode Command Line Tools，约 5 分钟）
make

# 下载中文模型（~1.5GB，约 5-10 分钟）
bash ./models/download-ggml-model.sh medium
```

确认 binary 路径：
```bash
ls -la whisper.cpp-master/build/bin/whisper-cli
ls -la whisper.cpp-master/models/ggml-medium.bin
```

两个文件都在，就说明 OK。

### 3. 启动前端

```bash
cd ../frontend
npm install      # 如果还没装过
npm run dev
```

### 4. 测试完整流程

打开 `http://localhost:3000/app`：

1. 上传一段 MP4 / MOV 视频（建议 10 分钟内做测试）
2. 等转录完成（~视频时长的 30%）
3. 看 AI 分析结果（金句 + 知识点）
4. 选要切的，点"确认选择并切片"
5. 看结果页，编辑文案后打包下载

---

## 🚦 故障排查

### 前端跑不起来：`npm run dev` 报错

```bash
# 1. 确认 Node 版本
node --version  # 应该 ≥ 20

# 2. 清缓存重装
rm -rf node_modules .next
npm install
npm run dev
```

### 后端 `pip install` 失败

```bash
# 升级 pip 后重试
pip install --upgrade pip
pip install -r requirements.txt
```

### Whisper 找不到 binary

确认路径是这个（PRD/02-tech-stack.md 里有写死）：
```
~/video-slicer/whisper.cpp-master/build/bin/whisper-cli
~/video-slicer/whisper.cpp-master/models/ggml-medium.bin
```

如果你的项目不放在 `~/video-slicer/`，要么把项目移过去，要么改 `backend/main.py` 里 `WHISPER_CLI` 和 `WHISPER_MODEL` 的路径。

### 上传报错"网络错误"

后端没启动，或者后端跑在别的端口。确认 `backend` 终端窗口能看到 `Uvicorn running on http://127.0.0.1:8000`。

---

## 📁 项目里的关键文档（推荐先看）

| 文档 | 内容 |
|------|------|
| `CONVERSATION-SUMMARY.md` | 整个项目的复盘（产品定位、决策、踩坑） |
| `PRD/01-overview.md` | 产品定位 + 4 步流程 |
| `PRD/03-design-handoff.md` | 设计交接清单（这是设计起点） |
| `PRD/04-pages-components.md` | 所有页面/组件清单 |
| `DESIGN.md` | 设计 token、配色、字体规范 |
| `landing/README.md` | 落地页协作约定 |

---

## ⚠️ 重要：改 landing 视觉时

直接编辑 **`frontend/public/landing.html`**（不是 `landing/index.html` —— 前者才是真正被 Next.js 服务的版本）。

色板 / 字体 / 圆角全部跟 `DESIGN.md v2` 对齐：
- 主色 `--color-accent: #B8F24A`
- 文本 `--color-text: #1A1B1E`
- 背景 `--color-bg: #F4F4F2`
- 字体 Inter + Noto Sans SC

---

## 📞 有问题问我

如果上面任何一步卡住，截图发我，告诉我卡在哪一步、错误信息是什么。
