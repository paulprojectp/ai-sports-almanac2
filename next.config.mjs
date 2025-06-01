/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Fix the basePath to match the repository name
  basePath: '/ai-sports-almanac2',
  assetPrefix: '/ai-sports-almanac2/',
  // Ensure the app directory is used as the root
  distDir: 'out',
  // Disable trailing slash to match GitHub Pages routing
  trailingSlash: false,
}

export default nextConfig;
