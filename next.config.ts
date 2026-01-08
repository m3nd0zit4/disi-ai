import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
        hostname: 'oaidalleapiprodscus.blob.core.windows.net',
      },
      {
        protocol: 'https',
        hostname: 'openai.com',
      },
      {
        protocol: 'https',
        hostname: 'disi-ai-media-storage.s3.us-east-1.amazonaws.com',
      },
    ],
  },
};

export default nextConfig;
