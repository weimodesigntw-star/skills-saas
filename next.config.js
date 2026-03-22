/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server Actions 在 Next.js 14+ 中已預設開啟，無需配置
  // 避免 SWC 在 build 時崩潰 (SIGABRT)，可於 Vercel 加 NODE_OPTIONS=--max_old_space_size=4096
  swcMinify: false,
  async redirects() {
    return [
      { source: '/dashboard/pos/inventory', destination: '/dashboard/inventory', permanent: false },
    ];
  },
  images: {
    /** EasyStore 等外部 CDN 商品圖不需經 Next 優化；避免逐一維護 remotePatterns */
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ucwcavjnqalnxnisiuha.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

module.exports = nextConfig
