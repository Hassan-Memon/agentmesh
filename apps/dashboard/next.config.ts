import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // `standalone` emits a self-contained server in .next/standalone for the Docker image.
  output: 'standalone',
  reactStrictMode: true,
};

export default nextConfig;
