# video-slicer

基于 whisper.cpp 本地转录 + FFmpeg 的视频自动剪辑 web 应用。

后端：FastAPI + Python；前端：Next.js + TypeScript。

## 环境要求

- **Python 3.10+**
- **Node.js 18+**
- **FFmpeg**（必须能在命令行直接调用 `ffmpeg`）
  - macOS：`brew install ffmpeg`
  - Windows：从 https://ffmpeg.org/download.html 下载，加到 PATH
- **whisper.cpp 二进制**
  - 包内 `whisper.cpp-master/build/bin/whisper-cli` 是 **macOS ARM64（M 系列芯片）** 编译的，可直接用
  - 其他平台（Intel Mac / Windows / Linux）需要进 `whisper.cpp-master/` 重新编译，参考其 README

## 启动步骤

### 1. 后端

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows 用 venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env              # 填入自己的 CLAUDE_API_KEY
uvicorn main:app --reload         # 默认 http://localhost:8000
```

### 2. 前端

```bash
cd frontend
npm install
npm run dev                       # http://localhost:3000
```

## 目录说明

- `backend/main.py` — 后端全部逻辑（单文件）
- `backend/data/` — 词库文件（口水词、敏感词），保留勿删
- `backend/videos/` — 运行时上传/产物目录，启动后自动创建
- `whisper.cpp-master/models/ggml-medium.bin` — 1.4GB 语音模型
- `whisper.cpp-master/build/bin/whisper-cli` — whisper 可执行文件

## 注意

- `.env` 不要提交，里面是 API key
- CORS 只放行了 `localhost:3000` / `127.0.0.1:3000`，前端端口换了要同步改 `main.py`
