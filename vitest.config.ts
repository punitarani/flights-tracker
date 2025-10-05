/// <reference types="vitest" />

import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const projectPresets = {
  default: {
    extends: true,
    test: {
      name: "default",
      environment: "happy-dom",
      include: ["src/**/*.test.ts"],
      exclude: ["src/lib/fli/__tests__/**"],
    },
  },
  fli: {
    extends: true,
    test: {
      name: "fli",
      environment: "node",
      include: ["src/lib/fli/__tests__/**/*.test.ts"],
      testTimeout: 60_000,
    },
  },
} as const;
const selection = process.env.VITEST_SELECTION ?? "default";

const selectedProjects =
  selection === "all"
    ? [projectPresets.default, projectPresets.fli]
    : selection === "fli"
      ? [projectPresets.fli]
      : [projectPresets.default];

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
    projects: selectedProjects,
  },
  resolve: {
    alias: {
      "@": resolve(process.cwd(), "src"),
    },
  },
});
