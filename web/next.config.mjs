/** @type {import('next').NextConfig} */

// Multi-zone: the existing Vite SPA keeps serving the interactive/authed
// surfaces. When SPA_ORIGIN is set (the SPA's deployment URL), we rewrite
// those paths to it so users stay on one apex domain. Unset locally = the
// Next app is built/verified standalone (SEO routes only).
const SPA_ORIGIN = process.env.SPA_ORIGIN;
const SPA_PATHS = ["/login", "/profile", "/admin", "/add", "/onboard"];

const nextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
  async rewrites() {
    if (!SPA_ORIGIN) return [];
    return SPA_PATHS.flatMap((p) => [
      { source: p, destination: `${SPA_ORIGIN}${p}` },
      { source: `${p}/:path*`, destination: `${SPA_ORIGIN}${p}/:path*` },
    ]);
  },
};

export default nextConfig;
