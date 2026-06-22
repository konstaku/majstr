/** @type {import('next').NextConfig} */

// App↔catalogue host separation is owned by middleware.ts (app.majstr.xyz serves
// the interactive surfaces; the apex/country hosts serve the catalogue). The old
// SPA_ORIGIN redirects to the standalone Vite app were removed in the Phase 1
// collapse — the (app) routes now live in this Next app.
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
};

export default nextConfig;
