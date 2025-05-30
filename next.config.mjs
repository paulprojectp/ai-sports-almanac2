/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  basePath: process.env.NODE_ENV === 'production' ? '/ai-sports-almanac' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/ai-sports-almanac/' : '',
}

export default nextConfig;
