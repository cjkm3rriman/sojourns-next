/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 1Password SDK ships a WASM binary that webpack can't bundle correctly.
  // Marking these as external tells Next.js to load them from node_modules at
  // runtime instead of attempting to bundle them.
  serverExternalPackages: ['@1password/sdk', '@1password/sdk-core'],
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
      {
        protocol: 'https',
        hostname: 'images.clerk.dev',
      },
      {
        protocol: 'https',
        hostname: 'airlabs.co',
      },
    ],
  },
};

export default nextConfig;
