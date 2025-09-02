/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Type checking is handled by CI/CD pipeline
    ignoreBuildErrors: false,
  },
  eslint: {
    dirs: ['src'],
  },
  env: {
    API_URL: process.env.API_URL || 'http://localhost:8000',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_URL || 'http://localhost:8000'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;