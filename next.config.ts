import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ["*.space-z.ai", "*.chatglm.cn", "*.z.ai", "127.0.0.1", "localhost", "*.localhost"],
  // NOTE (dev stability): dev.log / tmp-scripts / .zscripts are in
  // .gitignore — Turbopack's watcher honors gitignore, so scratch scripts
  // and the request log never trigger Fast-Refresh rebuild loops.
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'framer-motion',
      'motion',
      'date-fns',
    ],
    // Sandbox has ~3.9GB RAM (4GB cgroup, no swap). 2200 lets the ~25s root
    // compile finish without cache-eviction thrash (1400 made compiles
    // crash-loop); steady-state serving is ~2.8GB which still fits a
    // headless QA browser in the remaining headroom. Keepalive.mjs guards
    // against residual OOM kills. NEVER delete .next (warm restarts are fast).
    turbopackMemoryLimit: 2200,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
