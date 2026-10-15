import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure proper rendering
  reactStrictMode: true,
  
  // Optimize for production (compress is enabled by default in Next.js 16)
  compress: true,
  
  // Ensure proper CSS handling for Tailwind v4
  experimental: {
    optimizeCss: true,
  },
  
  // Image optimization
  images: {
    formats: ['image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96],
  },
};

export default nextConfig;
