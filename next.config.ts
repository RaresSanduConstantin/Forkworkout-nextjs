import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  images: {
    domains: ["raw.githubusercontent.com"],
  },
  // MuscleMapJS ships raw TypeScript from GitHub; let Next compile it.
  transpilePackages: ["@abdofallah/musclemap-js"],
};

// PWA: precache the app shell + runtime-cache assets so the app installs to the
// home screen and works offline. Disabled in dev to avoid caching headaches.
const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheOnFrontEndNav: true,
  reloadOnOnline: true,
  workboxOptions: {
    disableDevLogs: true,
  },
});

export default withPWA(nextConfig);
