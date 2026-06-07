/** @type {import('next').NextConfig} */

// Multi-zone: the existing Vite SPA keeps serving the interactive/authed
// surfaces on its own origin (SPA_ORIGIN, e.g. https://app.majstr.xyz). When
// set, the Next app REDIRECTS those paths to the SPA so stray apex links keep
// working. Redirects (not rewrites) keep the SPA on its own origin, so its
// Vite asset URLs resolve correctly — no assetPrefix gymnastics, query strings
// are preserved automatically.
const SPA_ORIGIN = process.env.SPA_ORIGIN?.replace(/\/$/, "");
const SPA_PATHS = ["/login", "/profile", "/admin", "/add", "/onboard"];

const nextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
  images: {
    // Master photos live in the chupakabra-test S3 bucket (region host +
    // legacy global host). Serve them through the Next optimizer as AVIF/WebP.
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "chupakabra-test.s3.eu-west-3.amazonaws.com",
      },
      { protocol: "https", hostname: "chupakabra-test.s3.amazonaws.com" },
    ],
  },
  async redirects() {
    if (!SPA_ORIGIN) return [];
    return SPA_PATHS.flatMap((p) => [
      { source: p, destination: `${SPA_ORIGIN}${p}`, permanent: false },
      {
        source: `${p}/:path*`,
        destination: `${SPA_ORIGIN}${p}/:path*`,
        permanent: false,
      },
    ]);
  },
};

export default nextConfig;
