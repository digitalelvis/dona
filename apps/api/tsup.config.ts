import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/local.ts"],
  format: ["esm"],
  platform: "node",
  target: "node20",
  outDir: "dist",
  outExtension: () => ({ js: ".mjs" }),
  clean: true,
  sourcemap: true,
  bundle: true,
  noExternal: [/^@donaoferta\//, "hono", "@hono/node-server"],
});
