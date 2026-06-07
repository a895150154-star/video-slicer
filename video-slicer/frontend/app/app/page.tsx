'use client'

import { useState, useRef, useEffect } from 'react'
import { AppShell } from '../components/AppShell'
import { HomeView } from '../components/HomeView'
import { HistoryView } from '../components/HistoryView'

// UUID 模式 — 防御性检测：32 位 hex 字符串作为文件名说明用户上传了 backend 生成的中间产物
// 这种情况下不展示文件名，避免暴露内部 ID
const UUID_FILENAME_PATTERN = /^[0-9a-f]{8,}\.(mp4|mov)$/i

function isLikelyInternalId(filename: string): boolean {
  return UUID_FILENAME_PATTERN.test(filename)
}

function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

interface Segment {
  start: number
  end: number
  text: string
}

interface HitWord {
  word: string
  risk_level: 'A' | 'B' | 'C' | 'filler'
  suggestion: string
}

interface CheckedSegment {
  start: number
  end: number
  text: string
  hits: HitWord[]
}

interface ScoreBreakdown {
  completeness: number     // 知识完整性 0-25
  independence: number     // 独立可理解性 0-20
  learning_value: number   // 学习价值 0-20
  clarity: number          // 表达清晰度 0-15
  duration_fit: number     // 时长适配性 0-10
  compliance: number       // 安全合规 0-10
}

type RiskLevel = 'low' | 'medium' | 'high'

interface GoldenSentence {
  start_time: string
  end_time: string
  title?: string                      // S1 修复：LLM 重写的钩子标题（8-18 字简体），旧数据可能无此字段
  text: string
  type?: string                       // 观点型/反常识型/情绪共鸣型/方法论型
  reason: string
  score: number                       // 总分 = breakdown sum
  score_breakdown?: ScoreBreakdown    // V1 6 维度细分（可能 LLM 暂未返回）
  risk_level?: RiskLevel
}

interface KnowledgeSegment {
  start_time: string
  end_time: string
  title: string
  summary: string
  key_takeaway?: string
  type?: string                       // 6 种知识点类型
  score: number                       // 总分 = breakdown sum
  score_breakdown?: ScoreBreakdown    // V1 6 维度细分
  risk_level?: RiskLevel
  recommendation_reason?: string      // AI 推荐理由
}

interface AnalyzingState {
  words: boolean
  golden: boolean
  knowledge: boolean
}

interface ClipItem {
  start_time: string
  end_time: string
  title: string
  clip_type: 'golden' | 'knowledge'
  text: string
}

interface PlatformCopy {
  title: string
  caption: string
}

interface ClipResult {
  index: number
  title: string
  clip_type: string
  video_path: string
  vertical_path: string
  thumb_path: string
  srt_path: string
  copy: { douyin: PlatformCopy; bilibili: PlatformCopy }
  error: string | null
}

/**
 * 6 维度评分展开面板 (PRD/04 §4.4.1)
 * 列表卡片默认折叠；用户点"详情"才展开看 6 维细分 + 推荐理由 + 风险等级
 */
function ScoreBreakdownBars({
  breakdown,
  recommendationReason,
  riskLevel,
  type,
}: {
  breakdown?: ScoreBreakdown
  recommendationReason?: string
  riskLevel?: RiskLevel
  type?: string
}) {
  if (!breakdown) {
    return (
      <div className="mt-3 pt-3 border-t border-border">
        <p className="text-xs text-text-subtle">6 维度细分数据暂无（请重新分析以使用 V1 最新 Prompt）</p>
      </div>
    )
  }

  const dims = [
    { key: 'completeness', label: '知识完整性', score: breakdown.completeness, max: 25 },
    { key: 'independence', label: '独立可理解性', score: breakdown.independence, max: 20 },
    { key: 'learning_value', label: '学习价值', score: breakdown.learning_value, max: 20 },
    { key: 'clarity', label: '表达清晰度', score: breakdown.clarity, max: 15 },
    { key: 'duration_fit', label: '时长适配性', score: breakdown.duration_fit, max: 10 },
    { key: 'compliance', label: '安全合规', score: breakdown.compliance, max: 10 },
  ]
  const riskLabel = riskLevel === 'high' ? '高风险' : riskLevel === 'medium' ? '中风险' : '低风险'

  return (
    <div className="score-bars">
      {(type || riskLevel) && (
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          {type && <span className="chip chip-type">{type}</span>}
          {riskLevel && <span className="chip chip-risk" data-level={riskLevel}>{riskLabel}</span>}
        </div>
      )}
      {/* 6 维垂直 mini bar chart —— 替代原横长条，从 6 行压缩为 1 行 */}
      <div className="score-vbars">
        {dims.map((d) => {
          const ratio = Math.min(1, d.score / d.max)
          const isHigh = ratio >= 0.8
          return (
            <div key={d.key} className="score-vbar" title={`${d.label}: ${d.score}/${d.max}`}>
              <div className="score-vbar-track">
                <div
                  className="score-vbar-fill"
                  data-high={isHigh ? 'true' : 'false'}
                  style={{ height: `${ratio * 100}%` }}
                />
              </div>
              <span className="score-vbar-value font-tabular">
                {d.score}<span className="score-vbar-max">/{d.max}</span>
              </span>
              <span className="score-vbar-label">{d.label}</span>
            </div>
          )
        })}
      </div>
      {recommendationReason && (
        <p className="score-bars-reason">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="inline-block align-middle mr-1.5 -mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          {recommendationReason}
        </p>
      )}
    </div>
  )
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function hmsToSeconds(hms: string): number {
  const parts = hms.split(':').map(Number)
  return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0)
}

function overlaps(segStart: number, segEnd: number, aStart: number, aEnd: number): boolean {
  return segStart < aEnd && segEnd > aStart
}

/**
 * ScoreRing —— 大圆环评分仪表盘
 * SVG 实现，stroke-dasharray 控制弧长，颜色按 tier 切换
 * 用于 step 3 卡片左侧（替换之前的小 score-badge 数字 + 进度条）
 */
function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const tier = score >= 90 ? 'excellent' : score >= 80 ? 'good' : score >= 70 ? 'ok' : 'weak'
  const strokeWidth = Math.max(4, Math.round(size * 0.095))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100)

  return (
    <div className="score-ring" data-tier={tier} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="score-ring-svg" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="score-ring-track"
          fill="none"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="score-ring-fill"
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="score-ring-text">{score}</span>
    </div>
  )
}

/**
 * 把 HH:MM:SS 时间戳转成"19s" / "2m 30s" 风格的人类时长
 */
