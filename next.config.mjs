/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  images: { unoptimized: true },
  experimental: {
    outputFileTracingIncludes: {
      '/*': ['./public/data/**/*.csv'],
    },
  },
};
export default nextConfig;
