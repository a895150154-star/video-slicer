# 9. 错误处理与兜底策略

> 本文件是 PRD/ 文件夹的第 9 部分。如需了解产品全貌请先读 [README.md](./README.md)。
> 上一模块：[07-business-logic.md](./07-business-logic.md) · 下一模块：[10-roadmap.md](./10-roadmap.md)

> 📌 本文件是 [APPENDIX-pitfalls.md](./APPENDIX-pitfalls.md) 12 个真实坑的**对应处理实现**。每条都在生产代码中验证过。

---

## 9.1 错误分类总表

| 错误类型 | 触发条件 | HTTP / 内部码 | 处理方式 | 用户提示 | 恢复策略 |
|---|---|---|---|---|---|
| 不支持的视频格式 | 后缀 ∉ {.mp4, .mov} | `400` | 服务端直接拒绝 | "仅支持 MP4 和 MOV 格式" | 用户选别的文件 |
| 文件未收到 | `file.filename` 为空 | `400` | 拒绝 | "未收到文件" | 重新选 |
| 音频提取失败 | FFmpeg `returncode != 0` | `500` | 返回 stderr 尾 500 字符 | 服务端原文（开发期）/ "视频处理失败，请重试" | 重新上传 |
| 语音转写失败 | whisper-cli `returncode != 0` | `500` | 同上 | 同上 | 重新上传 |
| 转写结果文件未生成 | `result.json` 不存在 | `500` | "转写结果文件未生成" | 服务端原文 | 重新上传 |
| Claude API 调用失败 | `httpx.post` 非 2xx | 抛 RuntimeError | `call_claude` 不重试，向上抛 | （不传给用户）| **【踩坑 #7】** 前端 sleep 3s 后用户手动重试 |
| Claude 输出非 JSON | `json.loads` 失败 | — | 三层兜底（**[踩坑 #5 #6](./APPENDIX-pitfalls.md)**） | 透明（用户看不到） | 自动 |
| Claude 输出含 markdown 包裹 | 含 ` ```json ` 前缀 | — | 正则剥 fence | 透明 | 自动 |
| Claude 输出含中文双引号 | JSON 解析卡在 `"开奶茶店"` | — | `_sanitize_json_string` 转义 | 透明 | 自动 |
| 兜底也失败 | 三层都没解出 JSON | — | 返回 `{fallback_key: []}` | "AI 识别暂时失败" | 用户重试整步骤 |
| 视频文件不存在 | `_find_video_file` 未找到 4 种后缀 | `404` | "视频文件不存在: <id>" | 同 | 重新上传 |
| 切片失败 | FFmpeg 切片 returncode != 0 | — | 单 clip 失败不阻塞批次 | 列表中该条标"失败" + 错误信息 | 用户重试该条 |
| 缩略图生成失败 | FFmpeg 截帧 returncode != 0 | — | 抛 RuntimeError 但被外层捕获 | 该 clip 缩略图缺失，显示占位 | 不影响视频本身 |
| 并发限流（[踩坑 #7](./APPENDIX-pitfalls.md)）| 蓝衣中转返 429 | 抛 RuntimeError | 前端串行 + 3s 间隔预防 | "AI 限流" | 用户等几秒重试 |
| IPv6/IPv4 冲突（[踩坑 #4](./APPENDIX-pitfalls.md)）| 前端 fetch localhost 走 IPv6 | 502/500 | 强制用 `127.0.0.1` 而非 `localhost` | 用户看到无响应 | **已固化为代码约定**（前端硬编码 `http://127.0.0.1:8000`） |
| 旧进程残留（[踩坑 #8](./APPENDIX-pitfalls.md)）| 改代码后浏览器仍报旧错 | — | 启动前 `pkill -f uvicorn` | — | 开发期约定，不是生产错 |

## 9.2 后端全局错误处理（当前现状）

后端 `main.py` **没有用 FastAPI exception_handler**。所有错误：

- 业务校验失败 → `raise HTTPException(status_code, detail)` 由 FastAPI 自动转 JSON
- 系统级失败 → `raise RuntimeError` 由 FastAPI 自动转 500 + stack trace（开发期 ok，生产**V1.1 要包成 5xx 友好响应**）

```python
# 当前没有的：
# @app.exception_handler(RuntimeError)
# async def runtime_error_handler(...): ...
```

**V1.1 改进项**（[10-roadmap.md](./10-roadmap.md)）：加全局 exception handler 让 RuntimeError 也返结构化 JSON。

## 9.3 前端错误处理（当前现状）

```typescript
// page.tsx 模式
try {
  const res = await fetch(...)
  if (!res.ok) { setError('上传失败: ' + res.status); return }
  const data = await res.json()
  // ...
} catch (e) {
  setError('网络错误: ' + (e as Error).message)
}
```

- `error: string` 全局错误条 + 时间戳显示
- 没有 toast / 没有 alert 弹窗（避免打断流程）
- **不做指数退避自动重试** — 用户手动重试（教学项目最简）

## 9.4 Loading 状态规范

| 场景 | Loading 形态 | 实际耗时 | 超时处理 |
|---|---|---|---|
| 上传 | 进度条 `progress` 字段（基于 XHR 上传进度）| 取决于文件大小 + 网速 | 浏览器原生超时 |
| 转写 | "转写中..." spinner，无进度条（whisper.cpp 不暴露内部进度）| 1h 视频 ≈ 3-5 分钟 | 无前端超时；whisper 卡死则等 |
| 违禁词扫描 | 卡片 spinner | < 5 秒 | — |
| 金句识别 | 卡片 spinner | 8-25 秒 | Claude httpx 客户端默认 5 分钟 |
| 知识点识别 | 卡片 spinner | 同上 | 同上 |
| 切片生成 | 进度条 X / N | 每条 60s + 3s 等待 | 单条 timeout=600 秒（[main.py:645](../backend/main.py#L645)） |
| 文案生成 | "重新生成..." 按钮 spinner | 5-10 秒 | — |
| 打包下载 | 浏览器原生下载条 | — | — |

## 9.5 空状态设计

| 页面/位置 | 空时显示 | 引导动作 |
|---|---|---|
| 步骤 2 转写完成但 segments 为空 | "未检测到语音，请检查视频音轨" | "重新上传"按钮 |
| 步骤 3 金句列表空 | "本段直播未识别到强金句" | 显示评分最高的 3 条候选（V1.1） |
| 步骤 3 知识点列表空 | "本段直播未识别到强知识点段落" | 同上 |
| 步骤 4 全部切片失败 | "切片全部失败 — 查看错误详情" | 折叠展示每条 `clip_error` |
| Admin 类页面 | — | V1 无 |

## 9.6 隐私 / 安全兜底

| 风险点 | V1 处理 | V2 改进 |
|---|---|---|
| 用户上传视频含敏感内容 | 仅本地，不上传云端；whisper.cpp 本地推理 | — |
| Claude API 调用泄露内容 | 蓝衣 API key 在 `.env` 不入 git；用户上传内容会发给中转商 | 提示用户 + 加同意条款 |
| 视频文件长期堆积 | `videos/` 无清理，磁盘逐渐变满 | 加 TTL（7 天自动清理） |
| `.env` 含 Claude API key | `.gitignore` 已配 | — |
| 没用户系统 | 任何能访问 `localhost:3000` 的人都能用 | 加单用户密码或 OAuth |

## 9.7 教学/面试讲述的核心错误处理三件套

> **如果面试官只让你讲 3 个工程取舍点，挑这 3 个：**

### ① JSON 解析三层兜底（[踩坑 #5 #6](./APPENDIX-pitfalls.md)）
- 现象：Claude 偶尔输出 ` ```json...``` ` 包裹 + 中文双引号引述例子（`"开奶茶店"`）
- 解决：层 1 直接 `json.loads`；层 2 剥 markdown fence；层 3 正则转义字符串值内裸双引号
- 价值：体现你**理解 LLM 输出不稳定 + 提前兜底**的工程意识

### ② 串行 + 3s 间隔的限流规避（[踩坑 #7](./APPENDIX-pitfalls.md)）
- 现象：金句和知识点接口同时调，每次都一个成功一个失败（"交替失败"模式）
- 解决：从并发改串行 + `await asyncio.sleep(3)` 间隔
- 价值：体现你能**从现象（交替失败）推到本质（限流）**

### ③ Whisper 语义碎片 + Prompt 回溯（[踩坑 #10 #12](./APPENDIX-pitfalls.md)）
- 现象：一句完整话被 whisper 切成 5-10 个 2 秒碎片；金句开头有"这个方法"但前文未带入
- 解决：在 prompt 里加"先合并连续片段 + 指代词必须往前找具体概念"工作流
- 价值：体现你**理解 ASR 输出特性 vs LLM 输入要求 的 GAP**

---

> 用户视角的错误体验原则：**永远不暴露技术错误**（"500"、"AbortError"、"Connection refused"）；包装成中文友好提示 + 推荐下一步操作。
