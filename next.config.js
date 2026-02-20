/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server Actions 在 Next.js 14+ 中已預設開啟，無需配置
  // 避免 SWC 在 build 時崩潰 (SIGABRT)，可於 Vercel 加 NODE_OPTIONS=--max_old_space_size=4096
  swcMinify: false,
}

module.exports = nextConfig
