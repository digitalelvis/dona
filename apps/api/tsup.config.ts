import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/local.ts", "src/handler.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  outExtension: () => ({ js: ".mjs" }),
  clean: true,
  sourcemap: true,
  bundle: true,
  splitting: false,
  noExternal: [/^@donaoferta\//, "hono", "@hono/node-server"],
});
