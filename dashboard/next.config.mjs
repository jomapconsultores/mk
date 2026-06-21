/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
    // @simplewebauthn/server es ESM puro — no bundlear en el servidor (Next.js 14)
    serverComponentsExternalPackages: ['@simplewebauthn/server'],
  },
};
export default nextConfig;
