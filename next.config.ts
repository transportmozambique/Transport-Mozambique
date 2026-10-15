import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Memory optimization settings */
  turbopack: {
    root: '.',
  },
  experimental: {
    // Reduce memory usage during build
    optimizePackageImports: ['@prisma/client', 'maplibre-gl'],
  },
  
  // Optimize production builds
  compress: true,
  
  // Reduce build memory usage
  swcMinify: true,
  
  // Optimize images
  images: {
    formats: ['image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96],
  },
  
  // Webpack optimizations for memory
  webpack: (config, { isServer }) => {
    // Reduce memory usage
    config.optimization = {
      ...config.optimization,
      moduleIds: 'deterministic',
    };
    
    // Exclude large dependencies from server bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    return config;
  },
};

export default nextConfig;
