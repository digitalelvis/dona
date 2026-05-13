#!/usr/bin/env tsx
/**
 * tools/check-tsconfig.ts — static guard that every workspace tsconfig
 *
 * 1. extends `tools/tsconfig/base.json` (libraries) or
 *    `tools/tsconfig/app.json` (apps);
 * 2. does NOT downgrade any strict flag (every flag in STRICT_FLAGS must
 *    remain truthy after the local overrides are applied).
 *
 * Usage:
 *   tsx tools/check-tsconfig.ts                 # scans the real repo
 *   tsx tools/check-tsconfig.ts --root <dir>    # used by fixture tests
 *
 * Exit codes:
 *   0  all tsconfigs comply
 *   1  one or more violations (detailed report on stderr)
 *   2  configuration error (malformed JSON, missing fixture, etc.)
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface TsconfigRaw {
  readonly extends?: string;
  readonly compilerOptions?: Record<string, unknown>;
}

export type WorkspaceKind = "lib" | "app";

export interface Violation {
  readonly tsconfigPath: string;
  readonly kind: "no-preset" | "wrong-preset" | "strict-flag-downgraded";
  readonly detail: string;
}

export interface CheckTsconfigResult {
  readonly violations: readonly Violation[];
  readonly scanned: readonly string[];
}

/** Strict TS flags whose value MUST stay truthy in every workspace tsconfig. */
const STRICT_FLAGS: readonly string[] = [
  "strict",
  "noUncheckedIndexedAccess",
  "exactOptionalPropertyTypes",
  "noImplicitOverride",
  "noFallthroughCasesInSwitch",
  "noImplicitReturns",
  "useUnknownInCatchVariables",
  "isolatedModules",
];

const PRESET_RELPATH = {
  lib: "tools/tsconfig/base.json",
  app: "tools/tsconfig/app.json",
} as const;

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function readJsonRelaxed<T>(file: string): Promise<T> {
  const raw = await readFile(file, "utf8");
  // tsconfig allows comments and trailing commas; strip them so JSON.parse works.
  const stripped = raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:\/])\/\/.*$/gm, "$1")
    .replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(stripped) as T;
}

async function listWorkspaceTsconfigs(
  root: string,
): Promise<{ file: string; kind: WorkspaceKind }[]> {
  const out: { file: string; kind: WorkspaceKind }[] = [];
  for (const [group, kind] of [
    ["packages", "lib"],
    ["apps", "app"],
  ] as const) {
    const groupDir = join(root, group);
    if (!(await fileExists(groupDir))) continue;
    const entries = await readdir(groupDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const candidate = join(groupDir, entry.name, "tsconfig.json");
      if (await fileExists(candidate)) out.push({ file: candidate, kind });
    }
  }
  return out;
}

function endsWithPath(value: string, expectedSuffix: string): boolean {
  const normalized = value.replace(/\\/g, "/");
  return normalized.endsWith(expectedSuffix);
}

function extendsAcceptedPreset(extendsValue: string | undefined, kind: WorkspaceKind): boolean {
  if (extendsValue === undefined) return false;
  return endsWithPath(extendsValue, PRESET_RELPATH[kind]);
}

export async function checkTsconfigs(root: string): Promise<CheckTsconfigResult> {
  const files = await listWorkspaceTsconfigs(root);
  const violations: Violation[] = [];
  const scanned: string[] = [];

  for (const { file, kind } of files) {
    const relPath = relative(root, file);
    scanned.push(relPath);
    let raw: TsconfigRaw;
    try {
      raw = await readJsonRelaxed<TsconfigRaw>(file);
    } catch (err) {
      violations.push({
        tsconfigPath: relPath,
        kind: "no-preset",
        detail: `failed to parse: ${(err as Error).message}`,
      });
      continue;
    }

    if (raw.extends === undefined || raw.extends.length === 0) {
      violations.push({
        tsconfigPath: relPath,
        kind: "no-preset",
        detail: `tsconfig.json must extend "${PRESET_RELPATH[kind]}"`,
      });
      continue;
    }

    if (!extendsAcceptedPreset(raw.extends, kind)) {
      violations.push({
        tsconfigPath: relPath,
        kind: "wrong-preset",
        detail: `extends "${raw.extends}" — expected to extend "${PRESET_RELPATH[kind]}"`,
      });
      continue;
    }

    const overrides = raw.compilerOptions ?? {};
    for (const flag of STRICT_FLAGS) {
      if (Object.prototype.hasOwnProperty.call(overrides, flag) && overrides[flag] !== true) {
        violations.push({
          tsconfigPath: relPath,
          kind: "strict-flag-downgraded",
          detail: `compilerOptions.${flag} was overridden to ${JSON.stringify(overrides[flag])}; must stay true`,
        });
      }
    }
  }

  return { violations, scanned };
}

interface CliOptions {
  readonly root: string;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const args = [...argv];
  let root = process.cwd();
  while (args.length > 0) {
    const flag = args.shift();
    if (flag === "--root") {
      const v = args.shift();
      if (v === undefined) throw new Error("--root requires a value");
      root = resolve(v);
    } else if (flag !== undefined) {
      throw new Error(`Unknown argument: ${flag}`);
    }
  }
  return { root };
}

export async function runCli(argv: readonly string[]): Promise<number> {
  const { root } = parseArgs(argv);
  const result = await checkTsconfigs(root);

  if (result.violations.length === 0) {
    process.stdout.write(
      `check-tsconfig: ${result.scanned.length} tsconfig(s) scanned, no violations.\n`,
    );
    return 0;
  }

  process.stderr.write(`check-tsconfig: ${result.violations.length} violation(s) found:\n`);
  for (const v of result.violations) {
    process.stderr.write(`  - ${v.tsconfigPath} [${v.kind}]: ${v.detail}\n`);
  }
  return 1;
}

const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  runCli(process.argv.slice(2)).then((code) => process.exit(code));
}
