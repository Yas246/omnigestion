import type { NextConfig } from "next";

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
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://firebasestorage.googleapis.com https://securetoken.google.com https://www.googleapis.com https://fcm.googleapis.com https://res.cloudinary.com https://omnigestion.vercel.app",
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
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
