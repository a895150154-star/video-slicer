/**
 * 根路由占位 — 实际访问 / 会被 next.config.ts 的 rewrites 拦截
 * 重写到 /landing.html（组员 Brief Cut 落地页）。
 *
 * 如果 rewrites 配置失效（开发期偶发），这个组件会被显示，
 * 主动 redirect 到 /landing.html 兜底。
 */

import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/landing.html')
}
