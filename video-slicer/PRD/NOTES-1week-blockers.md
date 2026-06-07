# 📎 1 周上线 Blockers 清单 + 面试安全隐患

> 本文件是 B 阶段产出 — 静态扫描 `backend/main.py` 832 行 + `frontend/app/page.tsx` 946 行后得出的**真实风险点**。
> 优先级：**P0 = 上线前必修**，**P1 = 面试前必能回答**，**P2 = V1.1 处理**

---

## P0 — 1 周上线前必修（3 项）

### B-1. 前端"抖音版" Tab 是误导
- **位置**：[page.tsx:857-859](../frontend/app/page.tsx#L857)
- **现象**：UI 上有"抖音版"切换 → 切到抖音 tab 实际拉的是 `vertical.mp4`，但后端 [main.py:650](../backend/main.py#L650) 仅 `shutil.copy2(clip_path, vertical_path)` 没真做 9:16 裁剪
- **结果**：用户切到"抖音版"看到的还是横屏，但被前端 CSS 强行塞进 9:16 容器 → **画面被压扁或截**
- **修法**（30 分钟）：删 [page.tsx:857](../frontend/app/page.tsx#L857) `videoType = activeClipTab === 'douyin' ? 'vertical' : 'original'` → 直接固定 `'original'`；删两个 tab 切换 UI
- **同步改 PRD**：[04-pages-components.md §4.5](./04-pages-components.md) 已标 V1 砍掉

### B-2. 后端 stderr 直接返给前端（信息泄露 + 面试雷区）
- **位置**：[main.py:68](../backend/main.py#L68) + [main.py:82](../backend/main.py#L82)
- **现象**：FFmpeg / whisper 失败时，把 stderr 尾 500 字符塞进 `HTTPException.detail`
- **结果**：用户看到 `bash: ffmpeg: command not found` 这种内部错误
- **面试风险**：被问"你怎么处理错误暴露"时，回答会暴露这个洞
- **修法**（15 分钟）：把 detail 改为用户友好文案，stderr 写到 `print()` 看 logs 即可
  ```python
  # 改前
  raise HTTPException(status_code=500, detail=f"音频提取失败: {result.stderr[-500:]}")
  # 改后
  print(f"[transcribe] ffmpeg stderr: {result.stderr[-500:]}", flush=True)
  raise HTTPException(status_code=500, detail="视频处理失败，请检查视频文件后重试")
  ```

### B-3. whisper.cpp 二进制仅 macOS ARM64（Product Hunt 用户多样化）
- **位置**：`whisper.cpp-master/build/bin/whisper-cli`
- **现象**：M1/M2/M3 Mac 能直接跑；**Intel Mac / Windows / Linux 用户跑不起来**
- **结果**：PH 上线后第一个 issue 大概率是"启动失败"
- **修法**（取舍）：
  - **A. 不修，PH 只挂 demo 视频**（[10-roadmap.md §10.3 V1.5 部署](./10-roadmap.md)）— 推荐
  - **B. 加 README 说明跨平台编译步骤** — 用户自助
  - **C. 后端换云端 ASR**（OpenAI Whisper API / 阿里通义）— V1.5 工作量
- **决策**：用 A，PH 录 demo 视频 + 不开放真实下载；走 B 的话至少在 README 头部红字警告

---

## P1 — 面试前必能回答（5 项）

> 这些都是面试官会问"你 V1 没做 / V1 没修"的地方。**答得出"为什么没做"= 体现取舍能力**；**答不出 = 装傻**。

### B-4. 前端硬编码 `http://127.0.0.1:8000` 共 11 处
- **位置**：[page.tsx:230, 238, 257, 312, 340, 362, 367, 382, 433, 858, 859](../frontend/app/page.tsx)
- **现象**：每个 fetch / window.open 都写死 `127.0.0.1:8000`
- **面试问法**："如果要部署上云，前端这块怎么改？"
- **应答**："抽 `NEXT_PUBLIC_API_URL`，11 处 fetch 全部用模板替换；V1.5 部署阶段统一处理（PRD/10 §V1.5 已列）"

### B-5. 后端 CORS 写死 `localhost:3000` / `127.0.0.1:3000`
- **位置**：[main.py:25](../backend/main.py#L25)
- **现象**：上线后域名（如 `taro.xxx.com`）会被 CORS 拦
- **面试问法**："你 CORS 是怎么配的？"
- **应答**："V1 本地用写死最简；V1.5 上云时用 `os.getenv('ALLOWED_ORIGINS').split(',')` 多域名支持。教学项目阶段保留简单"

### B-6. `CLAUDE_BASE_URL` / `CLAUDE_MODEL` 硬编码
- **位置**：[main.py:119-120](../backend/main.py#L119)
- **现象**：要切其他中转商或模型必须改代码
- **面试问法**："你 LLM 选型怎么切换？"
- **应答**："V1 锁定蓝衣 + Sonnet 4-6（成本可控 + 中转商稳定）；V1.1 抽 `.env` 让切换无需改代码（PRD/10 已列）"

### B-7. 无全局 exception handler
- **位置**：整个 `main.py` 没用 `@app.exception_handler`
- **现象**：RuntimeError 等非 HTTPException 错误会让 FastAPI 默认返回 stack trace（开发期可见）
- **面试问法**："生产环境错误怎么兜底？"
- **应答**："V1 教学环境跑得通即可；V1.1 加 `@app.exception_handler(Exception)` 统一包装 5xx + Sentry"

### B-8. localStorage 全量持久化 = 用户清缓存就全丢
- **位置**：[page.tsx:174](../frontend/app/page.tsx#L174) 共 11 个 keys
- **现象**：用户清浏览器缓存或换设备 → 所有切片结果丢失
- **面试问法**："为什么不用数据库？"
- **应答**："V1 单用户场景 + 教学项目无后端用户系统；localStorage 已经覆盖跨步骤状态；V1.5 上云时迁 Postgres（PRD/10 已列）"

---

## P2 — 知道存在即可（V1.1 处理）

### B-9. SRT 字幕只是整段一行
- **位置**：[main.py:669](../backend/main.py#L669) `srt_content = f"1\\n00:00:00,000 --> ...\\n{clip.text.strip()}\\n"`
- **现象**：整个切片 30-60 秒只有一条字幕显示全文 → 字幕大小受限 / 阅读体验差
- **修法**（V1.1 1-2 小时）：用 `make_srt(segments, clip_start)` 函数（[main.py:547](../backend/main.py#L547)）从原始 segments 截取并真正分段
- **影响**：当前用户拿到字幕也凑合能用，不阻塞 V1 上线

### B-10. 没埋点 / 没分析
- **现象**：完全不知道用户在哪步流失
- **修法**（V1.5）：接 PostHog（免费版够用）+ 5-7 个关键事件

### B-11. `videos/` 不清理 → 磁盘塞满
- **现象**：每次上传 + 切片产物永久留在 `~/video-slicer/backend/videos/`
- **修法**（V1.1 30 分钟）：加 cron / 后台 task 删 7 天前的目录

---

## Build 不会过的 Bug 自查

> 这是"上线前最后跑一次"的清单 — 任何一项跑出错都阻止上线。

```bash
# 1. 后端启动
cd ~/video-slicer/backend
source venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port 8000 &
sleep 3
curl http://127.0.0.1:8000/health   # 期望 {"status":"ok"}

# 2. 前端 build
cd ~/video-slicer/frontend
npm run build                       # 期望 Compiled successfully

# 3. 前端 lint
npm run lint                        # 期望无 error

# 4. whisper-cli 跑通
~/video-slicer/whisper.cpp-master/build/bin/whisper-cli --help   # 期望显示帮助
```

如有任一项失败，去 [09-error-handling.md](./09-error-handling.md) 找对应处理 / 此文档找 blockers。

---

## 4 件事 1 周可完成的优先级排序

1. **第 1 天**：修 B-1（删抖音 tab）+ B-2（友好错误文案）→ 让 V1 demo 视觉无明显 bug
2. **第 2-3 天**：6 维度评分升级（PRD/05 §5.5 改 prompt + interface + UI 详情页）
3. **第 4 天**：用 1 段真实直播录像跑完整 V1 链路，记录截图 + 录屏
4. **第 5 天**：写 PH submission 描述 + 录 30 秒 demo 视频 + 设计 PH 配图
5. **第 6-7 天**：缓冲日 + 面试前过 [APPENDIX-pitfalls.md](./APPENDIX-pitfalls.md) 12 个坑 + 4 个 Q&A

---

> 这份 blockers 清单的关键意义：**面试时只要被问到任何一项，你都有"为什么这样"的答案**。即便答"V1 没做"也是个有取舍依据的答案，不是"忘了"。
