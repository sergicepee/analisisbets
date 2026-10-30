/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  eslint: { ignoreDuringBuilds: true },
  images: { unoptimized: true },
  experimental: {
    outputFileTracingIncludes: {
      '/**/*': ['./public/data/**/*.csv'],
    },
  },
};
export default nextConfig;
