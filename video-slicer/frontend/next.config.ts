import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // 根路由 / 直接服务静态 landing.html（组员 Brief Cut 落地页）
      // 工具流程在 /app（由 app/app/page.tsx 渲染）
      { source: "/", destination: "/landing.html" },
    ];
  },
};

export default nextConfig;
