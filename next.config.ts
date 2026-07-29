import type { NextConfig } from "next";

// API origin (AdonisJS backend) — injected into the CSP connect-src so the
// rewired frontend may call it. Falls back to the dev backend.
const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333").replace(/\/+$/, "");

// In development only, allow the backend on ANY host:3333. When testing from a
// phone over LAN, the page is loaded from the machine's LAN IP (e.g.
// 192.168.1.164) and the browser calls <that-ip>:3333 — a host the static
// API_ORIGIN can't know ahead of time. Production keeps the strict CSP.
const isDev = process.env.NODE_ENV === "development";
const DEV_BACKEND = isDev ? " http://*:3333" : "";

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
      // 'unsafe-eval' retiré (non requis en prod Next/React). 'unsafe-inline'
      // conservé tant qu'on n'a pas d'infra de nonces par-requête (Next 16).
      "script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      `img-src 'self' data: blob: ${API_ORIGIN}${DEV_BACKEND} https://res.cloudinary.com https://*.tile.openstreetmap.org`,
      // Domaines Firebase abandonnés retirés (*.googleapis.com, fcm, omnigestion.vercel.app).
      // OSM/OSRM ajoutés pour le module Livraisons (cartes Leaflet + géocodage Nominatim + routage OSRM).
      `connect-src 'self' ${API_ORIGIN}${DEV_BACKEND} https://api.deepseek.com https://res.cloudinary.com https://*.tile.openstreetmap.org https://nominatim.openstreetmap.org https://router.project-osrm.org`,
      // L'app livreur (scan QR + suivi live) a besoin de la caméra + géoloc, restreintes au même origine.
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
    value: "camera=(self), microphone=(), geolocation=(self)",
  },
];

const nextConfig: NextConfig = {
  // Dev-only: allow the LAN IP (e.g. a phone on the same Wi-Fi) to reach the
  // dev server so the driver app / QR scan can be tested from another device.
  // Production builds ignore this. Add more hostnames as needed.
  allowedDevOrigins: ["192.168.1.164", "localhost"],
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
