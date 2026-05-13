#!/usr/bin/env tsx
/**
 * tools/check-deps.ts — static guard that every workspace `package.json`
 * declares only dependencies allowed for its `donaoferta.role`.
 *
 * Roles and their forbidden patterns are documented in
 * `.specs/features/foundation-monorepo/design.md` § "Architectural
 * Enforcement". This script is the second layer of defense, complementing
 * ESLint's `no-restricted-imports` (T9).
 *
 * Usage:
 *   tsx tools/check-deps.ts                 # scans packages/* and apps/*
 *   tsx tools/check-deps.ts --root <dir>    # scans <dir>/packages/* and <dir>/apps/*
 *                                          # (used by the unit tests against fixtures)
 *
 * Exit codes:
 *   0  all packages comply
 *   1  one or more violations (detailed report on stderr)
 *   2  configuration error (missing role, malformed package.json, etc.)
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type Role = "core" | "ports" | "domain" | "kit" | "adapter" | "app";

const ALL_ROLES: readonly Role[] = ["core", "ports", "domain", "kit", "adapter", "app"];

interface PackageJson {
  readonly name?: string;
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
  readonly donaoferta?: { readonly role?: string };
}

export interface Violation {
  readonly packagePath: string;
  readonly packageName: string;
  readonly role: Role;
  readonly dependency: string;
  readonly reason: string;
}

export interface CheckResult {
  readonly violations: readonly Violation[];
  readonly scanned: readonly string[];
  readonly missingRole: readonly string[];
}

const CLOUD_SDK_PATTERNS: readonly RegExp[] = [
  /^@aws-sdk\//,
  /^@google-cloud\//,
  /^aws-cdk-lib$/,
  /^firebase-admin$/,
];

function isCloudSdk(depName: string): boolean {
  return CLOUD_SDK_PATTERNS.some((rx) => rx.test(depName));
}

/**
 * Returns a violation reason string when the dependency is forbidden for
 * the given role, or `null` when allowed.
 */
function violationReason(role: Role, depName: string): string | null {
  if (isCloudSdk(depName) && role !== "adapter") {
    return `cloud SDK "${depName}" is only allowed in packages/adapters-* (role "adapter")`;
  }

  switch (role) {
    case "core":
      return `role "core" must have zero runtime dependencies (saw "${depName}")`;
    case "ports":
      if (depName === "@donaoferta/core-kernel") return null;
      return `role "ports" may only depend on @donaoferta/core-kernel (saw "${depName}")`;
    case "domain":
    case "kit":
    case "adapter":
    case "app":
      return null;
  }
}

function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ALL_ROLES as readonly string[]).includes(value);
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function readPackageJson(packagePath: string): Promise<PackageJson | null> {
  const pkgFile = join(packagePath, "package.json");
  if (!(await fileExists(pkgFile))) return null;
  const raw = await readFile(pkgFile, "utf8");
  return JSON.parse(raw) as PackageJson;
}

async function listWorkspaces(root: string): Promise<string[]> {
  const candidates: string[] = [];
  for (const group of ["packages", "apps"] as const) {
    const groupDir = join(root, group);
    if (!(await fileExists(groupDir))) continue;
    const entries = await readdir(groupDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) candidates.push(join(groupDir, entry.name));
    }
  }
  return candidates;
}

function depsOf(pkg: PackageJson): Record<string, string> {
  return {
    ...(pkg.dependencies ?? {}),
    ...(pkg.peerDependencies ?? {}),
  };
}

export async function checkDependencies(root: string): Promise<CheckResult> {
  const workspaces = await listWorkspaces(root);
  const violations: Violation[] = [];
  const scanned: string[] = [];
  const missingRole: string[] = [];

  for (const wsPath of workspaces) {
    const pkg = await readPackageJson(wsPath);
    if (!pkg) continue;

    const name = pkg.name ?? wsPath;
    scanned.push(name);

    const role = pkg.donaoferta?.role;
    if (!isRole(role)) {
      missingRole.push(name);
      continue;
    }

    const allDeps = depsOf(pkg);
    for (const depName of Object.keys(allDeps)) {
      const reason = violationReason(role, depName);
      if (reason !== null) {
        violations.push({
          packagePath: wsPath,
          packageName: name,
          role,
          dependency: depName,
          reason,
        });
      }
    }
  }

  return { violations, scanned, missingRole };
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
  const result = await checkDependencies(root);

  if (result.missingRole.length > 0) {
    process.stderr.write(
      `check-deps: missing "donaoferta.role" in ${result.missingRole.length} package(s):\n`,
    );
    for (const name of result.missingRole) process.stderr.write(`  - ${name}\n`);
    return 2;
  }

  if (result.violations.length === 0) {
    process.stdout.write(
      `check-deps: ${result.scanned.length} workspace(s) scanned, no violations.\n`,
    );
    return 0;
  }

  process.stderr.write(`check-deps: ${result.violations.length} violation(s) found:\n`);
  for (const v of result.violations) {
    process.stderr.write(
      `  - ${v.packageName} (role: ${v.role}) → "${v.dependency}": ${v.reason}\n`,
    );
  }
  return 1;
}

const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  runCli(process.argv.slice(2)).then((code) => process.exit(code));
}
