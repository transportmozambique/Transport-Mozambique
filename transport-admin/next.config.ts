import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optimize memory usage
  experimental: {
    // Reduce memory usage during development
    optimizePackageImports: ['recharts', 'maplibre-gl'],
  },
  
  // Optimize production builds (swcMinify is now default in Next.js 16)
  compress: true,
  
  // Optimize images
  images: {
    unoptimized: false,
  },
};

export default nextConfig;
