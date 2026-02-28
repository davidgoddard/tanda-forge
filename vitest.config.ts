import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["app/src/**/*.ts"],
      exclude: [
        "app/src/main/main.ts",
        "app/src/preload/preload.ts",
        "app/src/renderer/**",
        "app/src/main/playback/**",
      ],
    },
  },
});
