'use client'

import { ThemeToggle } from './ThemeToggle'

interface Step {
  id: 1 | 2 | 3 | 4
  label: string
}

interface AppHeaderProps {
  currentStep: 1 | 2 | 3 | 4
  steps: Step[]
  isStepCompleted: (step: number) => boolean
  onStepClick: (step: 1 | 2 | 3 | 4) => void
  savedHint?: string
}

/**
 * AppHeader — /app 工具流顶部全局栏
 * 设计参考：Linear / Vercel / Resend 的 fixed-top app shell
 *
 * 结构：
 *   左：Brief Cut logo（与 landing 视觉一致）
 *   中：精简版步骤指示器（dot + line，紧凑）
 *   右：保存状态 + 主题切换
 *
 * 用 backdrop-blur 让滚动时下方内容隐约可见，建立"产品 chrome"感。
 */
export function AppHeader({
  currentStep,
  steps,
  isStepCompleted,
  onStepClick,
  savedHint = '已自动保存',
}: AppHeaderProps) {
  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{
        background: 'color-mix(in srgb, var(--color-bg-elevated) 80%, transparent)',
        backdropFilter: 'saturate(180%) blur(12px)',
        WebkitBackdropFilter: 'saturate(180%) blur(12px)',
        borderColor: 'var(--color-border)',
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
        {/* 左：Logo */}
        <a href="/" className="flex items-center gap-2 shrink-0 group" aria-label="Brief Cut 首页">
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-md font-bold text-[15px] transition-transform group-hover:scale-105"
            style={{
              background: 'var(--color-text)',
              color: 'var(--color-bg)',
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
            }}
            aria-hidden="true"
          >
            B
          </span>
          <span
            className="font-semibold tracking-tight text-[15px]"
            style={{ color: 'var(--color-text)' }}
          >
            Brief Cut
          </span>
        </a>

        {/* 中：步骤指示器（精简版） */}
        <nav
          aria-label="处理流程"
          className="hidden md:flex items-center gap-1.5 flex-1 justify-center max-w-[480px]"
        >
          {steps.map((step, idx) => {
            const completed = isStepCompleted(step.id)
            const active = currentStep === step.id
            const clickable = completed && !active
            const status = completed ? 'done' : active ? 'current' : 'pending'

            return (
              <div key={step.id} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => clickable && onStepClick(step.id)}
                  disabled={!clickable && !active}
                  aria-current={active ? 'step' : undefined}
                  className="header-step"
                  data-status={status}
                  data-clickable={clickable}
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
                {idx < steps.length - 1 && (
                  <span
                    className="header-step-line"
                    data-passed={completed}
                    aria-hidden="true"
                  />
                )}
              </div>
            )
          })}
        </nav>

        {/* 右：状态 + 主题切换 */}
        <div className="flex items-center gap-3 shrink-0">
          <span
            className="hidden sm:inline-flex items-center gap-1.5 text-xs"
            style={{ color: 'var(--color-text-subtle)' }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--color-success)' }}
              aria-hidden="true"
            />
            {savedHint}
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
