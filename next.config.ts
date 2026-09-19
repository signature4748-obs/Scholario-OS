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
    // Sandbox has ~3.9GB RAM (4GB cgroup, no swap). 2200 lets the ~30s root
    // compile finish (measured 2026-09-19: post-compile server ~3.1GB RSS;
    // with a SINGLE-tab QA browser that just fits — extra chrome renderers
    // or extra module compiles tip it into OOM. Keepalive.mjs guards the
    // rest. Browser QA protocol: recycle server → ONE tab → short burst →
    // close. NEVER delete .next. persistentCaching was tested and did NOT
    // survive restarts here (34s recompile either way) — don't re-add it.
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
