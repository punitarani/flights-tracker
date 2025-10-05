/// <reference types="vitest" />

import { resolve } from "node:path";
import { defineConfig, type TestProjectConfiguration } from "vitest/config";

const defaultProject: TestProjectConfiguration = {
  extends: true,
  test: {
    name: "default",
    environment: "happy-dom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["src/lib/fli/__tests__/**"],
  },
};

const fliProject: TestProjectConfiguration = {
  extends: true,
  test: {
    name: "fli",
    environment: "node",
    include: ["src/lib/fli/__tests__/**/*.test.ts"],
    testTimeout: 60_000,
  },
};

const selection = process.env.VITEST_SELECTION ?? "default";

const selectedProjects: TestProjectConfiguration[] =
  selection === "all"
    ? [defaultProject, fliProject]
    : selection === "fli"
      ? [fliProject]
      : [defaultProject];

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
