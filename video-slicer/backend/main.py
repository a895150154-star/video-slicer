import os
import subprocess
import tempfile
import json
import re
import uuid
import shutil
import zipfile
import io
from pathlib import Path
from typing import List

import httpx
import openpyxl
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from zhconv import convert as zh_convert  # S2: whisper 输出繁体 → 简体兜底

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

WHISPER_CLI = Path(__file__).parent.parent / "whisper.cpp-master" / "build" / "bin" / "whisper-cli"
WHISPER_MODEL = Path(__file__).parent.parent / "whisper.cpp-master" / "models" / "ggml-medium.bin"
VIDEOS_DIR = Path(__file__).parent / "videos"
VIDEOS_DIR.mkdir(exist_ok=True)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="未收到文件")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in (".mp4", ".mov"):
        raise HTTPException(status_code=400, detail="仅支持 MP4 和 MOV 格式")

    with tempfile.TemporaryDirectory() as tmpdir:
        video_path = os.path.join(tmpdir, f"input{suffix}")
        audio_path = os.path.join(tmpdir, "audio.wav")
        json_path = os.path.join(tmpdir, "result.json")

        # 保存上传的视频
        content = await file.read()
        with open(video_path, "wb") as f:
            f.write(content)

        # FFmpeg 提取音频：16kHz 单声道，whisper 要求的格式
        ffmpeg_cmd = [
            "ffmpeg", "-y", "-i", video_path,
            "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le",
            audio_path
        ]
        result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            # 详细 stderr 仅记到 logs，不暴露给前端（B-2 修复，避免泄露内部命令细节）
            print(f"[transcribe] ffmpeg failed: {result.stderr[-500:]}", flush=True)
            raise HTTPException(status_code=500, detail="视频音频提取失败，请检查视频文件是否完整后重试")

        # 调用 whisper-cli 转写，输出 JSON
        # S2 修复：whisper.cpp 默认偏好繁体（粤语/港台训练数据占比高），加 initial prompt 引导简体输出
        # 下游再用 zhconv 兜底，双保险
        whisper_cmd = [
            str(WHISPER_CLI),
            "-m", str(WHISPER_MODEL),
            "-f", audio_path,
            "-l", "zh",
            "--prompt", "以下是普通话演讲的简体中文转写，内容关于创业、知识分享与个人成长。",
            "--output-json",
            "--output-file", os.path.join(tmpdir, "result"),
            "-t", str(os.cpu_count() or 4),
        ]
        result = subprocess.run(whisper_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            # 详细 stderr 仅记到 logs（B-2 修复）
            print(f"[transcribe] whisper failed: {result.stderr[-500:]}", flush=True)
            raise HTTPException(status_code=500, detail="语音转写失败，请稍后重试或检查视频音轨")

        # 读取 JSON 结果
        if not os.path.exists(json_path):
            raise HTTPException(status_code=500, detail="转写结果文件未生成")

        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        segments = []
        for seg in data.get("transcription", []):
            offsets = seg.get("offsets", {})
            start_ms = offsets.get("from", 0)
            end_ms = offsets.get("to", 0)
            text = seg.get("text", "").strip()
            # 去掉 whisper 输出中的时间戳标记（如 [00:00:00.000 --> 00:00:01.000]）
            text = re.sub(r'\[[\d:.,\s>-]+\]', '', text).strip()
            # S2 修复：兜底繁简转换，任何漏网的繁体字一次性洗成简体
            if text:
                text = zh_convert(text, 'zh-cn')
            if text:
                segments.append({
                    "start": start_ms / 1000.0,
                    "end": end_ms / 1000.0,
                    "text": text,
                })

        # 持久化保存视频，供后续切片使用
        video_id = uuid.uuid4().hex[:8]
        persistent_path = VIDEOS_DIR / f"{video_id}{suffix}"
        shutil.copy2(video_path, str(persistent_path))

        return {"segments": segments, "video_id": video_id}


# ── 阶段二：违禁词检测 + AI内容分析 ──────────────────────────────────────────

load_dotenv(Path(__file__).parent / ".env")

CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY", "")
CLAUDE_BASE_URL = os.getenv("CLAUDE_BASE_URL", "https://openrouter.ai/api/v1")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "anthropic/claude-sonnet-4.5")
DATA_DIR = Path(__file__).parent / "data"
SENSITIVE_WORDS_FILE = DATA_DIR / "sensitive_words.xlsx"
FILLER_WORDS_FILE = DATA_DIR / "filler_words.txt"


# ── Pydantic 模型 ─────────────────────────────────────────────────────────────

class SegmentIn(BaseModel):
    start: float
    end: float
    text: str

class SegmentsRequest(BaseModel):
    segments: List[SegmentIn]

class HitWord(BaseModel):
    word: str
    risk_level: str
    suggestion: str

class CheckedSegment(BaseModel):
    start: float
    end: float
    text: str
    hits: List[HitWord]


