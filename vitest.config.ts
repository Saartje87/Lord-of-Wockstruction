import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Agent worktrees are whole checkouts of other branches.
    exclude: [...configDefaults.exclude, ".claude/**"],
    // Puts the tuning objects back after every test.
    setupFiles: ["./vitest.setup.ts"],
  },
  plugins: [
    {
      // Tiled's `.tmj` maps and `.tsj` tilesets are JSON, as in next.config.ts.
      name: "tiled-json",
      transform(code, id) {
        if (/\.(tmj|tsj)$/.test(id)) return `export default ${code}`;
      },
    },
  ],
});
