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
  async redirects() {
    return [
      { source: "/dashboard/overview", destination: "/dashboard", permanent: true },
      { source: "/dashboard/overview/:path*", destination: "/dashboard", permanent: true },
      { source: "/dashboard/territory", destination: "/dashboard", permanent: true },
      { source: "/dashboard/territory/:path*", destination: "/dashboard", permanent: true },
    ];
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
      // Enforce HTTPS for 2 years; opt-in to preload list.
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      // Disable the legacy XSS auditor (can itself be exploited in old browsers).
      { key: "X-XSS-Protection", value: "0" },
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
