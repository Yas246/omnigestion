import type { NextConfig } from "next";

// API origin (AdonisJS backend) — injected into the CSP connect-src so the
// rewired frontend may call it. Falls back to the dev backend.
const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333").replace(/\/+$/, "");

const securityHeaders = [
  // Protection contre le clickjacking
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  // Empêcher le MIME-type sniffing
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  // Forcer HTTPS
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Contrôle du Referrer
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  // Content Security Policy
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://apis.google.com https://www.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://res.cloudinary.com https://firebasestorage.googleapis.com",
      `connect-src 'self' ${API_ORIGIN} https://api.deepseek.com https://*.googleapis.com https://fcm.googleapis.com https://res.cloudinary.com https://omnigestion.vercel.app`,
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
  // Permissions Policy
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  images: {
    // BYO-media app: images may come from Cloudinary, Firebase, the AdonisJS
    // backend, or localhost in dev. The wildcard keeps storefront renders from
    // breaking regardless of the merchant's media origin.
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "**" },
    ],
  },
  // Enable gzip/brotli HTTP compression explicitly (Next defaults to true).
  compress: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // Long-lived immutable caching for static image/font assets.
        source: "/:path*/:file(\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?))",
        locale: false,
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
