import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
    proxyClientMaxBodySize: '50mb',
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
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
