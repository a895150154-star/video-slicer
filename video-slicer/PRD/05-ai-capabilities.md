# 5. AI 能力配置

> 本文件是 PRD/ 文件夹的第 5 部分。如需了解产品全貌请先读 [README.md](./README.md)。
> 上一模块：[04-pages-components.md](./04-pages-components.md) · 下一模块：[07-business-logic.md](./07-business-logic.md)

> 📌 这是产品最核心的护城河 — V4 Prompt 经过 4 版迭代（详见 [APPENDIX-pitfalls.md](./APPENDIX-pitfalls.md) §「Prompt 迭代版本史」）。文中所有 prompt 都从 `backend/main.py` 1:1 摘录，不重写。

---

## 5.1 AI 配置架构

**模型**：Claude Sonnet 4-6（通过蓝衣 API 中转，OpenAI-兼容协议）。
**SDK**：直接用 `httpx` POST，不用 Anthropic 官方 SDK（因中转商用 OpenAI 格式，[踩坑 #3](./APPENDIX-pitfalls.md)）。

```python
# backend/main.py:118-120
CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY", "")
CLAUDE_BASE_URL = "https://lanyiapi.com/v1"
CLAUDE_MODEL = "claude-sonnet-4-6"
```

调用包装：`call_claude(system_prompt, user_content, fallback_key)` → 返回 `dict`，已含 JSON 清洗 + 三层兜底（[踩坑 #5/#6](./APPENDIX-pitfalls.md)）。

## 5.2 AI 调用点清单

| 调用点 | 触发时机 | Prompt 常量名 | 输入 | 期望输出 | 失败兜底 |
|---|---|---|---|---|---|
| **C1 违禁词二校** | 步骤 2 进入，词库扫描后对命中段做 AI 复核 | （硬编码在 `check_words`）| 命中段文本 + 词库类别 | `{risk_level, suggestion}` | 返回原词库标签 |
| **C2 金句识别** | 步骤 2 进入，并行触发 | `GOLDEN_SYSTEM_PROMPT` | 所有 segments 拼成 `[hh:mm:ss - hh:mm:ss] 文字` 多行格式 | `{golden_sentences: [...]}` | 空数组 |
| **C3 知识点识别** | 步骤 2 进入，并行触发 | `KNOWLEDGE_SYSTEM_PROMPT` | 同 C2 | `{knowledge_segments: [...]}` | 空数组 |
| **C4 双平台文案生成** | 步骤 4 切片时 + 用户点"重新生成文案"时 | `COPY_SYSTEM_PROMPT` | `clip.title + clip.text` | `{douyin: {title, caption}, bilibili: {title, caption}}` | 标题降级为 clip.title 原值，caption 留空 |

**关键工程纪律**：
- C2 + C3 必须**串行** + 调用间隔 ≥ 3 秒（[踩坑 #7](./APPENDIX-pitfalls.md) 并发限流）
- 所有 LLM 输出都过 `clean_json()` 三层兜底（去 markdown / 转义中文引号 / fallback_key 提取，[踩坑 #5 #6](./APPENDIX-pitfalls.md)）

## 5.3 C2 金句识别 Prompt（V4 版，当前生产）

> 完整代码：`backend/main.py:394-452`

```
你是一个短视频金句识别专家。我会给你一段视频转写文字
（每行格式为"[开始时间 - 结束时间] 文字内容"）。

【重要：转写文字的特性】
转写工具按语音停顿切分句子，所以一句博主完整说出的话，
可能被切成5-10个连续的短片段。你必须把这种连续的语义碎片
合并成一句完整的话再判断是否为金句。

【你的工作流程】
第1步：扫描所有片段，识别哪些连续片段属于博主完整说的同一个观点
第2步：把这些连续片段合并，合并范围必须包含核心概念的引入
第3步：合并金句的start_time取第一个片段的开始时间，
        end_time取最后一个片段的结束时间
第4步：对合并后的完整句子按金句标准判断

【合并范围的关键原则——这是新增的硬规则】
原则1：如果合并后的金句text里出现"这个方法"、"这套思维"、"这种方式"、
       "它"、"这个东西"等指代不清的词，你必须往前找到这个代词
       指代的具体概念（比如"结构化思维"、"复盘"、"用户访谈"），
       把那一段一起合并进来。
原则2：金句的开头必须是一个完整的概念或主语，不能从"但是"、"所以"、
       "然后"、"你"、"我"、"他们"、"这个"等连接词或代词开始。
原则3：观众没看过原视频，看到这段金句text的第一句话就应该明白
       "在讲什么主题"。

【金句必须属于以下四类之一，否则不是金句】
1. 观点型：对某个问题有明确的判断、立场、结论
2. 反常识型：打破用户已有认知，形成"原来不是这样"的反差
3. 情绪共鸣型：击中用户普遍困惑、表达用户难以说清的感受
4. 方法论型：提供可执行的方法、判断标准、步骤或框架

【完整性硬规则——违反任何一条立即排除】
规则1：金句text的最后一个字不能是"的"、"在"、"了"、"也"、"就"、"是"、
       "和"、"与"、"或"等助词或连接词
规则2：金句text的第一个词不能是"但是"、"所以"、"然后"、"你"、"我"、
       "他们"、"这个"、"那个"、"它"等连接词或代词
规则3：金句text字数必须在20到200字之间
规则4：金句对应视频时长必须在5秒到45秒之间

【输出要求】
只返回JSON，宁缺毋滥。打分标准：
- 90分以上：四类金句之一，表达极精炼，可直接做封面大字
- 80-89分：明确属于四类之一，表达完整，主题清晰
- 70-79分：属于四类之一但表达稍弱
- 70分以下不输出

返回格式：
{
  "golden_sentences": [
    {
      "start_time": "00:01:38",
      "end_time": "00:01:50",
      "text": "合并后的完整金句",
      "type": "观点型/反常识型/情绪共鸣型/方法论型",
      "reason": "具体说明这个金句的观点/方法/反差/共鸣是什么",
      "score": 85
    }
  ]
}
```

**Temperature**：默认（蓝衣中转的默认值，约 1.0）。**Max tokens**：未显式设置（中转默认）。

## 5.4 C3 知识点识别 Prompt（当前生产）

> 完整代码：`backend/main.py:455-505`

核心要点（不重复完整 prompt 文本，见源码）：

- 知识点 = "完整知识讲解单元 + 三段式（引入/讲解/总结） + 主题单一 + 自闭环 + 时长 1-5 分钟"
- 排除：只有铺垫无展开 / 只有结论无讲解 / 跑题闲聊 / 重复表达
- 自检：观众能不能"一句话总结学到了什么"？
- 与金句区分：金句 15-60s，知识点 1-5min；金句应被知识点包含

输出字段：
```json
{
  "knowledge_segments": [{
    "start_time": "00:01:00",
    "end_time": "00:03:30",
    "title": "...",
    "summary": "三句话讲明白引入/讲解/结论",
    "key_takeaway": "观众能学到的具体方法",
    "score": 85
  }]
}
```

## 5.5 ⚠️ V1 范围内的 Prompt 改造（6 维度评分体系）

> 用户决策：保留 100 分制 6 维度评分（让用户看见分数 + 按分选切片）。

**现状**：当前 prompt 仅输出 `score: 0-100` 单字段。
**V1 升级**：让 C2 + C3 都输出 6 维度分数 + 类型标签 + 风险等级 + 推荐理由。

升级后的输出 schema（见 [04-pages-components.md](./04-pages-components.md) §4.4.1）：

```json
{
  "knowledge_segments": [{
    "start_time": "00:01:00",
    "end_time": "00:03:30",
    "title": "...",
    "summary": "...",
    "type": "concept|method|pitfall|case|tool|opinion",
    "risk_level": "low|medium|high",
    "score": 85,
    "score_breakdown": {
      "completeness": 22,
      "independence": 18,
      "learning_value": 17,
      "clarity": 13,
      "duration_fit": 8,
      "compliance": 7
    },
    "recommendation_reason": "为什么这条值得切（一句话）"
  }]
}
```

**改造工作量**（[B 阶段 blockers 评估](./09-error-handling.md)）：
- Prompt 改写 + 调试输出稳定性：1-2 小时
- 前端 TS interface 扩展：30 分钟
- 前端列表卡片只显总分 → 已经是的 UI，不改
- 前端详情页 6 维度条形图组件：2-3 小时
- **总计 4-6 小时**，1 周窗口可承受

**风险**：6 维度输出后 token 量上涨 ≈ 40%，可能让 API 成本翻倍 + Claude 偶发不遵守 schema。**已知缓解**：`clean_json` 三层兜底 + 单维度兜底默认 0（让总分仍可显）。

## 5.6 C4 文案生成 Prompt（当前生产）

> 完整代码：`backend/main.py:572-598`

**最重要的硬规则**（**这是踩坑 #11 反编造对策的真正落地点**）：
```
规则1：文案的核心观点必须严格基于博主原话的内容，绝对不能编造博主没说过的观点、案例、数据或结论
规则2：标题可以是对博主观点的钩子化总结，但总结的内容必须能在原话里找到依据
规则3：文案里所有的"事实陈述"都必须来自原话，不能添加你自己脑补的内容
规则4：你可以在文案末尾加一句互动引导语（"你怎么看？"），这部分允许是你写的
```

输出：抖音版（≤30字标题 + 50-150字 caption）+ B 站版（≤40字标题 + 100-300字 caption），全部 strict JSON。

## 5.7 流式响应（V1 不做）

V1 全部用同步 await + spinner。各阶段时长：
- 转写：1 小时直播 ≈ 3-5 分钟（M2 芯片 CPU）
- 金句 / 知识点识别：8-25 秒（取决于 segments 数量）
- 文案生成：每条 5-10 秒
- 切片 + 编码：每条 30-60 秒（CRF 18 preset slow 慢）

V2 考虑 SSE 流式给用户更好的等待体验。

## 5.8 JSON 解析三层兜底（`clean_json` 函数）

> 完整代码：`backend/main.py:269-323`

**层 1**：直接 `json.loads(raw)`
**层 2**：剥 ` ```json ... ``` ` markdown 包裹（[踩坑 #5](./APPENDIX-pitfalls.md)）+ 重试解析
**层 3**：用 `_sanitize_json_string` 转义字符串值内的裸中文双引号（[踩坑 #6](./APPENDIX-pitfalls.md)）+ 重试

全部失败 → 返回 `{ fallback_key: [] }` 让上层降级处理（不抛异常）。

---

> Prompt 维护：`backend/main.py` 是 prompt 的**唯一来源**。修改后必须人工跑 5 条真实测试样本，确认输出仍符合规范再上线。本文档仅是 prompt 的**说明性引用**，不是源代码。
