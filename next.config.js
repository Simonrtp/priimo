/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't advertise the framework in HTTP responses.
  poweredByHeader: false,
  // Brotli/gzip is handled by Vercel's edge — `compress` would only matter
  // for `next start` on a custom host. Kept on for safety.
  compress: true,
  // Remove `console.*` calls (except errors/warns) from the production
  // client bundle. Server logs are untouched — useful for the API route.
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  async headers() {
    const securityHeaders = [
      // Send only the origin on cross-origin navigation (privacy-friendly default).
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      // Block MIME-type sniffing.
      { key: "X-Content-Type-Options", value: "nosniff" },
      // Disallow embedding in iframes (blocks clickjacking).
      { key: "X-Frame-Options", value: "DENY" },
      // Disable browser features we never need.
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
      },
    ];

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
