'use client'

import { ReactNode } from 'react'
import { ThemeToggle } from './ThemeToggle'

type SidebarNav = 'home' | 'history'

interface AppShellProps {
  /** 当前激活的侧边栏导航项 */
  activeNav: SidebarNav
  /** 切换侧边栏导航 */
  onNavChange: (nav: SidebarNav) => void
  /** 主区顶部面包屑（如 "首页"、"智能切片"、"步骤 2"） */
  breadcrumb: string
  /** 返回首页按钮是否显示（在工作流内显示，首页不显示） */
  showBackToHome?: boolean
  onBackToHome?: () => void
  children: ReactNode
}

/**
 * AppShell —— 双栏 app shell
 * 参考组员设计图：左侧 ~280px sidebar + 右侧主区
 * sidebar：logo + 用户区 + 导航 + 底部"返回首页"
 * 主区：顶部小型 chrome（面包屑 + 右上 icon）+ 内容区
 */
export function AppShell({
  activeNav,
  onNavChange,
  breadcrumb,
  showBackToHome,
  onBackToHome,
  children,
}: AppShellProps) {
  const navItems: { id: SidebarNav; label: string }[] = [
    { id: 'home', label: '首页' },
    { id: 'history', label: '历史记录' },
  ]

  return (
    <div className="app-shell">
      {/* ===== 左：Sidebar ===== */}
      <aside className="app-sidebar" aria-label="主导航">
        {/* 用户/品牌区 —— 点击 logo 回首页（如果当前不在首页） */}
        <button
          type="button"
          onClick={() => onNavChange('home')}
          className="app-sidebar-user"
          aria-label="返回 Brief Cut 首页"
        >
          <span className="app-sidebar-logo" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6 L4 18 L12 18 C15.3 18 18 16 18 13.5 C18 11.5 16.5 10 14.5 9.7 C16 9.3 17 8 17 6.5 C17 4.5 15 3 12.5 3 L4 3 Z" />
            </svg>
          </span>
          <div className="min-w-0 text-left">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>
              Brief Cut
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
              免费版
            </p>
          </div>
        </button>

        {/* 导航 */}
        <nav className="app-sidebar-nav" aria-label="工作区">
          {navItems.map((item) => {
            const active = item.id === activeNav
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavChange(item.id)}
                className="app-sidebar-nav-item"
                data-active={active}
                aria-current={active ? 'page' : undefined}
              >
                <span className="app-sidebar-nav-dot" aria-hidden="true" data-active={active} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* 底部：返回首页（仅在工作流内显示） */}
        {showBackToHome && (
          <div className="app-sidebar-footer">
            <button
              type="button"
              onClick={onBackToHome}
              className="app-sidebar-back"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>返回首页</span>
            </button>
          </div>
        )}
      </aside>

      {/* ===== 右：主区 ===== */}
      <main className="app-main">
        {/* 主区顶部 chrome */}
        <div className="app-main-topbar">
          <p className="text-sm" style={{ color: 'var(--color-text-subtle)' }}>
            {breadcrumb}
          </p>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/anthropics/claude-code"
              target="_blank"
              rel="noreferrer"
              className="app-icon-btn"
              aria-label="帮助"
              title="帮助"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </a>
            <a
              href="mailto:feedback@briefcut.ai"
              className="app-icon-btn"
              aria-label="反馈"
              title="反馈"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </a>
            <ThemeToggle />
          </div>
        </div>

        {/* 内容区 */}
        <div className="app-main-content">
          {children}
        </div>
      </main>
    </div>
  )
}
