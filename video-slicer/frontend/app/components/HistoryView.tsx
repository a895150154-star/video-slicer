'use client'

import { useState } from 'react'

type Filter = 'all' | 'slice' | 'quote' | 'title' | 'size'

interface HistoryViewProps {
  onStartWorkflow: () => void
}

/**
 * HistoryView —— 历史记录页
 * 移植自组员 landing/index.html 的 #page-workspace > history tab。
 *
 * 当前状态：所有数据为空（暂无后端 list-videos API）。
 * 显示富视觉空态（动画胶片 + cut 脉冲），保留搜索 / 过滤 UI 骨架。
 * 后续接入后端后，将 worksList 替换为真实数据即可，UI 部分零改动。
 */
export function HistoryView({ onStartWorkflow }: HistoryViewProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  // 数据接入点：未来从后端 GET /api/list-videos 拉，或从 localStorage:video-slicer:history 读
  const worksList: Array<{
    id: string
    title: string
    featureTag: string
    featureLabel: string
    dur: string
    time: string
  }> = []

  const filters: Array<{ id: Filter; label: string }> = [
    { id: 'all', label: '全部' },
    { id: 'slice', label: '智能切片' },
    { id: 'quote', label: '金句' },
    { id: 'title', label: '标题' },
    { id: 'size', label: '尺寸' },
  ]

  const filtered = worksList.filter((w) => {
    if (filter !== 'all' && w.featureTag !== filter) return false
    if (search && !w.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="max-w-[1100px] w-full mx-auto">
      {/* 顶部：标题 + 搜索 + 过滤 + 新建 */}
      <header className="history-head">
        <div>
          <h1 className="history-title">历史记录</h1>
          <p className="history-sub">你所有的创作都在这里，随时回看与导出。</p>
        </div>

        <div className="history-actions">
          {/* 搜索框 */}
          <div className="history-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              placeholder="搜索作品 / 标题 / 标签"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="搜索历史记录"
            />
          </div>

          {/* 段控筛选 */}
          <div className="seg" role="tablist" aria-label="筛选">
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className="seg-btn"
                data-active={filter === f.id}
                role="tab"
                aria-selected={filter === f.id}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* 新建按钮 */}
          <button
            type="button"
            onClick={onStartWorkflow}
            className="btn btn-dark"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>新建</span>
          </button>
        </div>
      </header>

      {/* 空态 or 卡片网格 */}
      {filtered.length === 0 ? (
        <div className="history-empty">
          <div className="empty-illustration" aria-hidden="true">
            <span className="film" />
            <span className="film" />
            <span className="film" />
            <span className="empty-cut" />
          </div>
          <h3>{search || filter !== 'all' ? '没有匹配的记录' : '还没有任何记录'}</h3>
          <p>
            {search || filter !== 'all'
              ? '试试调整搜索词或切换分类'
              : '开始你的第一次 AI 剪辑，作品会自动保存在这里。'}
          </p>
          <button
            type="button"
            onClick={onStartWorkflow}
            className="btn btn-primary"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>开始创作</span>
          </button>
        </div>
      ) : (
        <div className="history-grid">
          {filtered.map((w) => (
            <article key={w.id} className="work-card" tabIndex={0} aria-label={w.title}>
              <div className="work-thumb">
                <span className="work-tag">{w.featureLabel}</span>
                <span className="work-duration">{w.dur}</span>
                <span className="work-play" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </div>
              <div className="work-meta">
                <h4>{w.title}</h4>
                <span className="work-time">{w.featureLabel} · {w.time}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
