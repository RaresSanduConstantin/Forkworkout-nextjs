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
  // start_url (/app) is a static page — precache it (instead of the default
  // runtime-only caching) so the installed PWA launches offline on first run.
  cacheStartUrl: true,
  dynamicStartUrl: false,
  // Share envelopes must always honor server-side expiry. Never let the PWA's
  // default API cache reopen an expired share from a device cache.
  extendDefaultRuntimeCaching: true,
  // Serve a friendly offline page when a navigation isn't cached and we're offline.
  fallbacks: {
    document: "/offline",
  },
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        // Barcode responses are cached at the server/CDN layer. The installed
        // PWA must still reach that layer so a stale miss cannot hide a product.
        urlPattern: /\/api\/nutrition\/barcode(?:\?.*)?$/,
        handler: "NetworkOnly",
        method: "GET",
      },
      {
        urlPattern: /\/api\/shares(?:\/.*)?$/,
        handler: "NetworkOnly",
        method: "GET",
      },
    ],
  },
});

export default withPWA(nextConfig);
