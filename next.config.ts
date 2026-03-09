import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security', // Forzar HTTPS
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'X-XSS-Protection', // Bloquear XSS
            value: '1; mode=block',
          },
          {
            key: 'X-Frame-Options', // Prevenir Clickjacking
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options', // Evitar MIME sniffing
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy', // Controlar referrers
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy', // Restringir APIs externas a la web
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
