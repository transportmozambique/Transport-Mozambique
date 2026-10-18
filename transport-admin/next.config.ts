import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optimize memory usage
  experimental: {
    // Reduce memory usage during development
    optimizePackageImports: ['recharts', 'maplibre-gl'],
  },
  
  // Optimizar as versões de produção (o swcMinify já vem por omissão no Next.js 16)
  compress: true,
  
  // Optimize images
  images: {
    unoptimized: false,
  },
};

export default nextConfig;
