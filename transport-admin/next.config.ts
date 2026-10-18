import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gastar menos memória
  experimental: {
    // Gastar menos memória em desenvolvimento
    optimizePackageImports: ['recharts', 'maplibre-gl'],
  },
  
  // Optimizar as versões de produção (o swcMinify já vem por omissão no Next.js 16)
  compress: true,
  
  // Optimizar as imagens
  images: {
    unoptimized: false,
  },
};

export default nextConfig;
