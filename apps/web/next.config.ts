import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  outputFileTracingRoot: path.join(__dirname, '../..'),
};

export default nextConfig;
