import type { NextConfig } from "next";

// ── dev-stability: gateway-aware webpack lazyCompilation ────────────────
// The `/` god-entry dynamically imports every role panel; a FULL compile
// peaks ~3.1–3.4GB and OOM-kills the dev server (4GB cgroup). lazyCompilation
// compiles each panel only when the browser first visits it. The CUSTOM
// backend (fixed port + query-string stripping + same-origin client) makes
// it work behind the sandbox gateway — the stock backend burns an absolute
// `http://localhost:<random>/` URL into browser chunks, which every remote
// visitor fails to reach (blank preview). See src/lazy-compilation/*.js.
const lazyBackend =
  process.env.NODE_ENV === "production"
    ? undefined
    : require(`${process.cwd()}/src/lazy-compilation/backend`);

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ["*.space-z.ai", "*.chatglm.cn", "*.z.ai", "127.0.0.1", "localhost", "*.localhost"],
  // NOTE (dev stability): dev.log / tmp-scripts / .zscripts are in
  // .gitignore — the watcher honors gitignore, so scratch scripts and the
  // request log never trigger Fast-Refresh rebuild loops.
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'framer-motion',
      'motion',
      'date-fns',
    ],
    // Memory guidance for Turbopack runs (webpack mode ignores it; kept for
    // the times the project is booted without --webpack).
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

// Applied by `next dev --webpack` (Next 16): each panel compiles on first
// visit instead of the whole god-entry at once.
if (process.env.NODE_ENV !== "production" && lazyBackend) {
  (nextConfig as any).webpack = (config: any) => {
    config.experiments = {
      ...config.experiments,
      lazyCompilation: {
        imports: true,
        entries: false,
        backend: lazyBackend,
      },
    };
    console.log("[memory-fix] lazyCompilation enabled (gateway-aware custom backend, port 3777)");
    return config;
  };
}

export default nextConfig;
