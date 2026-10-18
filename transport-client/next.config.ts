import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Garantir que desenha bem
  reactStrictMode: true,
  
  // Optimizado para produção (a compressão já vem ligada por omissão no Next.js 16)
  compress: true,

  // Optimização das imagens
  images: {
    formats: ['image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96],
  },
};

export default nextConfig;
