import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page is per-user and per-language (cookie), so we use classic dynamic
  // rendering instead of Cache Components' static shells.
  experimental: {
    // CSV and product-image uploads go through Server Actions.
    serverActions: { bodySizeLimit: "6mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