# ── 词库加载 ──────────────────────────────────────────────────────────────────

def load_sensitive_words() -> dict:
    result: dict = {"A": [], "B": [], "C": []}
    try:
        wb = openpyxl.load_workbook(SENSITIVE_WORDS_FILE, read_only=True)
        ws = wb.active
        headers = [
            str(cell.value).strip() if cell.value else ""
            for cell in next(ws.iter_rows(min_row=1, max_row=1))
        ]
        word_col = next(
            (i for i, h in enumerate(headers) if "敏感词" in h or (i == 0 and not any("敏感词" in h2 for h2 in headers))),
            0,
        )
        level_col = next(
            (i for i, h in enumerate(headers) if any(k in h for k in ["类", "级", "风险", "等级"])),
            None,
        )
        for row in ws.iter_rows(min_row=2, values_only=True):
            if not row or row[word_col] is None:
                continue
            word = str(row[word_col]).strip()
            if not word or word == "None":
                continue
            level = ""
            if level_col is not None and row[level_col]:
                level = str(row[level_col]).strip().upper()
                # 兼容 "A类"、"A级" 等写法
                level = re.sub(r'[^ABC]', '', level)[:1]
            if level in ("A", "B", "C"):
                result[level].append(word)
            else:
                result["C"].append(word)
        wb.close()
    except Exception:
        pass
    return result


def load_filler_words() -> list:
    words: list = []
    try:
        text = FILLER_WORDS_FILE.read_text(encoding="utf-8")
        in_section = False
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue
            if "第十节" in line or ("口水词" in line and not in_section):
                in_section = True
                continue
            if in_section:
                if re.match(r'^第[一二三四五六七八九十百]+节', line):
                    break
                parts = re.split(r'[，,、；;\s]+', line)
                for p in parts:
                    p = p.strip()
                    if p and 1 <= len(p) <= 10:
                        words.append(p)
    except Exception:
        pass
    return list(set(words))


# ── 辅助函数 ──────────────────────────────────────────────────────────────────

