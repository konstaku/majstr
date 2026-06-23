/** @type {import('next').NextConfig} */

// App↔catalogue host separation is owned by middleware.ts (app.majstr.xyz serves
// the interactive surfaces; the apex/country hosts serve the catalogue). The old
// SPA_ORIGIN redirects to the standalone Vite app were removed in the Phase 1
// collapse — the (app) routes now live in this Next app.
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
  images: {
    // Master photos are already resized at upload (sharp → ≤1024px JPEG, ~40KB)
    // and live in the chupakabra-test S3 bucket. Serve them straight from S3 and
    // SKIP Vercel Image Optimization: the optimizer adds little for pre-sized
    // images and its monthly transform quota was being exhausted, which made new
    // master photos stop rendering on the cards. unoptimized = no quota, no blanks.
    unoptimized: true,
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
