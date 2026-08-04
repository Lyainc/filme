/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Turbopack dev SSR이 clsx를 externalize했다가 해시된 이름으로 못 찾는다(#647에서 실측 —
  // .next 캐시를 완전히 비운 클린 재기동에서 재현/제거를 4회 왕복 확인). bundle시켜 우회.
  transpilePackages: ['clsx', 'tailwind-merge', 'class-variance-authority'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
}

module.exports = nextConfig
