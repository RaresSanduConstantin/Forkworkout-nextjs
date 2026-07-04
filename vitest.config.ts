import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
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
