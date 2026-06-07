'use client'

import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'video-slicer:theme'

/**
 * 主题切换器（DESIGN.md §6.6）— 右上角 Sun/Moon 图标按钮。
 *
 * 工作机制：
 *   1. layout.tsx 头部 inline script 已在 hydrate 前应用主题到 <html data-theme>
 *   2. 本组件 hydrate 后读 <html data-theme> 同步初始状态
 *   3. 用户点击 → toggle + 写 localStorage + 更新 <html data-theme>
 *   4. CSS 变量自动按 data-theme 切换（globals.css 已注入 light / dark 两套 token）
 *
 * 图标用内联 SVG，不引入图标库（DESIGN.md 实现纪律 #3 不增加依赖）
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const current = (document.documentElement.getAttribute('data-theme') as Theme) || 'light'
    setTheme(current)
    setMounted(true)
  }, [])

  function toggle() {
    const next: Theme = theme === 'light' ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // localStorage 不可用（隐私模式 / 配额满）— 忽略
    }
    setTheme(next)
  }

  // 防 SSR/客户端不一致闪烁：未挂载时渲染占位等大小，避免布局抖动
  if (!mounted) {
    return <div aria-hidden className="w-9 h-9 rounded-md" />
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}
      title={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}
      className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-border bg-bg-elevated text-text-muted hover:text-text hover:border-border-strong transition-colors focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
    >
      {theme === 'light' ? (
        // Moon icon — 点击切到 dark
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        // Sun icon — 点击切到 light
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      )}
    </button>
  )
}
