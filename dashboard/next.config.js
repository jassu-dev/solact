/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    serverExternalPackages: [],
  },
  webpack(config) {
    // Required for @xenova/transformers ONNX runtime
    config.resolve.alias = {
      ...config.resolve.alias,
      "sharp$": false,
      "onnxruntime-node$": false,
    };
    return config;
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: process.env.INTERNAL_API_URL || "http://api:8000/api/v1/:path*",
      },
      {
        source: "/api/:path*",
        destination: process.env.INTERNAL_API_URL || "http://api:8000/api/v1/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
