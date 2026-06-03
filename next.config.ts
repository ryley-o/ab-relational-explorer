import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media-proxy.artblocks.io",
      },
    ],
  },
};

export default nextConfig;
