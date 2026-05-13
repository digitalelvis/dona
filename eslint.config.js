// @ts-check
import boundariesPlugin from "eslint-plugin-boundaries";
import globals from "globals";
import tseslint from "typescript-eslint";

import { boundariesConfig } from "./tools/lint-rules/boundaries.js";

const cloudSdkRestriction = {
  group: boundariesConfig.forbiddenPackages,
  message: "Cloud SDKs are only allowed in packages/adapters-*. Move this import there.",
};

const noRestrictedImportsRule = [
  "error",
  {
    patterns: [cloudSdkRestriction],
  },
];

const boundariesElementTypesRule = [
  "error",
  {
    default: "disallow",
    rules: boundariesConfig.rules,
  },
];

/**
 * Per-package `no-restricted-imports` overrides. They are the practical
 * complement to `boundaries/element-types`:
 *   - `element-types` reliably catches relative-path cross-folder imports;
 *   - the regex patterns below catch package-name imports (`@donaoferta/*`)
 *     which the boundaries plugin cannot resolve through pnpm symlinks
 *     without additional resolver wiring.
 * Both layers are necessary in this monorepo. See STATE.md D-019.
 */
const perPackageImportOverrides = {
  // core-kernel must depend on NOTHING from the workspace.
  core: [
    cloudSdkRestriction,
    {
      regex: "^@donaoferta/.*",
      message:
        "@donaoferta/core-kernel is the dependency-free primitive package — it must not import any other workspace package.",
    },
  ],
  // ports may only import @donaoferta/core-kernel.
  ports: [
    cloudSdkRestriction,
    {
      regex: "^@donaoferta/(?!core-kernel(/|$)).*",
      message:
        "@donaoferta/ports may only depend on @donaoferta/core-kernel — no kits, adapters, domains or apps.",
    },
  ],
  // kits may only import core-kernel, ports, other kits.
  kit: [
    cloudSdkRestriction,
    {
      regex: "^@donaoferta/(?!core-kernel|ports|.*-kit)(.*)",
      message:
        "kit packages may only depend on @donaoferta/core-kernel, @donaoferta/ports and other @donaoferta/*-kit packages.",
    },
  ],
};

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/*.d.ts",
      "**/*.d.ts.map",
    ],
  },
  {
    files: ["**/*.{ts,tsx,mts,cts,js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node },
    },
    settings: {
      "boundaries/elements": boundariesConfig.elements,
      "boundaries/include": ["packages/**/*", "apps/**/*"],
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: ["tsconfig.json", "packages/*/tsconfig.json", "apps/*/tsconfig.json"],
        },
        node: true,
      },
    },
    plugins: {
      boundaries: boundariesPlugin,
    },
    rules: {
      "boundaries/element-types": boundariesElementTypesRule,
      "no-restricted-imports": noRestrictedImportsRule,
    },
  },
  ...tseslint.configs.recommended.map((cfg) => ({
    ...cfg,
    files: ["**/*.{ts,tsx,mts,cts}"],
  })),
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["packages/core-kernel/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: perPackageImportOverrides.core }],
    },
  },
  {
    files: ["packages/ports/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: perPackageImportOverrides.ports }],
    },
  },
  {
    files: ["packages/*-kit/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: perPackageImportOverrides.kit }],
    },
  },
  {
    files: ["packages/adapters-*/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    files: ["**/test/**/*.{ts,tsx}", "**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: {
      "boundaries/element-types": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["tools/**/*.{ts,js,mjs}", "**/*.config.{ts,js,mjs}", "**/vitest.config.ts"],
    rules: {
      "boundaries/element-types": "off",
      "no-restricted-imports": "off",
    },
  },
);