def format_hms(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


def segments_to_text(segments: List[SegmentIn]) -> str:
    return "\n".join(
        f"[{format_hms(seg.start)} - {format_hms(seg.end)}] {seg.text.strip()}"
        for seg in segments
    )


def _escape_inner_quotes(text: str) -> str:
    """把 JSON 字符串值内部未转义的双引号替换为 \\\"。
    策略：逐字符扫描，追踪是否在字符串内，遇到未转义的 " 且不是边界时转义。"""
    result = []
    in_string = False
    i = 0
    while i < len(text):
        ch = text[i]
        if ch == '\\' and in_string:
            # 转义序列，原样保留两个字符
            result.append(ch)
            i += 1
            if i < len(text):
                result.append(text[i])
            i += 1
            continue
        if ch == '"':
            if not in_string:
                in_string = True
                result.append(ch)
            else:
                # 判断是字符串结束符还是值内部的裸引号
                # 向后跳过空白，看下一个非空白字符
                j = i + 1
                while j < len(text) and text[j] in ' \t\r\n':
                    j += 1
                next_ch = text[j] if j < len(text) else ''
                # 字符串结束后应该跟 : , } ] 或文件结束
                if next_ch in (':', ',', '}', ']', ''):
                    in_string = False
                    result.append(ch)
                else:
                    # 值内部的裸引号，转义
                    result.append('\\"')
        else:
            result.append(ch)
        i += 1
    return ''.join(result)


def _sanitize_json_string(text: str) -> str:
    """清洗模型返回的 JSON 文本，处理各种导致解析失败的情况。"""
    # 去掉 ```json 和 ``` 标记
    text = re.sub(r'```json\s*', '', text)
    text = re.sub(r'```\s*', '', text)
    text = text.strip()
    # 用 chr() 替换中文引号
    text = text.replace(chr(0x201c), '"').replace(chr(0x201d), '"')
    text = text.replace(chr(0x2018), "'").replace(chr(0x2019), "'")
    return text


def clean_json(text: str, fallback_key: str = "") -> dict:
    print("[clean_json] 原始内容前150字符:", text[:150])

    # 第一层：标准清洗后直接解析
    cleaned = _sanitize_json_string(text)
    print("[clean_json] 清洗后前150字符:", cleaned[:150])
    try:
        result = json.loads(cleaned)
        print("[clean_json] 解析成功（第一层）")
        return result
    except json.JSONDecodeError as e:
        err_pos = getattr(e, 'pos', 0)
        print(f"[clean_json] 第一层失败 pos={err_pos}，附近:", cleaned[max(0, err_pos-60):err_pos+60])

    # 第一点五层：转义字符串值内部的裸双引号后再解析
    try:
        escaped = _escape_inner_quotes(cleaned)
        result = json.loads(escaped)
        print("[clean_json] 解析成功（第1.5层：转义内部引号）")
        return result
    except json.JSONDecodeError as e:
        err_pos = getattr(e, 'pos', 0)
        print(f"[clean_json] 第1.5层失败 pos={err_pos}，附近:", escaped[max(0, err_pos-60):err_pos+60])

    # 第二层：用正则提取最大 { ... } 块再解析
    obj_match = re.search(r'\{[\s\S]*\}', cleaned)
    if obj_match:
        fragment = obj_match.group(0)
        try:
            result = json.loads(fragment)
            print("[clean_json] 解析成功（第二层：提取JSON块）")
            return result
        except json.JSONDecodeError as e:
            err_pos = getattr(e, 'pos', 0)
            print(f"[clean_json] 第二层失败 pos={err_pos}，附近:", fragment[max(0, err_pos-60):err_pos+60])

    # 第三层：返回空结果，不抛异常
    import logging
    logging.warning(f"[clean_json] WARNING: 三层解析全部失败，返回空结果。fallback_key={fallback_key!r} 原始内容={text[:300]}")
    if fallback_key:
        return {fallback_key: []}
    return {}


async def call_claude(system_prompt: str, user_content: str, fallback_key: str = "") -> dict:
    if not CLAUDE_API_KEY:
        raise HTTPException(status_code=500, detail="CLAUDE_API_KEY 未配置，请在 backend/.env 中填写")
    headers = {
        "Authorization": f"Bearer {CLAUDE_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": CLAUDE_MODEL,
        "max_tokens": 4096,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
    }
    last_error = ""
    async with httpx.AsyncClient(timeout=120.0) as client:
        for attempt in range(2):
            try:
                print(f"[call_claude] 第{attempt + 1}次请求")
                resp = await client.post(
                    f"{CLAUDE_BASE_URL}/chat/completions",
                    headers=headers,
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                return clean_json(content, fallback_key=fallback_key)
            except json.JSONDecodeError as e:
                last_error = str(e)
                print(f"[call_claude] 第{attempt + 1}次JSON解析失败:", last_error)
                if attempt == 0:
                    continue
            except Exception as e:
                last_error = str(e)
                print(f"[call_claude] 第{attempt + 1}次请求异常:", last_error)
                if attempt == 0:
                    continue
    # 网络/HTTP 错误才抛 500，JSON 解析失败已在 clean_json 第三层兜底
    raise HTTPException(status_code=500, detail=f"AI请求失败（已重试一次）: {last_error}")


# ── 路由 ──────────────────────────────────────────────────────────────────────

@app.post("/api/check-words")
async def check_words(req: SegmentsRequest):
    sensitive = load_sensitive_words()
    fillers = load_filler_words()
    suggestion_map = {
        "A": "A类违禁词，必须删除或替换",
        "B": "B类敏感词，建议谨慎使用",
        "C": "C类提示词，注意使用场景",
        "filler": "口水词，建议剪辑时删除",
    }
    results = []
    for seg in req.segments:
        hits = []
        for level in ("A", "B", "C"):
            for word in sensitive.get(level, []):
                if word and word in seg.text:
                    hits.append(HitWord(word=word, risk_level=level, suggestion=suggestion_map[level]))
        for word in fillers:
            if word and word in seg.text:
                hits.append(HitWord(word=word, risk_level="filler", suggestion=suggestion_map["filler"]))
        results.append(CheckedSegment(start=seg.start, end=seg.end, text=seg.text, hits=hits))
    return {"results": [r.model_dump() for r in results]}


GOLDEN_SYSTEM_PROMPT = """你是一个短视频金句识别专家。我会给你一段视频转写文字（每行格式为"[开始时间 - 结束时间] 文字内容"）。

【重要：转写文字的特性】
转写工具按语音停顿切分句子，所以一句博主完整说出的话，可能被切成5-10个连续的短片段。你必须把这种连续的语义碎片合并成一句完整的话再判断是否为金句。

【你的工作流程】
第1步：扫描所有片段，识别哪些连续片段属于博主完整说的同一个观点
第2步：把这些连续片段合并，合并范围必须包含核心概念的引入
第3步：合并金句的start_time取第一个片段的开始时间，end_time取最后一个片段的结束时间
第4步：对合并后的完整句子按金句标准判断

【合并范围的关键原则——这是新增的硬规则】
原则1：如果合并后的金句text里出现"这个方法"、"这套思维"、"这种方式"、"它"、"这个东西"等指代不清的词，你必须往前找到这个代词指代的具体概念（比如"结构化思维"、"复盘"、"用户访谈"），把那一段一起合并进来。
原则2：金句的开头必须是一个完整的概念或主语，不能从"但是"、"所以"、"然后"、"你"、"我"、"他们"、"这个"等连接词或代词开始。如果合并后的开头是这些词，必须往前扩展直到找到完整的主语或概念引入。
原则3：观众没看过原视频，看到这段金句text的第一句话就应该明白"在讲什么主题"。如果第一句话还需要"上下文才能理解"，说明合并范围不够，必须往前扩展。

【口语碎句过滤标准——合并和评分前的硬规则】
注意：本规则只过滤"整句"作为候选，不修改句子内部任何词语。

排除以下类型的整句作为金句候选（即使其他维度评分高也不要进候选池）：
1. 重复句：与前后句表达完全相同或高度相似（信息冗余）
2. 自我否定句：博主当场改口后明确否定的前一句（如博主说"不对，应该是..."，那"应该是..."前面那句要排除）
3. 跳跃句：突然插入、与当前话题无关的整句（比如临时回应弹幕、突然吃东西的描述）
4. 题外话：仅在删除后能让金句更完整时排除（如果删除会破坏语义连贯性，则保留）

保留以下类型（即使含有"那个/嗯/就是/啊/这个"等填充词也必须保留）：
- 情绪强化句（"这真的特别重要"、"我必须说"）
- 反问句（"你想想看，谁会..."、"难道不是吗？"）
- 转折句（"但是..."、"然而..."、"可是..."）
- 强调句（带语气词的语义峰值）
- 观点句（直接表达立场或判断）
- 总结句（"所以..."、"因此..."、"这就是..."）

关键判断准则：
- 只过滤整句，不修改句子内部任何词
- 口语填充词（那个/嗯/就是/啊/呃）不作为排除依据，正式剪辑时由用户后期处理
- 题外话是否排除，唯一标准是"删了之后金句是否更完整"

【金句必须属于以下四类之一，否则不是金句】
1. 观点型：对某个问题有明确的判断、立场、结论
2. 反常识型：打破用户已有认知，形成"原来不是这样"的反差
3. 情绪共鸣型：击中用户普遍困惑、表达用户难以说清的感受
4. 方法论型：提供可执行的方法、判断标准、步骤或框架

【完整性硬规则——违反任何一条立即排除】
规则1：金句text的最后一个字不能是"的"、"在"、"了"、"也"、"就"、"是"、"和"、"与"、"或"等助词或连接词
规则2：金句text的第一个词不能是"但是"、"所以"、"然后"、"你"、"我"、"他们"、"这个"、"那个"、"它"等连接词或代词
规则3：金句text字数必须在20到200字之间
规则4：金句对应视频时长必须在5秒到45秒之间

【以下情况一律不是金句】
- 铺垫类、空泛鸡汤类、半句铺垫、强上下文依赖、寒暄开场、普通描述

【自检清单】
对每个候选金句问自己：
- 第一句话是不是从一个完整的概念或主语开始？如果从代词或连接词开始，立即排除
- 金句里有没有"这个/那个/它/这套/这种"这类指代词？如果有，前面有没有合并到指代对象？没有的话立即排除
- 把这段金句单独发给一个完全没看过原视频的人，他能不能完整理解？

【输出要求 — 6 维度评分体系】
对每个候选金句按 6 个维度独立评分（0-X 各维度满分见下），总分 = 6 维度求和（0-100）：

维度 1【知识完整性】(0-25)：金句是否构成完整观点单元，有始有终
  - 21-25 完整自闭环；14-20 主体清晰但略残缺；7-13 有倾向但完整性不足；0-6 碎片化
维度 2【独立可理解性】(0-20)：脱离直播上下文观看者能否理解
  - 17-20 完全独立；11-16 基本可懂少量指代但不影响；5-10 有理解障碍；0-4 强依赖上下文
维度 3【学习价值】(0-20)：观看者看完是否获得清晰认知收获
  - 17-20 信息增量高可应用；11-16 有价值但可迁移性一般；5-10 信息增量有限；0-4 几乎无价值
维度 4【表达清晰度】(0-15)：口语清洗后表达是否清晰
  - 13-15 清晰可直接用；8-12 基本清晰需轻度整理；3-7 较混乱需大清洗；0-2 严重混乱
维度 5【时长适配性】(0-10)：金句对应视频时长是否在 5-45 秒区间
  - 9-10 时长精准 8-30s；6-8 在区间附近轻微偏差；3-5 较大偏差；0-2 严重不匹配
维度 6【安全合规】(0-10)：是否存在审核/敏感/误导风险
  - 9-10 无任何风险；6-8 轻微风险；3-5 明显风险；0-2 高风险（compliance<3 必标 high）

最终 score 必须等于 6 个维度之和。整体打分参考：
- 90+ 强金句优先推荐；75-89 可用金句进候选；60-74 备选；<60 不输出

【title 字段硬规则——必须遵守】
title 是给抖音/B 站卡片用的"钩子标题"，**不是 text 的截断**。要求：
- 简体中文，8-18 字
- 必须是完整短语或完整钩子句，不能是半句
- 不能以"但是、所以、然后、你、我、他们、这个、那个、它"等连接词或代词开头
- 不能以"的、了、就、是、和、或、也、在"等助词结尾
- 风格上要"钩子化"：要么是反常识断言、要么是引发好奇的问题、要么是凝练的方法论结论
- 例如不要写"创业根本不是这样的创业就是在一个小黑屋"（半句截断），要写"创业的真相：一个人在小黑屋里硬扛"（钩子化重写）

返回格式（严格 JSON，按以下 schema）：
{
  "golden_sentences": [
    {
      "start_time": "00:01:38",
      "end_time": "00:01:50",
      "title": "钩子化简体中文标题（8-18字，不是 text 的截断）",
      "text": "合并后的完整金句，必须从完整概念或主语开始，结尾不能是助词",
      "type": "观点型/反常识型/情绪共鸣型/方法论型",
      "reason": "具体说明这个金句的观点/方法/反差/共鸣是什么",
      "score_breakdown": {
        "completeness": 22,
        "independence": 18,
        "learning_value": 17,
        "clarity": 13,
        "duration_fit": 8,
        "compliance": 9
      },
      "score": 87,
      "risk_level": "low"
    }
  ]
}

risk_level 规则：compliance 维度 ≥8 → "low"；3-7 → "medium"；<3 → "high"。
只返回JSON。如果没有合格金句，返回 {"golden_sentences": []}。"""


KNOWLEDGE_SYSTEM_PROMPT = """你是一个短视频知识点段落识别专家。我会给你一段视频转写文字（每行格式为"[开始时间 - 结束时间] 文字内容"）。

【知识点段落的严格定义】
知识点段落是一个完整的知识讲解单元，必须能让观众看完一段就学到一个具体的方法、概念或洞察。

【知识点段落必须满足以下全部条件】
1. 三段式结构完整：有引入（提出问题或概念）+ 讲解（具体说明）+ 总结（给出结论或方法）
2. 主题明确单一：围绕一个具体的知识点展开，不是杂谈
3. 自闭环：段落内能讲清楚，不依赖外部背景
4. 时长1-5分钟：太短说明没讲透，太长说明跑题

【以下情况不是知识点段落】
- 只有铺垫没有展开：博主说"接下来我讲一个方法"，但后面没真讲清楚
- 只有结论没有讲解：博主直接抛出观点但没解释
- 跑题闲聊：博主在主题之间来回跳
- 重复表达：反复说同一件事没有新内容

【口语碎句边界处理——确定 start_time / end_time 的硬规则】
注意：本规则只调整段落起止时间，不修改 text 内容；段落内部即使有少量碎句也应保留以保证讲解连贯。

不应作为段落起点（如果初始 start_time 落在这里，往后顺延到下一句完整句）：
- 重复句：与前句几乎相同
- 自我否定句：博主当场否定的话（如"不对，应该是..."的前一句）
- 跳跃句：突然插入的无关话题（如临时回应弹幕）
- 半句话：缺少主语或谓语
- 以"但是/所以/然后/这个/那个/它/你/我/他们"等连接词或代词开头的句子

不应作为段落终点（如果初始 end_time 落在这里，往前回退到上一句完整结束）：
- 半句话：未完整结束
- 自我否定句：之后被博主否定的话
- 以"的/在/了/也/就/是/和/与/或/嗯/啊"等助词或口语词结尾

关键判断准则：
- 填充词（那个/嗯/就是/啊/呃）不作为边界判断依据
- 段落内部如果有少量自我否定或题外话，保留即可（用户后期剪辑会处理）
- 起止点必须落在"完整句的句首/句末"，否则切出来的视频会让观众听到半句话

【自检】
识别完成后，对每个候选段落问自己：
- 观众看完这段，能不能用一句话总结"我学到了什么"？如果不能，不是知识点段落
- 这段有没有具体的方法、步骤、或可操作的内容？如果只是泛泛而谈，不是知识点段落
- 段落首尾是否完整？如果切断在半句话里，需要调整时间戳

【与金句的区别】
- 金句：15-60秒的传播点，浓缩的钩子
- 知识点段落：1-5分钟的完整讲解，展开的干货
- 同一段内容里如果有金句，金句应该被包含在知识点段落的范围内
- 不要把一句话当成知识点段落，知识点段落必须有完整的讲解过程

【知识点类型分类（6 种，每个段落归到 1 种）】
- 概念解释型：围绕一个概念展开 "这个东西是什么"
- 方法步骤型：给出可执行的步骤或框架 "怎么做"
- 误区纠正型：指出错误认知给出正确做法 "你以为是A 其实是B"
- 案例拆解型：通过真实案例提炼可迁移规律
- 工具技巧型：围绕具体工具给出使用技巧或避坑
- 观点结论型：对某现象给出高度凝练的判断

【输出要求 — 6 维度评分体系】
对每个候选段落按 6 个维度独立评分（0-X 各维度满分见下），总分 = 6 维度求和（0-100）：

维度 1【知识完整性】(0-25)：段落是否围绕主题有引入+讲解+收束的完整结构
  - 21-25 三段式完整；14-20 主体清晰略残缺；7-13 倾向不足；0-6 碎片化
维度 2【独立可理解性】(0-20)：脱离直播上下文观看者能否理解
  - 17-20 完全独立；11-16 基本可懂少量指代不影响；5-10 有理解障碍；0-4 强依赖上下文
维度 3【学习价值】(0-20)：观看者看完是否获得清晰认知收获
  - 17-20 信息增量高可应用；11-16 有价值但可迁移性一般；5-10 信息增量有限；0-4 几乎无价值
维度 4【表达清晰度】(0-15)：口语清洗后表达是否清晰
  - 13-15 清晰可直接用；8-12 基本清晰需轻度整理；3-7 较混乱需大清洗；0-2 严重混乱
维度 5【时长适配性】(0-10)：段落实际时长是否在 60-300 秒区间
  - 9-10 时长 90-180s 精准；6-8 区间附近轻微偏差；3-5 较大偏差；0-2 严重不匹配
维度 6【安全合规】(0-10)：是否存在审核风险/敏感表达/误导性内容/夸大效果的经验分享
  - 9-10 无任何风险；6-8 轻微风险；3-5 明显风险；0-2 高风险（compliance<3 必标 high 不进推荐）

最终 score 必须等于 6 个维度之和。整体打分参考：
- 90+ 强知识点优先推荐；75-89 可用进候选；60-74 备选；<60 不输出

返回格式（严格 JSON，按以下 schema）：
{
  "knowledge_segments": [
    {
      "start_time": "00:01:00",
      "end_time": "00:03:30",
      "title": "用一句话概括这段讲了什么知识点",
      "summary": "引入+讲解+结论三句话说明",
      "key_takeaway": "观众能学到的具体方法或洞察，必须具体可操作",
      "type": "概念解释型/方法步骤型/误区纠正型/案例拆解型/工具技巧型/观点结论型",
      "score_breakdown": {
        "completeness": 22,
        "independence": 18,
        "learning_value": 17,
        "clarity": 13,
        "duration_fit": 8,
        "compliance": 9
      },
      "score": 87,
      "risk_level": "low",
      "recommendation_reason": "一句话说明为什么这条值得切（哪一类知识点 + 哪个维度突出）"
    }
  ]
}

risk_level 规则：compliance 维度 ≥8 → "low"；3-7 → "medium"；<3 → "high"。
只返回JSON。如果整段转写里没有合格段落，返回 {"knowledge_segments": []}。"""


@app.post("/api/analyze-golden")
async def analyze_golden(req: SegmentsRequest):
    result = await call_claude(GOLDEN_SYSTEM_PROMPT, segments_to_text(req.segments), fallback_key="golden_sentences")
    return result



@app.post("/api/analyze-knowledge")
async def analyze_knowledge(req: SegmentsRequest):
    print("[analyze-knowledge] 收到请求，segments数量:", len(req.segments))
    result = await call_claude(KNOWLEDGE_SYSTEM_PROMPT, segments_to_text(req.segments), fallback_key="knowledge_segments")
    print("[analyze-knowledge] 返回:", result)
    return result


# ── 阶段三：视频切片 + 字幕 + 文案 + 打包下载 ─────────────────────────────────

class ClipItem(BaseModel):
    start_time: str
    end_time: str
    title: str
    clip_type: str
    text: str

class ProcessClipsRequest(BaseModel):
    video_id: str
    clips: List[ClipItem]

class RegenerateTextRequest(BaseModel):
    title: str
    clip_type: str
    transcript: str


def hms_to_seconds(hms: str) -> float:
    parts = hms.split(":")
    return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2] if len(parts) > 2 else 0)


