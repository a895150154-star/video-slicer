#!/bin/bash
# 双击启动 video-slicer 后端（端口 8010）
cd "$(dirname "$0")/video-slicer/backend" || exit 1
source venv/bin/activate
echo "==> 后端启动中 http://127.0.0.1:8010"
echo "==> 关闭这个窗口即可停止后端"
exec uvicorn main:app --host 127.0.0.1 --port 8010