function durationBetween(start: string, end: string): string {
  const toSec = (t: string) => {
    const p = t.split(':').map(Number)
    return (p[0] || 0) * 3600 + (p[1] || 0) * 60 + (p[2] || 0)
  }
  const diff = Math.max(0, toSec(end) - toSec(start))
  if (diff < 60) return `${diff}s`
  const m = Math.floor(diff / 60)
  const s = diff % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // S1 修复 + 视觉升级：视频缩略图（base64 dataURL，本地首帧）+ 真实时长
  // 仅在 file 还存在时有意义，刷新页面后不持久化（视频文件本身已不在内存）
  const [videoThumb, setVideoThumb] = useState<string>('')
  const [videoDuration, setVideoDuration] = useState<number>(0)
  const [isDragging, setIsDragging] = useState(false)

  // App shell view 状态：home（首页）/ workflow（步骤 2-4）/ history（历史记录）
  // 重要：step 1（上传）已融合到首页，所以 workflow 必须真的有 step >= 2 的数据才进入
  // 避免出现 "view=workflow + currentStep=1" 的空白页面
  const [view, setView] = useState<'home' | 'workflow' | 'history'>(() => {
    if (typeof window === 'undefined') return 'home'
    try {
      const step = parseInt(localStorage.getItem('video-slicer:step') || '1')
      const segments = JSON.parse(localStorage.getItem('video-slicer:segments') || '[]')
      // 只有 step 真的 >= 2 且转录数据存在时才进工作流，否则一律回首页
      const hasWorkflowProgress = step >= 2 && segments.length > 0
      return hasWorkflowProgress ? 'workflow' : 'home'
    } catch {
      return 'home'
    }
  })

  // localStorage-initialized state
  const [currentStep, setCurrentStep] = useState<1|2|3|4>(() => {
    if (typeof window === 'undefined') return 1
    try { return (JSON.parse(localStorage.getItem('video-slicer:step') || '1') as 1|2|3|4) } catch { return 1 }
  })
  const [segments, setSegments] = useState<Segment[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('video-slicer:segments') || '[]') } catch { return [] }
  })
  const [videoId, setVideoId] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('video-slicer:videoId') || ''
  })
  const [videoFilename, setVideoFilename] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('video-slicer:videoFilename') || ''
  })
  const [wordCheckResult, setWordCheckResult] = useState<CheckedSegment[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('video-slicer:wordCheckResult') || '[]') } catch { return [] }
  })
  const [goldenResult, setGoldenResult] = useState<GoldenSentence[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('video-slicer:goldenResult') || '[]') } catch { return [] }
  })
  const [knowledgeResult, setKnowledgeResult] = useState<KnowledgeSegment[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('video-slicer:knowledgeResult') || '[]') } catch { return [] }
  })
  const [selectedGolden, setSelectedGolden] = useState<Set<number>>(() => {
    if (typeof window === 'undefined') return new Set()
    try { return new Set(JSON.parse(localStorage.getItem('video-slicer:selectedGolden') || '[]') as number[]) } catch { return new Set() }
  })
  const [selectedKnowledge, setSelectedKnowledge] = useState<Set<number>>(() => {
    if (typeof window === 'undefined') return new Set()
    try { return new Set(JSON.parse(localStorage.getItem('video-slicer:selectedKnowledge') || '[]') as number[]) } catch { return new Set() }
  })
  // 6 维度评分展开状态（仅 UI 临时状态，不持久化到 localStorage）
  // key 格式：'golden-${i}' / 'knowledge-${i}'
  const [expandedScores, setExpandedScores] = useState<Set<string>>(new Set())
  const [clipResults, setClipResults] = useState<ClipResult[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('video-slicer:clipResults') || '[]') } catch { return [] }
  })
  const [editingCopy, setEditingCopy] = useState<{[key: number]: {douyin: PlatformCopy, bilibili: PlatformCopy}}>(() => {
    if (typeof window === 'undefined') return {}
    try { return JSON.parse(localStorage.getItem('video-slicer:editingCopy') || '{}') } catch { return {} }
  })

  const [analyzing, setAnalyzing] = useState<AnalyzingState>({ words: false, golden: false, knowledge: false })
  const [analyzeError, setAnalyzeError] = useState('')
  const [activeTab, setActiveTab] = useState<'golden' | 'knowledge'>('golden')
  const [transcriptExpanded, setTranscriptExpanded] = useState(false)
  const [transcriptSearch, setTranscriptSearch] = useState('')
  const [processing, setProcessing] = useState(false)
  const [processError, setProcessError] = useState('')
  const [activeClipTab, setActiveClipTab] = useState<'douyin' | 'bilibili'>('douyin')
  const [regenerating, setRegenerating] = useState<Set<number>>(new Set())
  const [clipTranscripts, setClipTranscripts] = useState<{[key: number]: string}>({})

  // localStorage persistence
  useEffect(() => { localStorage.setItem('video-slicer:step', JSON.stringify(currentStep)) }, [currentStep])
  useEffect(() => { localStorage.setItem('video-slicer:segments', JSON.stringify(segments)) }, [segments])
  useEffect(() => { localStorage.setItem('video-slicer:videoId', videoId) }, [videoId])
  useEffect(() => { localStorage.setItem('video-slicer:videoFilename', videoFilename) }, [videoFilename])
  useEffect(() => { localStorage.setItem('video-slicer:wordCheckResult', JSON.stringify(wordCheckResult)) }, [wordCheckResult])
  useEffect(() => { localStorage.setItem('video-slicer:goldenResult', JSON.stringify(goldenResult)) }, [goldenResult])
  useEffect(() => { localStorage.setItem('video-slicer:knowledgeResult', JSON.stringify(knowledgeResult)) }, [knowledgeResult])
  useEffect(() => { localStorage.setItem('video-slicer:selectedGolden', JSON.stringify([...selectedGolden])) }, [selectedGolden])
  useEffect(() => { localStorage.setItem('video-slicer:selectedKnowledge', JSON.stringify([...selectedKnowledge])) }, [selectedKnowledge])
  useEffect(() => { localStorage.setItem('video-slicer:clipResults', JSON.stringify(clipResults)) }, [clipResults])
  useEffect(() => { localStorage.setItem('video-slicer:editingCopy', JSON.stringify(editingCopy)) }, [editingCopy])

  // 状态自愈：view=workflow 但 currentStep=1 是无效组合（step 1 已搬到首页）
  // 自动修正到合理状态，避免空白页
  useEffect(() => {
    if (view === 'workflow' && currentStep === 1) {
      if (segments.length > 0) {
        // 有转录数据 → 用户应该在 step 2
        setCurrentStep(2)
      } else {
        // 没数据 → 回首页让用户上传
        setView('home')
      }
    }
  }, [view, currentStep, segments.length])

  function isStepCompleted(step: number): boolean {
    if (step === 1) return segments.length > 0
    if (step === 2) return goldenResult.length > 0 || knowledgeResult.length > 0
    if (step === 3) return clipResults.length > 0
    return false
  }

  function handleReset() {
    if (!confirm('确定要清空所有进度吗？')) return
    Object.keys(localStorage).filter(k => k.startsWith('video-slicer:')).forEach(k => localStorage.removeItem(k))
    setCurrentStep(1)
    setSegments([])
    setVideoId('')
    setVideoFilename('')
    setWordCheckResult([])
    setGoldenResult([])
    setKnowledgeResult([])
    setSelectedGolden(new Set())
    setSelectedKnowledge(new Set())
    setClipResults([])
    setEditingCopy({})
    setClipTranscripts({})
    setError('')
    setStatus('')
    setProgress(0)
    setAnalyzeError('')
    setProcessError('')
    setFile(null)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    acceptFile(f)
  }

  /**
   * 通用文件接收 —— 点选 + 拖拽共用
   * 副作用：清空所有下游状态、生成首帧缩略图、读取真实时长
   */
  function acceptFile(f: File) {
    setFile(f)
    setVideoFilename(f.name)
    setSegments([])
    setError('')
    setStatus('')
    setProgress(0)
    setWordCheckResult([])
    setGoldenResult([])
    setKnowledgeResult([])
    setSelectedGolden(new Set())
    setSelectedKnowledge(new Set())
    setClipResults([])
    setEditingCopy({})
    setClipTranscripts({})
    setAnalyzeError('')
    setProcessError('')
    setCurrentStep(1)
    // 视觉升级：本地生成视频首帧缩略图 + 读取真实时长
    setVideoThumb('')
    setVideoDuration(0)
    generateThumb(f).catch(() => {
      // 缩略图失败不影响主流程（某些 codec / 浏览器兼容性问题）
    })
  }

  /**
   * 用 HTML5 Video API 生成视频首帧 + 时长
   * 完全在前端跑，不消耗后端资源；失败时静默降级到无缩略图
   */
  async function generateThumb(f: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(f)
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.muted = true
      video.src = url
      let seeked = false
      video.onloadedmetadata = () => {
        setVideoDuration(video.duration || 0)
        // 跳到 0.5 秒抓首帧（避免某些视频开头是黑屏）
        try {
          video.currentTime = Math.min(0.5, (video.duration || 1) / 2)
        } catch {
          // ignore
        }
      }
      video.onseeked = () => {
        if (seeked) return
        seeked = true
        try {
          const canvas = document.createElement('canvas')
          const maxW = 320
          const scale = Math.min(1, maxW / (video.videoWidth || maxW))
          canvas.width = (video.videoWidth || maxW) * scale
          canvas.height = (video.videoHeight || (maxW * 9 / 16)) * scale
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            setVideoThumb(canvas.toDataURL('image/jpeg', 0.72))
          }
        } catch {
          // ignore
        } finally {
          URL.revokeObjectURL(url)
          resolve()
        }
      }
      video.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('thumb generation failed'))
      }
    })
  }

  async function runAnalysis(segs: Segment[]) {
    setAnalyzeError('')
    setWordCheckResult([])
    setGoldenResult([])
    setKnowledgeResult([])
    setSelectedGolden(new Set())
    setSelectedKnowledge(new Set())
    setAnalyzing({ words: true, golden: true, knowledge: true })

    const body = JSON.stringify({ segments: segs })
    const headers = { 'Content-Type': 'application/json' }

    // 违禁词检测并行发出，不影响 AI 分析串行流程
    fetch('http://127.0.0.1:8010/api/check-words', { method: 'POST', headers, body })
      .then(r => r.json())
      .then(d => setWordCheckResult(d.results || []))
      .catch(() => setAnalyzeError(prev => prev + '违禁词检测失败。'))
      .finally(() => setAnalyzing(prev => ({ ...prev, words: false })))

    // 金句识别
    try {
      const r = await fetch('http://127.0.0.1:8010/api/analyze-golden', { method: 'POST', headers, body })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || '请求失败')
      const sorted: GoldenSentence[] = (d.golden_sentences || []).sort(
        (a: GoldenSentence, b: GoldenSentence) => b.score - a.score
      )
      setGoldenResult(sorted)
      setSelectedGolden(new Set(sorted.map((_, i) => i)))
    } catch {
      setAnalyzeError(prev => prev + '金句识别失败。')
    } finally {
      setAnalyzing(prev => ({ ...prev, golden: false }))
    }

    // 等待 3 秒再调用知识点识别，避免限流
    await new Promise(resolve => setTimeout(resolve, 3000))

    // 知识点识别
    try {
      const r = await fetch('http://127.0.0.1:8010/api/analyze-knowledge', { method: 'POST', headers, body })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || '请求失败')
      const sorted: KnowledgeSegment[] = (d.knowledge_segments || []).sort(
        (a: KnowledgeSegment, b: KnowledgeSegment) => b.score - a.score
      )
      setKnowledgeResult(sorted)
      setSelectedKnowledge(new Set(sorted.map((_, i) => i)))
    } catch {
      setAnalyzeError(prev => prev + '知识点识别失败。')
    } finally {
      setAnalyzing(prev => ({ ...prev, knowledge: false }))
    }
  }

  function getTranscriptInRange(startHms: string, endHms: string): string {
    const s = hmsToSeconds(startHms)
    const e = hmsToSeconds(endHms)
    return segments
      .filter(seg => overlaps(seg.start, seg.end, s, e))
      .map(seg => seg.text.trim())
      .join(' ')
  }

  async function handleProcessClips() {
    const selectedGoldenData = goldenResult.filter((_, i) => selectedGolden.has(i))
    const selectedKnowledgeData = knowledgeResult.filter((_, i) => selectedKnowledge.has(i))

    const clips: ClipItem[] = [
      ...selectedGoldenData.map(g => ({
        start_time: g.start_time,
        end_time: g.end_time,
        // S1 修复：优先用 LLM 重写的简体钩子标题；旧数据/LLM 漏返兜底用 text 截断
        title: g.title || g.text.slice(0, 30),
        clip_type: 'golden' as const,
        text: getTranscriptInRange(g.start_time, g.end_time),
      })),
      ...selectedKnowledgeData.map(k => ({
        start_time: k.start_time,
        end_time: k.end_time,
        title: k.title,
        clip_type: 'knowledge' as const,
        text: getTranscriptInRange(k.start_time, k.end_time),
      })),
    ]

    if (clips.length === 0) {
      alert('请先勾选至少一条金句或知识点段落')
      return
    }

    setProcessing(true)
    setProcessError('')
    setClipResults([])

    try {
      const r = await fetch('http://127.0.0.1:8010/api/process-clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: videoId, clips }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || '处理失败')
      const results: ClipResult[] = d.clips || []
      setClipResults(results)
      const initial: {[key: number]: {douyin: PlatformCopy, bilibili: PlatformCopy}} = {}
      const transcripts: {[key: number]: string} = {}
      for (let i = 0; i < results.length; i++) {
        initial[results[i].index] = results[i].copy
        transcripts[results[i].index] = clips[i]?.text || ''
      }
      setEditingCopy(initial)
      setClipTranscripts(transcripts)
      setCurrentStep(4)
    } catch (e: unknown) {
      setProcessError(e instanceof Error ? e.message : '切片处理失败')
    } finally {
      setProcessing(false)
    }
  }

  async function handleRegenerateCopy(clip: ClipResult) {
    setRegenerating(prev => new Set(prev).add(clip.index))
    try {
      const r = await fetch('http://127.0.0.1:8010/api/regenerate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: clip.title, clip_type: clip.clip_type, transcript: clipTranscripts[clip.index] || '' }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || '重新生成失败')
      setEditingCopy(prev => ({ ...prev, [clip.index]: d }))
    } catch {
      // silently fail, keep existing copy
    } finally {
      setRegenerating(prev => { const next = new Set(prev); next.delete(clip.index); return next })
    }
  }

  async function handleDownload() {
    // 先保存编辑后的文案到后端
    const clipsToSave = clipResults.map(c => ({
      index: c.index,
      douyin: editingCopy[c.index]?.douyin || c.copy.douyin,
      bilibili: editingCopy[c.index]?.bilibili || c.copy.bilibili,
    }))
    await fetch('http://127.0.0.1:8010/api/save-copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_id: videoId, clips: clipsToSave }),
    }).catch(() => {})
    window.open(`http://127.0.0.1:8010/api/download-package?video_id=${videoId}`)
  }

  function handleUpload() {
    if (!file) return
    setUploading(true)
    setError('')
    setSegments([])
    setProgress(0)
    setStatus('正在上传视频...')

    const formData = new FormData()
    formData.append('file', file)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', 'http://127.0.0.1:8010/transcribe')

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 40))
      }
    }

    let progressTimer: ReturnType<typeof setInterval> | null = null

    xhr.upload.onloadend = () => {
      setProgress(40)
      setStatus('正在提取音频...')
      let p = 40
      progressTimer = setInterval(() => {
        p += 2
        if (p >= 90) {
          if (progressTimer) clearInterval(progressTimer)
          setStatus('正在转写语音，请耐心等待...')
          setProgress(90)
        } else {
          setProgress(p)
          if (p > 60) setStatus('正在转写语音，请耐心等待...')
        }
      }, 1500)
    }

    xhr.onload = () => {
      if (progressTimer) clearInterval(progressTimer)
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText)
        setSegments(data.segments)
        setVideoId(data.video_id || '')
        setProgress(100)
        setStatus('转写完成')
        setCurrentStep(2)
        setView('workflow')  // 上传成功后从首页切到工作流，看 step 2 AI 分析
        runAnalysis(data.segments)
      } else {
        try {
          const data = JSON.parse(xhr.responseText)
          setError(data.detail || '转写失败，请重试')
        } catch {
          setError('转写失败，请重试')
        }
        setStatus('')
      }
      setUploading(false)
    }

    xhr.onerror = () => {
      if (progressTimer) clearInterval(progressTimer)
      setError('网络错误，请确认后端服务已启动（http://127.0.0.1:8010）')
      setStatus('')
      setUploading(false)
    }

    xhr.send(formData)
  }

  const isAnalyzing = analyzing.words || analyzing.golden || analyzing.knowledge
  const showResults = goldenResult.length > 0 || knowledgeResult.length > 0 || isAnalyzing

  const STEPS = [
    { id: 1 as const, label: '上传视频' },
    { id: 2 as const, label: 'AI 分析' },
    { id: 3 as const, label: '选择切片' },
    { id: 4 as const, label: '切片结果' },
  ]

  // 计算面包屑 —— 根据当前 view 显示不同上下文
  const breadcrumb =
    view === 'home' ? '首页' :
    view === 'history' ? '历史记录' :
    `智能切片 · ${STEPS.find(s => s.id === currentStep)?.label ?? ''}`

  // 侧栏激活项：home/workflow 都映射到"首页"（工作流隶属于创作流程）；history 单独高亮
  const activeNav: 'home' | 'history' = view === 'history' ? 'history' : 'home'

  return (
    <AppShell
      activeNav={activeNav}
      onNavChange={(nav) => {
        if (nav === 'home') setView('home')
        else if (nav === 'history') setView('history')
      }}
      breadcrumb={breadcrumb}
      showBackToHome={view === 'workflow'}
      onBackToHome={() => setView('home')}
    >
      {view === 'home' && (
        <HomeView
          uploadSection={renderUploadSection()}
          onPickFile={() => inputRef.current?.click()}
        />
      )}
      {view === 'history' && <HistoryView onStartWorkflow={() => setView('workflow')} />}
      {view === 'workflow' && <WorkflowContent />}
    </AppShell>
  )

  /**
   * 渲染上传区——融合到首页 hero 位置
   * 从原 step 1 工作流里抽出，让首页同时承担"启动入口"+"上传交互"
   * 上传成功后，handleUpload 内部会设置 currentStep=2 + 触发 setView('workflow')
   */
  function renderUploadSection() {
    return (
      <div className="page-enter">
        {/* Hero 文案 */}
        <div className="pt-2 pb-8 text-center">
          <h1
            className="font-semibold tracking-tight mb-3"
            style={{
              fontSize: 'clamp(1.875rem, 4vw, 2.5rem)',
              lineHeight: 1.15,
              color: 'var(--color-text)',
            }}
          >
            上传你的直播录像
          </h1>
          <p
            className="text-base leading-relaxed mx-auto"
            style={{
              color: 'var(--color-text-muted)',
              maxWidth: '38rem',
            }}
          >
            1-4 小时的知识类直播录像，AI 自动拆成可发抖音的金句切片和可发 B 站的知识点段落。
          </p>
        </div>

        {/* 隐藏的文件 input */}
        <input
          ref={inputRef}
          type="file"
          accept=".mp4,.mov,video/mp4,video/quicktime"
          className="hidden"
          onChange={handleFileChange}
        />

        {!file && !videoFilename ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragging(false)
              const f = e.dataTransfer.files?.[0]
              if (f && /\.(mp4|mov)$/i.test(f.name)) acceptFile(f)
            }}
            className="dropzone-empty"
            data-dragging={isDragging}
          >
            <div
              className="dropzone-icon"
              style={{
                background: isDragging ? 'var(--color-accent)' : 'var(--color-surface)',
                color: isDragging ? 'var(--color-accent-foreground)' : 'var(--color-text-muted)',
              }}
              aria-hidden="true"
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="text-xl font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>
              {isDragging ? '松手即可上传' : '拖入视频，或点击选择文件'}
            </p>
            <p className="text-sm mt-2.5" style={{ color: 'var(--color-text-subtle)' }}>
              MP4 / MOV · 建议时长 1-4 小时 · 最大 2 GB
            </p>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={() => !uploading && inputRef.current?.click()}
            onKeyDown={(e) => { if (!uploading && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.click() }}
            className="dropzone-filled"
            aria-label="点击更换视频"
          >
            {videoThumb ? (
              <div className="dropzone-filled-thumb">
                <img src={videoThumb} alt="视频首帧预览" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="dropzone-filled-icon" aria-hidden="true">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
            )}
          </div>
        )}

        {(file || videoFilename) && (
          <p
            className="text-sm mt-4 text-center font-tabular flex flex-wrap items-center justify-center gap-x-2 gap-y-1"
            style={{ color: 'var(--color-text-subtle)' }}
          >
            {file && !isLikelyInternalId(file.name) && (
              <span className="font-medium" style={{ color: 'var(--color-text-muted)' }}>{file.name}</span>
            )}
            {file && !isLikelyInternalId(file.name) && (file.size > 0 || videoDuration > 0) && (
              <span aria-hidden>·</span>
            )}
            {file && file.size > 0 && <span>{formatFileSize(file.size)}</span>}
            {videoDuration > 0 && (
              <>
                {file && file.size > 0 && <span aria-hidden>·</span>}
                <span>时长 {formatDuration(videoDuration)}</span>
              </>
            )}
            {!file && videoFilename && <span>上次会话保留的视频，点击卡片重新选择</span>}
          </p>
        )}

        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-subtle)' }}>
            视频仅在本地处理 · 不会上传到云端 · 预计 5–15 分钟完成转录
          </p>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="btn btn-primary btn-lg shrink-0"
            style={{ minWidth: '180px' }}
          >
            {uploading ? (
              <>
                <span className="spinner" aria-hidden="true" />
                <span>处理中…</span>
              </>
            ) : (
              <>
                <span>开始转写</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </>
            )}
          </button>
        </div>

        {(uploading || status === '转写完成') && (
          <div className="mt-8 p-5 rounded-xl border" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}>
            <div className="flex justify-between items-center text-sm mb-3">
              <span style={{ color: 'var(--color-text)' }} className="font-medium">{status}</span>
              <span className="font-tabular" style={{ color: 'var(--color-text-muted)' }}>{progress}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  background: 'var(--color-accent)',
                }}
              />
            </div>
          </div>
        )}

        {error && (
          <div
            className="mt-5 p-4 rounded-lg text-sm border flex items-start gap-2.5"
            style={{
              background: 'var(--color-danger-bg)',
              borderColor: 'var(--color-danger)',
              color: 'var(--color-danger)',
            }}
            role="alert"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}
      </div>
    )
  }

  // ---- 工作流内容（原有 4 步），保持原逻辑不动 ----
  function WorkflowContent() {
    return (
      <div className="max-w-[1100px] w-full mx-auto">
        {/* 工作流顶部：精简步骤指示器 */}
        <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
          <nav aria-label="处理流程" className="flex items-center gap-1.5">
            {STEPS.map((step, idx) => {
              const completed = isStepCompleted(step.id)
              const active = currentStep === step.id
              const clickable = completed && !active
              const status = completed ? 'done' : active ? 'current' : 'pending'
              return (
                <div key={step.id} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      // step 1 现在在首页，点击返回首页而非切步骤
                      if (step.id === 1) { setView('home'); return }
                      if (clickable) setCurrentStep(step.id)
                    }}
                    disabled={step.id !== 1 && !clickable && !active}
                    aria-current={active ? 'step' : undefined}
                    className="header-step"
                    data-status={status}
                    data-clickable={step.id === 1 || clickable}
                  >
                    <span className="header-step-dot" aria-hidden="true">
                      {completed ? (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        step.id
                      )}
                    </span>
                    <span className="header-step-label">{step.label}</span>
                  </button>
                  {idx < STEPS.length - 1 && (
                    <span className="header-step-line" data-passed={completed} aria-hidden="true" />
                  )}
                </div>
              )
            })}
          </nav>
          <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-subtle)' }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-success)' }} aria-hidden="true" />
            已自动保存
          </span>
        </div>

        <div className="w-full">

        {/* step 1 已搬到首页（renderUploadSection），workflow 视图从 step 2 开始 */}

        {/* 步骤2：AI分析 —— 单卡居中加载（参考录咖加载条结构，沿用本站 lime light 主题） */}
        <div className={currentStep === 2 ? 'page-enter' : 'hidden'}>
          {/* Hero 文案 */}
          <div className="pt-2 pb-8 text-center">
            <h1
              className="font-semibold tracking-tight mb-3"
              style={{
                fontSize: 'clamp(1.875rem, 4vw, 2.5rem)',
                lineHeight: 1.15,
                color: 'var(--color-text)',
              }}
            >
              AI 正在分析你的视频
            </h1>
            <p
              className="text-base leading-relaxed mx-auto"
              style={{
                color: 'var(--color-text-muted)',
                maxWidth: '38rem',
              }}
            >
              转写、金句识别和知识点识别正在并行处理，无需关闭页面。
            </p>
          </div>

          {/* 单卡加载区 —— 替代之前 3 个并排框 */}
          {(() => {
            const totalTasks = 3
            const runningTasks = [analyzing.words, analyzing.golden, analyzing.knowledge].filter(Boolean).length
            const doneTasks = totalTasks - runningTasks
            const progressPct = Math.round((doneTasks / totalTasks) * 100)
            const isLoading = runningTasks > 0

            const realFilename = file?.name || videoFilename
            const showFilename = realFilename && !isLikelyInternalId(realFilename)

            const statusText = isLoading ? '正在分析视频...' : '分析完成'

            return (
              <div className="analyze-card" data-loading={isLoading}>
                <div className={`analyze-stack ${isLoading ? 'is-loading' : ''}`} aria-hidden="true">
                  <span className="analyze-stack-back" />
                  <span className="analyze-stack-front">
                    {isLoading ? (
                      <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    ) : (
                      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                </div>

                {showFilename ? (
                  <p className="analyze-filename font-tabular">{realFilename}</p>
                ) : (
                  <p className="analyze-filename" style={{ color: 'var(--color-text-muted)' }}>已上传的视频</p>
                )}

                <div className="analyze-status-block">
                  <p className="analyze-status">{statusText}</p>
                  <p className="analyze-detail">
                    转写 <span className="font-tabular font-semibold" style={{ color: 'var(--color-text)' }}>{segments.length}</span> 段
                    <span className="analyze-detail-sep" aria-hidden>·</span>
                    金句 <span className="font-tabular font-semibold" style={{ color: 'var(--color-text)' }}>{goldenResult.length}</span> 条
                    <span className="analyze-detail-sep" aria-hidden>·</span>
                    知识点 <span className="font-tabular font-semibold" style={{ color: 'var(--color-text)' }}>{knowledgeResult.length}</span> 个
                  </p>
                </div>

                <div className="analyze-progress">
                  <div className={`analyze-progress-track ${isLoading ? 'is-loading' : ''}`}>
                    <div className="analyze-progress-fill" style={{ width: `${progressPct}%` }} />
                  </div>
                  <span className="analyze-progress-pct">{progressPct}%</span>
                </div>
              </div>
            )
          })()}

          {analyzeError && (
            <div
              className="mt-5 p-4 rounded-lg text-sm border"
              style={{
                background: 'var(--color-warning-bg)',
                borderColor: 'var(--color-warning)',
                color: 'var(--color-warning)',
              }}
              role="alert"
            >
              {analyzeError}
            </div>
          )}

          {/* 可折叠转写详情 */}
          {segments.length > 0 && (
            <div className="mb-6 border border-border rounded-lg overflow-hidden bg-bg-elevated">
              <button
                onClick={() => setTranscriptExpanded(prev => !prev)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-text bg-surface hover:bg-surface-hover transition-colors"
              >
                <span className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  <span>查看转写详情</span>
                  <span className="text-text-muted font-tabular">({segments.length})</span>
                </span>
                <span className="text-text-subtle text-xs">
                  {transcriptExpanded ? '收起 ▲' : '展开 ▼'}
                </span>
              </button>
              {transcriptExpanded && (
                <div className="p-4 border-t border-border">
                  <input
                    type="text"
                    placeholder="搜索转写内容..."
                    value={transcriptSearch}
                    onChange={e => setTranscriptSearch(e.target.value)}
                    className="input mb-3 text-sm"
                  />
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {segments
                      .filter(seg => !transcriptSearch || seg.text.toLowerCase().includes(transcriptSearch.toLowerCase()))
                      .map((seg, i) => {
                        const checked = wordCheckResult.find(r => r.start === seg.start && r.end === seg.end)
                        const hits = checked?.hits || []
                        const hasA = hits.some(h => h.risk_level === 'A')
                        const hasB = hits.some(h => h.risk_level === 'B')
                        const hasC = hits.some(h => h.risk_level === 'C')
                        const hasFiller = hits.some(h => h.risk_level === 'filler')
                        const inGoldenRange = goldenResult.some(g =>
                          overlaps(seg.start, seg.end, hmsToSeconds(g.start_time), hmsToSeconds(g.end_time))
                        )
                        const inKnowledgeRange = knowledgeResult.some(k =>
                          overlaps(seg.start, seg.end, hmsToSeconds(k.start_time), hmsToSeconds(k.end_time))
                        )
                        const isGoldenStart = goldenResult.some(g => {
                          const gStart = hmsToSeconds(g.start_time)
                          return seg.start <= gStart && seg.end > gStart
                        })
                        const isKnowledgeStart = knowledgeResult.some(k => {
                          const kStart = hmsToSeconds(k.start_time)
                          return seg.start <= kStart && seg.end > kStart
                        })

                        // 边框：违禁词等级标识左侧色条
                        let leftBorderColor: string | undefined
                        if (hasA) leftBorderColor = 'var(--color-danger)'
                        else if (hasB) leftBorderColor = 'var(--color-warning)'
                        else if (hasC) leftBorderColor = 'var(--color-accent)'

                        // 背景：金句 / 知识点高亮（lime 系 + accent-tint）
                        let bgColor = 'var(--color-bg-elevated)'
                        if (inGoldenRange && inKnowledgeRange) bgColor = 'var(--color-accent-tint)'
                        else if (inGoldenRange) bgColor = 'var(--color-accent-tint)'
                        else if (inKnowledgeRange) bgColor = 'var(--color-surface)'

                        return (
                          <div
                            key={i}
                            className="flex flex-col gap-1 p-3 rounded-md border"
                            style={{
                              background: bgColor,
                              borderColor: 'var(--color-border)',
                              borderLeftColor: leftBorderColor,
                              borderLeftWidth: leftBorderColor ? '3px' : '1px',
                            }}
                          >
                            <div className="flex gap-3 items-start">
                              <span className="text-xs font-mono text-text-muted whitespace-nowrap pt-0.5 timestamp">
                                [{formatTime(seg.start)} - {formatTime(seg.end)}]
                              </span>
                              <span className={`text-sm leading-relaxed ${hasFiller && !hasA && !hasB && !hasC ? 'text-text-subtle' : 'text-text'}`}>
                                {seg.text.trim()}
                              </span>
                            </div>
                            {(hasA || hasB || hasC || hasFiller || isGoldenStart || isKnowledgeStart) && (
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {hasA && (
                                  <span className="chip chip-risk" data-level="high">⚠️ A 类违禁</span>
                                )}
                                {hasB && (
                                  <span className="chip chip-risk" data-level="medium">⚡ B 类注意</span>
                                )}
                                {hasC && (
                                  <span className="chip chip-risk" data-level="low">💡 C 类提示</span>
                                )}
                                {hasFiller && (
                                  <span className="chip chip-type">口水词</span>
                                )}
                                {isGoldenStart && (
                                  <span
                                    className="chip"
                                    style={{
                                      background: 'var(--color-accent)',
                                      color: 'var(--color-accent-foreground)',
                                    }}
                                  >
                                    ⭐ 金句
                                  </span>
                                )}
                                {isKnowledgeStart && (
                                  <span
                                    className="chip"
                                    style={{
                                      background: 'var(--color-accent-soft)',
                                      color: 'var(--color-accent-text)',
                                    }}
                                  >
                                    📚 知识点
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 步骤2底部：下一步按钮 */}
          <div className="mt-8 flex justify-end">
            <button
              onClick={() => setCurrentStep(3)}
              disabled={isAnalyzing || segments.length === 0}
              className="btn btn-primary"
            >
              {isAnalyzing ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  <span>分析中，请稍候...</span>
                </>
              ) : (
                <>
                  <span>下一步：选择金句和知识点</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 步骤3：选择金句和知识点 —— 路线 B 精致卡片网格 */}
        <div className={currentStep === 3 ? 'page-enter' : 'hidden'}>
          {/* Hero 文案 */}
          <div className="pt-2 pb-8 text-center">
            <h1
              className="font-semibold tracking-tight mb-3"
              style={{
                fontSize: 'clamp(1.875rem, 4vw, 2.5rem)',
                lineHeight: 1.15,
                color: 'var(--color-text)',
              }}
            >
              选择要切片的内容
            </h1>
            <p
              className="text-base leading-relaxed mx-auto"
              style={{
                color: 'var(--color-text-muted)',
                maxWidth: '38rem',
              }}
            >
              AI 已按 6 维度评分排序。勾选金句或知识点段落，确认后自动生成视频和文案。
            </p>
          </div>

          {showResults && (
            <div>
              {/* Tabs —— 已清 emoji */}
              <div className="flex items-center border-b border-border mb-6 gap-1 flex-wrap">
                <button
                  onClick={() => setActiveTab('golden')}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors -mb-px ${
                    activeTab === 'golden'
                      ? 'text-text border-b-2'
                      : 'text-text-muted hover:text-text border-b-2 border-transparent'
                  }`}
                  style={activeTab === 'golden' ? { borderBottomColor: 'var(--color-accent)' } : undefined}
                >
                  <span className="inline-flex items-center gap-1.5">
                    金句列表
                    {goldenResult.length > 0 && (
                      <span className="text-text-subtle font-tabular">({goldenResult.length})</span>
                    )}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('knowledge')}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors -mb-px ${
                    activeTab === 'knowledge'
                      ? 'text-text border-b-2'
                      : 'text-text-muted hover:text-text border-b-2 border-transparent'
                  }`}
                  style={activeTab === 'knowledge' ? { borderBottomColor: 'var(--color-accent)' } : undefined}
                >
                  <span className="inline-flex items-center gap-1.5">
                    知识点段落
                    {knowledgeResult.length > 0 && (
                      <span className="text-text-subtle font-tabular">({knowledgeResult.length})</span>
                    )}
                  </span>
                </button>
                {activeTab === 'golden' && (
                  <span
                    className="ml-2 chip inline-flex items-center gap-1.5"
                    style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}
                    title="金句时长15-60秒，适合抖音/小红书等短视频平台；B站短视频区权重较低，建议B站只发布知识点段落"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    短金句适合抖音；B 站建议发布知识点段落
                  </span>
                )}
              </div>

              {/* 金句卡片网格 */}
              {activeTab === 'golden' && (
                <div className="space-y-4">
                  {analyzing.golden && (
                    <p className="text-sm text-text-muted py-6 text-center">
                      <span className="spinner inline-block align-middle mr-2" aria-hidden /> 正在识别金句...
                    </p>
                  )}
                  {!analyzing.golden && goldenResult.length === 0 && (
                    <p className="text-sm text-text-subtle py-6 text-center">未识别到金句</p>
                  )}
                  {goldenResult.map((g, i) => {
                    const expandKey = `golden-${i}`
                    const isExpanded = expandedScores.has(expandKey)
                    const isSelected = selectedGolden.has(i)
                    const titleText = g.title || g.text.slice(0, 30)
                    const duration = durationBetween(g.start_time, g.end_time)

                    return (
                      <div
                        key={i}
                        onClick={() => setSelectedGolden(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next })}
                        className="clip-card"
                        data-selected={isSelected}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="clip-card-checkbox">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            style={{ accentColor: 'var(--color-accent)' }}
                          />
                        </div>

                        <div className="clip-card-score">
                          <ScoreRing score={g.score} size={68} />
                        </div>

                        <div className="clip-card-main">
                          <p className="clip-card-title">{titleText}</p>

                          <div className="clip-card-meta">
                            <span className="clip-card-meta-item font-tabular">{g.start_time} – {g.end_time}</span>
                            <span className="clip-card-meta-sep" aria-hidden>·</span>
                            <span className="clip-card-meta-item font-tabular">{duration}</span>
                            {g.type && (
                              <>
                                <span className="clip-card-meta-sep" aria-hidden>·</span>
                                <span className="clip-card-meta-item">{g.type}</span>
                              </>
                            )}
                          </div>

                          <p className="clip-card-transcript">{g.text}</p>

                          {g.reason && (
                            <p className="clip-card-reason">{g.reason}</p>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpandedScores(prev => { const next = new Set(prev); next.has(expandKey) ? next.delete(expandKey) : next.add(expandKey); return next })
                            }}
                            className="clip-card-toggle"
                          >
                            {isExpanded ? '收起 6 维度详情 ▲' : '展开 6 维度详情 ▼'}
                          </button>
                          {isExpanded && (
                            <ScoreBreakdownBars
                              breakdown={g.score_breakdown}
                              riskLevel={g.risk_level}
                              type={g.type}
                            />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* 知识点卡片网格 */}
              {activeTab === 'knowledge' && (
                <div className="space-y-4">
                  {analyzing.knowledge && (
                    <p className="text-sm text-text-muted py-6 text-center">
                      <span className="spinner inline-block align-middle mr-2" aria-hidden /> 正在识别知识点...
                    </p>
                  )}
                  {!analyzing.knowledge && knowledgeResult.length === 0 && (
                    <p className="text-sm text-text-subtle py-6 text-center">未识别到知识点段落</p>
                  )}
                  {knowledgeResult.map((k, i) => {
                    const expandKey = `knowledge-${i}`
                    const isExpanded = expandedScores.has(expandKey)
                    const isSelected = selectedKnowledge.has(i)
                    const duration = durationBetween(k.start_time, k.end_time)

                    return (
                      <div
                        key={i}
                        onClick={() => setSelectedKnowledge(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next })}
                        className="clip-card"
                        data-selected={isSelected}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="clip-card-checkbox">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            style={{ accentColor: 'var(--color-accent)' }}
                          />
                        </div>

                        <div className="clip-card-score">
                          <ScoreRing score={k.score} size={68} />
                        </div>

                        <div className="clip-card-main">
                          <p className="clip-card-title">{k.title}</p>

                          <div className="clip-card-meta">
                            <span className="clip-card-meta-item font-tabular">{k.start_time} – {k.end_time}</span>
                            <span className="clip-card-meta-sep" aria-hidden>·</span>
                            <span className="clip-card-meta-item font-tabular">{duration}</span>
                            {k.type && (
                              <>
                                <span className="clip-card-meta-sep" aria-hidden>·</span>
                                <span className="clip-card-meta-item">{k.type}</span>
                              </>
                            )}
                          </div>

                          <p className="clip-card-transcript">{k.summary}</p>

                          {k.recommendation_reason && (
                            <p className="clip-card-reason">{k.recommendation_reason}</p>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpandedScores(prev => { const next = new Set(prev); next.has(expandKey) ? next.delete(expandKey) : next.add(expandKey); return next })
                            }}
                            className="clip-card-toggle"
                          >
                            {isExpanded ? '收起 6 维度详情 ▲' : '展开 6 维度详情 ▼'}
                          </button>
                          {isExpanded && (
                            <ScoreBreakdownBars
                              breakdown={k.score_breakdown}
                              recommendationReason={k.recommendation_reason}
                              riskLevel={k.risk_level}
                              type={k.type}
                            />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* 步骤3底部操作区 */}
          <div className="mt-6 p-4 bg-bg-elevated border border-border rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-sm text-text-muted">
              已选{' '}
              <span className="font-semibold text-accent-text font-tabular">{selectedGolden.size}</span>
              <span className="mx-0.5"> 条金句，</span>
              <span className="font-semibold text-accent-text font-tabular">{selectedKnowledge.size}</span>
              <span className="mx-0.5"> 个知识点段落</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => runAnalysis(segments)}
                className="btn btn-secondary btn-sm"
              >
                重新分析
              </button>
              <button
                onClick={handleProcessClips}
                disabled={processing}
                className="btn btn-primary btn-sm"
              >
                {processing ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    <span>处理中...</span>
                  </>
                ) : (
                  '确认选择并切片'
                )}
              </button>
            </div>
          </div>

          {processing && (
            <div
              className="mt-4 p-4 rounded-lg text-sm flex items-center gap-3 border"
              style={{
                background: 'var(--color-accent-tint)',
                borderColor: 'var(--color-accent)',
                color: 'var(--color-accent-text)',
              }}
              role="status"
              aria-live="polite"
            >
              <span className="spinner" aria-hidden="true" />
              <span>正在切片并生成文案，请耐心等待（每个片段约需 10-30 秒）...</span>
            </div>
          )}
          {processError && (
            <div
              className="mt-4 p-4 rounded-lg text-sm border"
              style={{
                background: 'var(--color-danger-bg)',
                borderColor: 'var(--color-danger)',
                color: 'var(--color-danger)',
              }}
              role="alert"
            >
              切片失败：{processError}
            </div>
          )}
        </div>

        {/* 步骤4：切片结果 —— 大改版：hero + 大缩略图 hover overlay + 复制按钮 + sticky 下载栏 */}
        <div className={currentStep === 4 ? 'page-enter' : 'hidden'}>
          {/* Hero 文案 */}
          <div className="pt-2 pb-8 text-center">
            <h1
              className="font-semibold tracking-tight mb-3"
              style={{
                fontSize: 'clamp(1.875rem, 4vw, 2.5rem)',
                lineHeight: 1.15,
                color: 'var(--color-text)',
              }}
            >
              切片结果
            </h1>
            <p
              className="text-base leading-relaxed mx-auto"
              style={{
                color: 'var(--color-text-muted)',
                maxWidth: '38rem',
              }}
            >
              共 <span className="font-tabular font-semibold" style={{ color: 'var(--color-text)' }}>{clipResults.length}</span> 个切片，编辑文案后打包下载。
            </p>
          </div>

          {clipResults.length > 0 && (
            <div>
              {/* 平台 tab —— 无 emoji，lime 底边激活 */}
              <div className="flex border-b border-border mb-6">
                <button
                  onClick={() => setActiveClipTab('douyin')}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors -mb-px border-b-2 ${
                    activeClipTab === 'douyin' ? 'text-text' : 'text-text-muted hover:text-text border-transparent'
                  }`}
                  style={activeClipTab === 'douyin' ? { borderBottomColor: 'var(--color-accent)' } : undefined}
                >
                  抖音文案
                </button>
                <button
                  onClick={() => setActiveClipTab('bilibili')}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors -mb-px border-b-2 ${
                    activeClipTab === 'bilibili' ? 'text-text' : 'text-text-muted hover:text-text border-transparent'
                  }`}
                  style={activeClipTab === 'bilibili' ? { borderBottomColor: 'var(--color-accent)' } : undefined}
                >
                  B 站文案
                </button>
              </div>

              {activeClipTab === 'douyin' && (
                <div
                  className="mb-5 px-4 py-3 rounded-lg text-sm border flex items-start gap-2.5"
                  style={{
                    background: 'var(--color-info-bg)',
                    borderColor: 'rgba(3, 105, 161, 0.15)',
                    color: 'var(--color-info)',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span>视频保留原始横屏比例；发抖音前请用剪映 / Pr 改成竖屏</span>
                </div>
              )}

              <div className="space-y-4 pb-24">
                {(() => {
                  const visibleClips = activeClipTab === 'bilibili'
                    ? clipResults.filter(c => c.clip_type === 'knowledge')
                    : clipResults
                  if (activeClipTab === 'bilibili' && visibleClips.length === 0) {
                    return (
                      <div
                        className="p-5 rounded-xl text-sm border flex items-start gap-3"
                        style={{
                          background: 'var(--color-info-bg)',
                          borderColor: 'rgba(3, 105, 161, 0.15)',
                          color: 'var(--color-info)',
                        }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                        <span>您只勾选了金句切片，金句不适合 B 站发布。如需 B 站版本，请返回上一步勾选知识点段落。</span>
                      </div>
                    )
                  }
                  return visibleClips.map((clip) => {
                    const copy = editingCopy[clip.index] || clip.copy
                    const platformCopy = activeClipTab === 'douyin' ? copy.douyin : copy.bilibili
                    const thumbUrl = `http://127.0.0.1:8010/api/get-clip-video?video_id=${videoId}&clip_index=${clip.index}&type=thumb`
                    const videoUrl = `http://127.0.0.1:8010/api/get-clip-video?video_id=${videoId}&clip_index=${clip.index}&type=original`
                    const captionLen = (platformCopy?.caption || '').length
                    const captionLimit = activeClipTab === 'douyin' ? 300 : 1500

                    return (
                      <div key={clip.index} className="clip-result-card">
                        {/* 左侧：大缩略图 + hover 播放遮罩 */}
                        <a
                          href={videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="clip-result-thumb"
                          aria-label="点击预览视频"
                        >
                          <img
                            src={thumbUrl}
                            alt=""
                            onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0' }}
                          />
                          <span className="clip-result-thumb-overlay" aria-hidden="true">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </span>
                        </a>

                        {/* 右侧：内容 */}
                        <div className="clip-result-main">
                          {/* 类型 chip + 钩子标题 */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {clip.clip_type === 'golden' ? (
                              <span
                                className="chip"
                                style={{
                                  background: 'var(--color-accent)',
                                  color: 'var(--color-accent-foreground)',
                                }}
                              >
                                金句
                              </span>
                            ) : (
                              <span
                                className="chip"
                                style={{
                                  background: 'var(--color-accent-soft)',
                                  color: 'var(--color-accent-text)',
                                }}
                              >
                                知识点
                              </span>
                            )}
                            <h3 className="clip-result-title">{clip.title}</h3>
                          </div>

                          {clip.error && (
                            <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>
                              处理出错：{clip.error}
                            </p>
                          )}

                          {/* 标题输入行 */}
                          <div className="clip-result-field">
                            <div className="clip-result-field-head">
                              <label>{activeClipTab === 'douyin' ? '抖音' : 'B 站'}标题</label>
                              <button
                                type="button"
                                onClick={() => navigator.clipboard?.writeText(platformCopy?.title || '')}
                                className="clip-result-copy"
                                title="复制标题"
                                aria-label="复制标题"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                                <span>复制</span>
                              </button>
                            </div>
                            <input
                              type="text"
                              value={platformCopy?.title || ''}
                              onChange={(e) => setEditingCopy(prev => ({ ...prev, [clip.index]: { ...prev[clip.index], [activeClipTab]: { ...platformCopy, title: e.target.value } } }))}
                              className="input"
                            />
                          </div>

                          {/* 文案输入行 */}
                          <div className="clip-result-field">
                            <div className="clip-result-field-head">
                              <label>文案</label>
                              <div className="flex items-center gap-2">
                                <span
                                  className="text-[11px] font-tabular"
                                  style={{
                                    color: captionLen > captionLimit ? 'var(--color-danger)' : 'var(--color-text-subtle)',
                                  }}
                                >
                                  {captionLen} / {captionLimit}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => navigator.clipboard?.writeText(platformCopy?.caption || '')}
                                  className="clip-result-copy"
                                  title="复制文案"
                                  aria-label="复制文案"
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                  </svg>
                                  <span>复制</span>
                                </button>
                              </div>
                            </div>
                            <textarea
                              value={platformCopy?.caption || ''}
                              onChange={(e) => setEditingCopy(prev => ({ ...prev, [clip.index]: { ...prev[clip.index], [activeClipTab]: { ...platformCopy, caption: e.target.value } } }))}
                              rows={4}
                              className="textarea"
                            />
                          </div>

                          {/* 操作行 */}
                          <div className="flex gap-2 flex-wrap pt-1">
                            <button
                              onClick={() => handleRegenerateCopy(clip)}
                              disabled={regenerating.has(clip.index)}
                              className="btn btn-secondary btn-sm"
                            >
                              {regenerating.has(clip.index) ? (
                                <>
                                  <span className="spinner" aria-hidden="true" />
                                  <span>生成中...</span>
                                </>
                              ) : (
                                <>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <polyline points="23 4 23 10 17 10" />
                                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                                  </svg>
                                  <span>重新生成文案</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>

              {/* Sticky 底部下载栏 —— 滚动时始终可见 */}
              <div className="clip-result-footer">
                <div className="clip-result-footer-inner">
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    已生成 <span className="font-semibold font-tabular" style={{ color: 'var(--color-text)' }}>{clipResults.length}</span> 个切片，包含视频、字幕和双平台文案
                  </p>
                  <button onClick={handleDownload} className="btn btn-primary btn-lg">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span>打包下载 ZIP</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部全局导航：上一步 + 重新开始 */}
        {currentStep > 1 && (
          <div className="mt-10 flex items-center justify-between border-t border-border pt-5">
            <button
              onClick={() => setCurrentStep(prev => (prev - 1) as 1|2|3|4)}
              className="btn btn-secondary btn-sm"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>上一步</span>
            </button>
            <button
              onClick={handleReset}
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--color-danger)' }}
            >
              重新开始
            </button>
          </div>
        )}

      </div>
    </div>
  )
  }
}
