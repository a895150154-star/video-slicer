#!/bin/bash
# 双击启动 video-slicer 前端（端口 3001）
cd "$(dirname "$0")/video-slicer/frontend" || exit 1
echo "==> 前端启动中 http://localhost:3001/app"
echo "==> 关闭这个窗口即可停止前端"
export PORT=3001
exec npm run dev
