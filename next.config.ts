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
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  // Serve a friendly offline page when a navigation isn't cached and we're offline.
  fallbacks: {
    document: "/offline",
  },
  workboxOptions: {
    disableDevLogs: true,
  },
});

export default withPWA(nextConfig);
