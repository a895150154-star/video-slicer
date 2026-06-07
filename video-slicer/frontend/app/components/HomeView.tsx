'use client'

import { ReactNode } from 'react'

type ToolId = 'slice' | 'golden' | 'title' | 'aspect'

interface HomeViewProps {
  /**
   * 顶部的上传区——由 page.tsx 传入 step 1 上传 JSX
   * 替代了之前的 "开始创作" 装饰性大卡片，融合工作流与首页
   */
  uploadSection: ReactNode
  /** 点击工具 icon → 触发上传（聚焦文件选择器） */
  onPickFile: () => void
}

/**
 * HomeView —— 首页（统一上传 + 工具集合 + 最近创作）
 *
 * 设计决策：
 * - 移除原"+ 开始创作"装饰大卡，直接把工作流 step 1 上传卡嵌进来
 * - 4 个工具图标点击 = 触发文件选择器（不再跳页）
 * - "最近创作" 暂为空态
 */
export function HomeView({ uploadSection, onPickFile }: HomeViewProps) {
  const tools: { id: ToolId; label: string; icon: React.ReactNode; active: boolean }[] = [
    {
      id: 'slice',
      label: '智能切片',
      active: true,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="6" width="8" height="12" rx="1.5" />
          <rect x="13" y="6" width="8" height="12" rx="1.5" />
        </svg>
      ),
    },
    {
      id: 'golden',
      label: '金句生成',
      active: false,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2 L14 9 L21 10 L16 14 L18 21 L12 17 L6 21 L8 14 L3 10 L10 9 Z" />
        </svg>
      ),
    },
    {
      id: 'title',
      label: '标题生成',
      active: false,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="14" y2="18" />
        </svg>
      ),
    },
    {
      id: 'aspect',
      label: '尺寸设计',
      active: false,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="8" width="9" height="8" rx="1" />
          <rect x="14" y="6" width="7" height="12" rx="1" />
        </svg>
      ),
    },
  ]

  return (
    <div className="space-y-10 max-w-[1100px] mx-auto">
      {/* 上传区（替代了原"开始创作"hero） */}
      {uploadSection}

      {/* 工具网格 —— 点击触发文件选择，间接进入上传流程 */}
      <div className="home-tools">
        {tools.map((tool) => (
          <button
            key={tool.id}
            type="button"
            onClick={onPickFile}
            className="home-tool"
            data-active={tool.active}
            aria-label={tool.label}
          >
            <span className="home-tool-icon" data-active={tool.active}>
              {tool.icon}
            </span>
            <span className="home-tool-label">{tool.label}</span>
          </button>
        ))}
      </div>

      {/* 最近创作 */}
      <div>
        <div className="flex items-end justify-between mb-4">
          <h2 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>
            最近创作
          </h2>
        </div>

        <div className="home-empty">
          <span className="home-empty-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="14" height="12" rx="2" />
              <polygon points="22 8 16 12 22 16 22 8" />
            </svg>
          </span>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            还没有创作记录
          </p>
          <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-subtle)' }}>
            上传第一段直播录像，让 AI 自动产出可发布的切片
          </p>
        </div>
      </div>
    </div>
  )
}
