import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",  // Required for static site generation
  images: {
    unoptimized: true, // Required for GitHub Pages (no Next.js image optimization server)
  },
};

export default nextConfig;
