/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server Actions 在 Next.js 14+ 中已預設開啟，無需配置
  // 避免 SWC 編譯器在 Vercel build 時崩潰 (Rust panic / SIGABRT)
  swcMinify: false,
}

module.exports = nextConfig
