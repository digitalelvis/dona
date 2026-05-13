/**
 * Architectural boundaries for the donaoferta monorepo. Single source of
 * truth for the dependency rules table documented in
 * `.specs/features/foundation-monorepo/design.md`.
 *
 * @type {{
 *   elements: Array<{ type: string; pattern: string; mode?: "folder"|"file" }>;
 *   rules: Array<{ from: string; allow: string[] }>;
 *   forbiddenPackages: string[];
 * }}
 */
export const boundariesConfig = {
  elements: [
    { type: "core", pattern: "packages/core-kernel/**", mode: "folder" },
    { type: "ports", pattern: "packages/ports/**", mode: "folder" },
    { type: "kit", pattern: "packages/*-kit/**", mode: "folder" },
    {
      type: "domain",
      pattern: "packages/{stores,catalog,users,collector,agent}/**",
      mode: "folder",
    },
    { type: "adapter", pattern: "packages/adapters-*/**", mode: "folder" },
    { type: "app", pattern: "apps/*/**", mode: "folder" },
  ],
  rules: [
    { from: "core", allow: [] },
    { from: "ports", allow: ["core"] },
    { from: "domain", allow: ["core", "ports", "domain"] },
    { from: "kit", allow: ["core", "ports", "kit"] },
    { from: "adapter", allow: ["core", "ports", "adapter"] },
    { from: "app", allow: ["core", "ports", "domain", "kit", "adapter"] },
  ],
  forbiddenPackages: ["@aws-sdk/*", "@google-cloud/*", "aws-cdk-lib", "firebase-admin"],
};
