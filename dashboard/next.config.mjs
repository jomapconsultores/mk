/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb', // permite importar archivos CSV grandes
    },
  },
};
export default nextConfig;
