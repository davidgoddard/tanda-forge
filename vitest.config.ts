import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "app/src/shared/**/*.ts",
        "app/src/main/**/*.ts",
        "app/src/renderer/controllers/**/*.ts",
        "app/src/renderer/modules/**/*.ts",
        "app/src/renderer/state/**/*.ts",
        "app/src/renderer/domain.ts",
      ],
      exclude: [
        "app/src/main/main.ts",
        "app/src/preload/preload.ts",
        "app/src/renderer/renderer.ts",
        "app/src/renderer/i18n.ts",
        "app/src/main/playback/**",
      ],
      thresholds: {
        statements: 50,
        branches: 40,
        functions: 50,
        lines: 50,
      },
    },
  },
});