def make_srt(segments: list, clip_start: float) -> str:
    lines = []
    idx = 1
    for seg in segments:
        s = seg["start"] - clip_start
        e = seg["end"] - clip_start
        if e <= 0:
            continue
        s = max(0.0, s)

        def fmt(t: float) -> str:
            h = int(t // 3600)
            m = int((t % 3600) // 60)
            sec = int(t % 60)
            ms = int(round((t - int(t)) * 1000))
            return f"{h:02d}:{m:02d}:{sec:02d},{ms:03d}"

        lines.append(str(idx))
        lines.append(f"{fmt(s)} --> {fmt(e)}")
        lines.append(seg["text"].strip())
        lines.append("")
        idx += 1
    return "\n".join(lines)


COPY_SYSTEM_PROMPT = """你是一个短视频文案专家。我会给你一段博主的原话内容和标题。请分别生成抖音和B站风格的标题和文案。

【最重要的硬规则——不能违反】
规则1：文案的核心观点必须严格基于博主原话的内容，绝对不能编造博主没说过的观点、案例、数据或结论
规则2：标题可以是对博主观点的钩子化总结，但总结的内容必须能在原话里找到依据
规则3：文案里所有的"事实陈述"都必须来自原话，不能添加你自己脑补的内容
规则4：你可以在文案末尾加一句互动引导语（比如"你怎么看？""有没有同感？"），这部分允许是你写的

【抖音风格】
- 标题：≤30字，强情绪强钩子，多用感叹号、数字、悬念词
- 文案（caption）：50-150字，痛点钩子+原话核心观点+互动引导

【B站风格】
- 标题：≤40字，重点突出干货价值
- 文案（caption）：100-300字，开头点题+原话核心观点+总结引导

无论内容多少，你必须只返回合法JSON，不得输出任何其他文字。格式如下：
{
  "douyin": {
    "title": "抖音标题",
    "caption": "抖音文案"
  },
  "bilibili": {
    "title": "B站标题",
    "caption": "B站文案"
  }
}"""


def _find_video_file(video_id: str) -> Path:
    for suffix in (".mp4", ".mov", ".MP4", ".MOV"):
        p = VIDEOS_DIR / f"{video_id}{suffix}"
        if p.exists():
            return p
    raise HTTPException(status_code=404, detail=f"视频文件不存在: {video_id}")


@app.post("/api/process-clips")
async def process_clips(req: ProcessClipsRequest):
    video_path = _find_video_file(req.video_id)
    out_base = VIDEOS_DIR / req.video_id
    out_base.mkdir(exist_ok=True)

    results = []
    for i, clip in enumerate(req.clips):
        clip_dir = out_base / f"clip_{i:02d}"
        clip_dir.mkdir(exist_ok=True)

        clip_path = str(clip_dir / "clip.mp4")
        vertical_path = str(clip_dir / "vertical.mp4")
        thumb_path = str(clip_dir / "thumb.jpg")
        srt_path = str(clip_dir / "subtitle.srt")

        start_sec = hms_to_seconds(clip.start_time)
        end_sec = hms_to_seconds(clip.end_time)
        duration = end_sec - start_sec
        mid_sec = duration / 2.0

        clip_error = None
        copy_data = {"douyin": {"title": clip.title, "caption": ""}, "bilibili": {"title": clip.title, "caption": ""}}

        try:
            # 1. 单次切片，高质量编码，保留原始横屏画面不做竖版裁剪
            r = subprocess.run([
                "ffmpeg", "-y",
                "-i", str(video_path),
                "-ss", str(start_sec),
                "-to", str(end_sec),
                "-c:v", "libx264", "-preset", "slow", "-crf", "18",
                "-c:a", "aac", "-b:a", "192k",
                "-pix_fmt", "yuv420p",
                "-movflags", "+faststart",
                clip_path,
            ], capture_output=True, text=True, timeout=600)
            if r.returncode != 0:
                raise RuntimeError(f"切片失败: {r.stderr[-300:]}")

            # vertical 路径仅为兼容前端和下载结构保留，内容与横屏一致
            shutil.copy2(clip_path, vertical_path)

            # 3. 缩略图（取片段中间帧，-ss 放 -i 前用 input seeking，速度更快）
            r3 = subprocess.run([
                "ffmpeg", "-y",
                "-ss", str(mid_sec),
                "-i", clip_path,
                "-frames:v", "1",
                "-q:v", "2",
                thumb_path,
            ], capture_output=True, text=True)
            if r3.returncode != 0:
                raise RuntimeError(f"缩略图生成失败: {r3.stderr[-300:]}")

            # 4. 生成 SRT 字幕
            segs_in_range = [
                s for s in []  # segments 不在此处传入，用 clip.text 生成简单字幕
            ]
            # 用 clip.text 生成单条字幕（覆盖整个片段）
            srt_content = f"1\n00:00:00,000 --> {_seconds_to_srt_time(duration)}\n{clip.text.strip()}\n"
            Path(srt_path).write_text(srt_content, encoding="utf-8")

            # 5. 调用 Claude 生成文案（串行，调用后 sleep 3s）
            user_content = f"标题：{clip.title}\n\n转写文字：\n{clip.text}"
            copy_data = await call_claude(COPY_SYSTEM_PROMPT, user_content, fallback_key="douyin")
            if "douyin" not in copy_data:
                copy_data = {"douyin": {"title": clip.title, "caption": ""}, "bilibili": {"title": clip.title, "caption": ""}}

        except Exception as e:
            clip_error = str(e)

        # 每个 clip 处理完后等待 3 秒，避免 Claude API 限流
        if i < len(req.clips) - 1:
            import asyncio
            await asyncio.sleep(3)

        # 写入 meta.json 供 download-package 读取 clip_type
        (clip_dir / "meta.json").write_text(
            json.dumps({"clip_type": clip.clip_type, "title": clip.title}, ensure_ascii=False),
            encoding="utf-8"
        )

        results.append({
            "index": i,
            "title": clip.title,
            "clip_type": clip.clip_type,
            "video_path": f"clip_{i:02d}/clip.mp4",
            "vertical_path": f"clip_{i:02d}/vertical.mp4",
            "thumb_path": f"clip_{i:02d}/thumb.jpg",
            "srt_path": f"clip_{i:02d}/subtitle.srt",
            "copy": copy_data,
            "error": clip_error,
        })

    return {"clips": results, "video_id": req.video_id}


def _seconds_to_srt_time(t: float) -> str:
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = int(t % 60)
    ms = int(round((t - int(t)) * 1000))
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


@app.post("/api/regenerate-text")
async def regenerate_text(req: RegenerateTextRequest):
    user_content = f"标题：{req.title}\n\n转写文字：\n{req.transcript}"
    result = await call_claude(COPY_SYSTEM_PROMPT, user_content, fallback_key="douyin")
    if "douyin" not in result:
        result = {"douyin": {"title": req.title, "caption": ""}, "bilibili": {"title": req.title, "caption": ""}}
    return result


@app.get("/api/get-clip-video")
async def get_clip_video(video_id: str, clip_index: int, type: str = "vertical"):
    clip_dir = VIDEOS_DIR / video_id / f"clip_{clip_index:02d}"
    if type == "thumb":
        file_path = clip_dir / "thumb.jpg"
        media_type = "image/jpeg"
    elif type == "original":
        file_path = clip_dir / "clip.mp4"
        media_type = "video/mp4"
    else:
        file_path = clip_dir / "vertical.mp4"
        media_type = "video/mp4"

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")
    return FileResponse(str(file_path), media_type=media_type)


@app.get("/api/download-package")
async def download_package(video_id: str):
    base_dir = VIDEOS_DIR / video_id
    if not base_dir.exists():
        raise HTTPException(status_code=404, detail="视频切片不存在")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for clip_dir in sorted(base_dir.glob("clip_*")):
            if not clip_dir.is_dir():
                continue
            idx = clip_dir.name  # e.g. "clip_00"

            # 读取 clip_type
            meta_path = clip_dir / "meta.json"
            clip_type = "golden"
            if meta_path.exists():
                try:
                    clip_type = json.loads(meta_path.read_text(encoding="utf-8")).get("clip_type", "golden")
                except Exception:
                    pass

            vertical = clip_dir / "vertical.mp4"
            original = clip_dir / "clip.mp4"
            srt = clip_dir / "subtitle.srt"
            douyin_copy = clip_dir / "douyin_copy.txt"
            bilibili_copy = clip_dir / "bilibili_copy.txt"

            # 抖音：所有切片（金句 + 知识点）
            if vertical.exists():
                zf.write(str(vertical), f"douyin/{idx}/vertical.mp4")
            if srt.exists():
                zf.write(str(srt), f"douyin/{idx}/subtitle.srt")
            if douyin_copy.exists():
                zf.write(str(douyin_copy), f"douyin/{idx}/douyin_copy.txt")

            # B站：只包含知识点段落
            if clip_type == "knowledge":
                if original.exists():
                    zf.write(str(original), f"bilibili/{idx}/clip.mp4")
                if srt.exists():
                    zf.write(str(srt), f"bilibili/{idx}/subtitle.srt")
                if bilibili_copy.exists():
                    zf.write(str(bilibili_copy), f"bilibili/{idx}/bilibili_copy.txt")

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=clips_{video_id}.zip"},
    )


@app.post("/api/save-copy")
async def save_copy(data: dict):
    """前端在下载前调用，将编辑后的文案写入磁盘，供打包时使用。"""
    video_id = data.get("video_id", "")
    clips = data.get("clips", [])
    for clip in clips:
        idx = clip.get("index", 0)
        clip_dir = VIDEOS_DIR / video_id / f"clip_{idx:02d}"
        if not clip_dir.exists():
            continue
        douyin = clip.get("douyin", {})
        bilibili = clip.get("bilibili", {})
        if douyin:
            douyin_notice = (
                "=== 说明 ===\n"
                "金句切片（15-60秒）和知识点段落（2-5分钟）都适合抖音发布。\n"
                "=================\n\n"
                "=== 重要提示 ===\n"
                "本文件夹内为原始横屏切片（未做竖版适配，画面完整保留）。\n"
                "如需发布到抖音/小红书等竖屏平台，请用剪映或Pr 二次精修：\n"
                "1. 做竖屏改版（人物贴片+主素材构图，或上下加黑边）\n"
                "2. 调整字幕位置避免被平台UI遮挡\n"
                "=================\n\n"
            )
            (clip_dir / "douyin_copy.txt").write_text(
                douyin_notice + f"{douyin.get('title', '')}\n\n{douyin.get('caption', '')}", encoding="utf-8"
            )
        if bilibili:
            bilibili_notice = (
                "=== 说明 ===\n"
                "B站短视频区权重较低，本工具只为B站生成知识点段落版本（2-5分钟），适合B站知识区传播。\n"
                "=================\n\n"
            )
            (clip_dir / "bilibili_copy.txt").write_text(
                bilibili_notice + f"{bilibili.get('title', '')}\n\n{bilibili.get('caption', '')}", encoding="utf-8"
            )
    return {"ok": True}

