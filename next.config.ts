import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    // Product image URLs are admin-supplied, so any https host must render without crashing.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  experimental: {
    serverActions: {
      // The product import posts up to 2,000 sheet rows in one action call.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
