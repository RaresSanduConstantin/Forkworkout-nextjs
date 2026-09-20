import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Component regression tests import the same TSX modules used by Next.
  oxc: {
    jsx: { runtime: "automatic" },
  },
  // Resolve the "@/..." import alias the same way Next/tsconfig does.
  resolve: {
    alias: {
      "@": rootDir,
    },
  },
  test: {
    globals: true,
    // Default to node; storage tests opt into jsdom via a file docblock.
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
