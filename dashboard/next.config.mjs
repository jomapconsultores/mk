/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
  // @simplewebauthn/server es ESM puro — no bundlear en el servidor
  serverExternalPackages: ['@simplewebauthn/server'],
};
export default nextConfig;
