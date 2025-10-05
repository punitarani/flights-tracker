/// <reference types="vitest" />

import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "test/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/coverage/**",
      ],
    },
    setupFiles: ["./src/test/setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "default",
          environment: "happy-dom",
          include: ["src/**/*.test.ts"],
          exclude: ["src/lib/fli/__tests__/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "fli",
          environment: "node",
          include: ["src/lib/fli/__tests__/**/*.test.ts"],
          testTimeout: 60_000,
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": resolve(process.cwd(), "src"),
    },
  },
});
