# Video-Slicer 迭代路线图

记录后续迭代方向，按优先级分组。每项含**动机**（为什么做）、**方向**（怎么做）、**相关位置**（在哪改）。

最近更新：2026-05-19

---

## P0 — 发布给组员前必做（安全 / 数据 / 致命 bug）

### 1. 修复路径遍历漏洞

**动机**：`_find_video_file(video_id)` 和 `get_clip_video` 直接用 `video_id` 拼路径，恶意构造 `video_id=../etc/passwd` 可读任意文件。组员协作场景必须修。

**方向**：所有接收 `video_id` 的入口加正则校验 `re.fullmatch(r'[0-9a-f]{8}', video_id)`，校验失败直接 400。

**相关位置**：[backend/main.py:601](backend/main.py#L601)、[backend/main.py:749](backend/main.py#L749)、[backend/main.py:767](backend/main.py#L767)

---

### 2. 修复字幕生成 bug

**动机**：当前 SRT 字幕把整段 `clip.text` 塞成一条字幕覆盖整个时长——观感是"字幕全程不动"。专门写好的 `make_srt()` 函数从未被调用，是死代码。

**方向**：在 `process_clips` 里调用 `make_srt(segments_in_range, start_sec)`，按时间戳分条生成。需要把 `segments` 数据通过参数传到该函数（目前只传了 `clips`，得加上 segments）。

**相关位置**：[backend/main.py:547-569](backend/main.py#L547)（make_srt 函数）、[backend/main.py:689-695](backend/main.py#L689)（错误调用点）

---

### 3. 视频存储清理机制

**动机**：`backend/videos/` 永久堆积，单机自用已经堆到 1.1GB，多人共用机器磁盘会满。

**方向**：
- 简单版：FastAPI startup 时跑一遍清理，删除 7 天前的目录
- 进阶版：在每次切片完成后异步触发清理任务
- 终极版：下载完 ZIP 后立刻清理对应 video_id 的目录（但要预留重新生成空间）

**相关位置**：新增 `backend/cleanup.py`，在 `main.py` startup event 里调用

---

### 4. 上传文件大小限制 + 流式写入

**动机**：`await file.read()` 把整段视频一次性读到内存，组员上传 10GB 文件会撑爆 RAM。FastAPI 默认无大小上限。

**方向**：
- 中间件层加 `MaxUploadSize`（如 500MB）
- 改流式写入：`async for chunk in file.stream(): write(chunk)`

**相关位置**：[backend/main.py:56](backend/main.py#L56)、[backend/main.py:21-28](backend/main.py#L21)（add_middleware 附近）

---

## P1 — 功能 / 质量提升

### 5. AI 视频增强（针对低清源）

**动机**：源视频常见 960×432 / 244 kbps（甚至更低）的二次下载素材，物理上糊。AI 超分是当前唯一能"凭空"提升清晰度的路径。**不是 MCP**——MCP 不适合视频处理场景。

**方向**：直接在后端调用云端推理 API。验证顺序：

1. **先验证效果**：拿一段 240p 测试源丢到 [Replicate](https://replicate.com) 的 `nightmareai/real-esrgan-video` 跑一次（约 $1 内），看实际效果是否值得做成功能
2. **如果效果可接受**：在 `process_clips` 加一个 `enhance: bool` 参数
3. **接入选项**（按推荐度）：
   - Replicate（最易接入，模型多，$0.5-2/分钟）
   - fal.ai（速度快，冷启动短）
   - 阿里 ModelScope（国内访问快，`damo/cv_realbasicvsr_video-super-resolution` 专门针对低清真实视频）
   - 本地 Real-ESRGAN（免费但慢，5-15 分钟/分钟视频）
4. **组合方案**：博主出镜场景用 GFPGAN/CodeFormer 修脸 + Real-ESRGAN 修整体

**注意事项**：
- AI 增强对 240p 源的极限是"看起来像 720p"，做不到真 1080p
- 处理时长是秒级到分钟级，必须改成异步任务（不能阻塞 HTTP 请求）
- 要管理用户预期，前端加进度提示

**相关位置**：新增 `backend/services/enhance.py`，在 `process_clips` 里串到 ffmpeg 之前或之后

---

### 6. Prompt 工程化 + 评测集

**动机**：金句/知识点 prompt 准确度有提升空间，但**没有评测集就无法量化改进效果**。"封装成 Skill" 这条路走不通（Skill 不在后端 API 路径上）——正确做法是 prompt 文件化 + 版本管理 + 评测。

**方向**：

#### a. Prompt 抽到独立文件
```
backend/prompts/
├── golden_v1.md
├── golden_v2.md
├── knowledge_v1.md
└── copy_v1.md
backend/prompts.py    ← 加载 + 版本选择
```
通过环境变量 `PROMPT_VERSION_GOLDEN=v2` 切换。

#### b. Prompt 内容优化
- **加 Few-shot 样例**：在 prompt 里插 2-3 段真实转写 + 手工标注的"这段是金句因为 X / 这段不是金句因为 Y"。比纯规则准 30-50%
- **改两段式（Two-pass）**：第一次粗筛候选，第二次精判
- **思维链显式化**：要求模型先输出 `"reasoning"` 再输出结果
- **错误案例库**：把实际跑出来的误判案例收集进 prompt 当反例

#### c. 评测集（**最重要、最被忽视**）
- 挑 5-10 段历史转写文本，**手工标注** ground truth
- 写一个 30 行脚本：跑不同 prompt 版本，输出 precision/recall/漏检/误检对比表
- 每次改 prompt 跑一次，量化"到底有没有变准"

**相关位置**：新增 `backend/prompts/`、`backend/eval/test_cases/`、`backend/eval/run_eval.py`；现有 prompt 在 [backend/main.py:394-452](backend/main.py#L394)、[backend/main.py:455-505](backend/main.py#L455)、[backend/main.py:572-598](backend/main.py#L572)

---

### 7. 真实转写进度条

**动机**：当前进度条 40→90 是定时器假进度，长视频会卡在 90% 很久，用户以为程序挂了。

**方向**：whisper-cli 本身输出 `progress = X%`，用 SSE（Server-Sent Events）或 WebSocket 推真实进度到前端。或至少给"已转写 X/Y 秒"提示。

**相关位置**：[backend/main.py:71-79](backend/main.py#L71)、[frontend/app/page.tsx:384-407](frontend/app/page.tsx#L384)

---

### 8. 上传时源视频码率检测 + 提示

**动机**：用户上传低清源（如 240p / 244 kbps）后才发现切片糊，浪费等待时间。

**方向**：上传完成后立刻跑 ffprobe，若码率 < 1 Mbps 或分辨率 < 720p，前端弹窗提示"源视频质量较低，切片清晰度受源限制，建议使用原片"，给用户选择继续或换源。

**相关位置**：`/transcribe` 路由开头加 ffprobe 检查，新增 `video_info` 字段返回

---

### 9. 重新生成文案的失败提示

**动机**：`handleRegenerateCopy` 失败时 silently fail，用户点了"重新生成"没反应会困惑。

**方向**：catch 块里 setState 一个 toast 状态，UI 显示"重新生成失败，请重试"。

**相关位置**：[frontend/app/page.tsx:337-353](frontend/app/page.tsx#L337)

---

## P2 — 重构 / 工程化（不影响功能但让维护更容易）

### 10. 后端拆分模块

**动机**：`main.py` 已经 ~840 行单文件，新人接手要先理解全文。

**方向**：
```
backend/
├── main.py              ← 只剩 FastAPI app + 路由注册
├── api/
│   ├── transcribe.py
│   ├── analyze.py
│   └── clip.py
├── services/
│   ├── whisper.py
│   ├── llm.py           ← call_claude + clean_json 等
│   └── ffmpeg.py
├── models.py            ← Pydantic 模型集中
└── config.py            ← .env 加载 + 路径常量
```

**相关位置**：整个 [backend/main.py](backend/main.py)

---

### 11. 前端拆分组件

**动机**：`page.tsx` 946 行，4 个步骤全堆在一个文件里。

**方向**：
```
frontend/app/
├── page.tsx                       ← 只剩 Stepper + 状态管理 + 步骤切换
├── components/
│   ├── StepUpload.tsx
│   ├── StepAnalyze.tsx
│   ├── StepSelect.tsx
│   └── StepResult.tsx
└── hooks/
    └── usePersistedState.ts       ← 抽掉 13 个 localStorage 模板代码
```

**关键收益**：`usePersistedState<T>(key, default)` 一个 hook 能消除当前 [page.tsx:96-139](frontend/app/page.tsx#L96)（13 个 useState 初始化）+ [page.tsx:153-163](frontend/app/page.tsx#L153)（13 个 useEffect 持久化）两段重复模板，前端代码省 50+ 行。

**注意**：[frontend/AGENTS.md](frontend/AGENTS.md) 提示这是 Next.js 16，部分 API 和旧版有差异，写新代码前要看 node_modules 里的官方 doc。

---

### 12. API base URL 抽环境变量

**动机**：`http://127.0.0.1:8000` 在 page.tsx 写死 8 处。组员换端口或部署到内网就要全文搜索改。

**方向**：
```ts
// frontend/app/lib/api.ts
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
```
所有 fetch 改用 `${API_BASE}/...`。

**相关位置**：[frontend/app/page.tsx](frontend/app/page.tsx) 全文

---

### 13. logging 替代 print

**动机**：当前所有调试日志用 `print`，无 level、无时间戳、无 module 区分。生产环境查问题困难。

**方向**：用 Python 标准 `logging` 模块，配置 level/format。错误路径 `logger.error(...)`，调试路径 `logger.debug(...)`。

**关键**：词库加载失败现在用 `except Exception: pass`（[backend/main.py:183](backend/main.py#L183)、[backend/main.py:208](backend/main.py#L208)），静默退化成空列表——下游业务报错没人知道。必须改成 `logger.warning("词库加载失败: %s", e)`。

---

### 14. 合并相似路由

**动机**：`/api/analyze-golden` 和 `/api/analyze-knowledge` 路由逻辑 1:1 同构，只是 prompt 不同。

**方向**：合成 `/api/analyze?type=golden|knowledge`，通过参数选 prompt。或保留两个路由但共用 `_analyze()` 内部函数。

**相关位置**：[backend/main.py:508-520](backend/main.py#L508)

---

### 15. clip_type 类型收紧

**动机**：前端 `ClipResult.clip_type: string` 但实际只有 `'golden' | 'knowledge'` 两个值，类型安全打折扣。

**方向**：
```ts
interface ClipResult {
  ...
  clip_type: 'golden' | 'knowledge'  // 而非 string
}
```

**相关位置**：[frontend/app/page.tsx:62](frontend/app/page.tsx#L62)

---

## P3 — 长期 / 锦上添花

### 16. 测试覆盖

**动机**：当前零测试，任何重构都有破坏功能的风险。

**方向**：
- 后端：`pytest` + httpx TestClient，覆盖各 API 路由的 happy path
- 前端：暂不优先（视图层测试 ROI 低）
- 核心：clean_json 三层解析、make_srt 字幕生成、词库加载——这三处必须有 unit test

---

### 17. Docker 部署

**动机**：当前组员要装 Python 3.10+、Node 18+、FFmpeg、whisper.cpp 二进制（且 whisper.cpp 在非 Mac ARM64 上要重编）。Docker 能把这些固化下来。

**方向**：写 `docker-compose.yml`，backend + frontend 两个 service。whisper.cpp 在镜像构建时编译。GPU 支持视部署目标决定。

---

### 18. 跨平台 whisper.cpp 二进制

**动机**：当前包内 `whisper-cli` 是 macOS ARM64 编译的。Intel Mac / Windows / Linux 组员要自己重编。

**方向**：
- 短期：README 里写明各平台编译命令
- 长期：CI 自动构建 4 平台二进制，按 `platform.system()` 自动选

**相关位置**：[backend/main.py:30](backend/main.py#L30)（WHISPER_CLI 路径）、[README.md](README.md)

---

### 19. 智能竖屏裁剪（mediapipe）

**动机**：如果未来想恢复"自动出竖版"功能，中间裁剪假设人物在画面正中，不适用偏左/偏右站位的博主。

**方向**：用 mediapipe 做人脸检测，每秒采样一次确定主体位置，动态调整 crop 中心。或加上下黑边方案做 fallback。

**注意**：当前已**主动去掉竖版裁剪**（2026-05-18 改动），保留完整画面。仅在用户主动要求"恢复竖版+智能构图"时考虑此项。

---

### 20. 输出格式选项

**动机**：用户可能想要"绝对零损失"切片用于商业精修。

**方向**：在切片接口加 `quality` 参数：
- `standard`（默认）：libx264 CRF 18 preset slow
- `high`：libx264 CRF 15 preset veryslow
- `lossless`：stream copy（速度极快但切割点会对齐关键帧，开头可能漂移 0-5 秒）

**相关位置**：[backend/main.py:649-665](backend/main.py#L649)

---

## ✅ 已完成（参考）

### 2026-05-18 至 05-19

- 去除竖版裁剪（`crop=ih*9/16:ih,scale=1080:1920`），保留原始横屏画面避免画面损失
- 切片合并为单次 ffmpeg 编码（避免代际损失）
- 编码参数升级：`-preset slow -crf 18 -b:a 192k -pix_fmt yuv420p -movflags +faststart`
- subprocess 增加 timeout=600
- 删除死代码 `_get_video_dimensions`
- 新增 `requirements.txt`、`.env.example`、`README.md`
- 修改文案：抖音 tab 提示 + douyin_copy.txt 说明，反映"横屏原片+二次精修"的实际逻辑
- 验证：源视频 960×432 @ 244 kbps 是糊的根因（不是切片代码问题）

---

## 推荐迭代顺序

发布给组员前必修：**1 → 2 → 3 → 4**（P0 全部）

第一轮迭代（功能 + 工程化双推）：
- 功能侧：5（AI 增强先做验证）+ 6（评测集，最有杠杆）
- 工程侧：11（前端拆分 + usePersistedState）+ 12（API base URL）

第二轮（深度优化）：7、8、10、13

第三轮（长期）：16-20
