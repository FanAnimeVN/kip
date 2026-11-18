import fs from "node:fs";
import path from "node:path";
import type { Ecosystem } from "./categories.js";
import { listFilesAt, listWorktreeFiles, showFile } from "./git.js";

/** A dependency key: `<ecosystem>:<name>`, e.g. `npm:axios`, `pypi:fastapi`, `go:github.com/gin-gonic/gin`. */
export type DepKey = string;

export const WORKTREE = "WORKTREE";

const IGNORED_DIRS = /(^|\/)(node_modules|vendor|\.venv|venv|site-packages|dist|build)\//;

export function manifestEcosystem(file: string): Ecosystem | null {
  if (IGNORED_DIRS.test(file)) return null;
  const base = path.posix.basename(file);
  if (base === "package.json") return "npm";
  if (base === "pyproject.toml" || /^requirements([-_.][\w.-]+)?\.txt$/.test(base)) return "pypi";
  if (base === "go.mod") return "go";
  return null;
}

export const LOCKFILES: Record<string, string> = {
  "package-lock.json": "npm",
  "npm-shrinkwrap.json": "npm",
  "yarn.lock": "yarn",
  "pnpm-lock.yaml": "pnpm",
  "bun.lockb": "bun",
  "bun.lock": "bun",
};

export function isLockfile(file: string): boolean {
  const base = path.posix.basename(file);
  return base in LOCKFILES || ["poetry.lock", "Pipfile.lock", "uv.lock", "go.sum", "Cargo.lock", "composer.lock"].includes(base);
}

const normPy = (name: string) => name.trim().toLowerCase().replace(/[_.]+/g, "-");

export function parsePackageJson(text: string): string[] {
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    const names = new Set<string>();
    for (const field of ["dependencies", "devDependencies", "optionalDependencies"]) {
      const deps = json[field];
      if (deps && typeof deps === "object") for (const name of Object.keys(deps)) names.add(name);
    }
    return [...names];
  } catch {
    return [];
  }
}

export function parseRequirements(text: string): string[] {
  const names: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line || line.startsWith("-")) continue;
    const m = /^([A-Za-z0-9][A-Za-z0-9._-]*)/.exec(line);
    if (m?.[1]) names.push(normPy(m[1]));
  }
  return names;
}

/** Minimal pyproject reader: PEP 621 dependency arrays and Poetry dependency tables. */
export function parsePyproject(text: string): string[] {
  const names = new Set<string>();
  const addSpec = (spec: string) => {
    const n = /^\s*([A-Za-z0-9][A-Za-z0-9._-]*)/.exec(spec);
    if (n?.[1]) names.add(normPy(n[1]));
  };
  const lines = text.split("\n");
  let section = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const s = /^\s*\[([^\]]+)\]\s*$/.exec(line);
    if (s?.[1]) {
      section = s[1].trim();
      continue;
    }
    // Poetry tables: name = "^1.2" / name = { version = ... }
    if (/^tool\.poetry(\.group\.[^.]+)?\.(dev-)?dependencies$/.test(section)) {
      const k = /^\s*([A-Za-z0-9][A-Za-z0-9._-]*)\s*=/.exec(line);
      if (k?.[1] && k[1].toLowerCase() !== "python") addSpec(k[1]);
      continue;
    }
    // PEP 621 / PEP 735 arrays: dependencies = [ "x>=1", "y[extra]" ]
    const arr = /^\s*([\w-]+)\s*=\s*\[(.*)$/.exec(line);
    if (!arr) continue;
    const key = arr[1] ?? "";
    const isDeps =
      (section === "project" && key === "dependencies") ||
      section === "project.optional-dependencies" ||
      section === "dependency-groups";
    if (!isDeps) continue;
    // Scan until the closing bracket outside quotes, possibly across lines.
    let buf = arr[2] ?? "";
    let quote: string | null = null;
    let current = "";
    let done = false;
    for (;;) {
      for (const ch of buf) {
        if (quote) {
          if (ch === quote) {
            addSpec(current);
            current = "";
            quote = null;
          } else current += ch;
        } else if (ch === '"' || ch === "'") quote = ch;
        else if (ch === "]") {
          done = true;
          break;
        }
      }
      if (done || i + 1 >= lines.length) break;
      buf = lines[++i] ?? "";
    }
  }
  return [...names];
}

export function parseGoMod(text: string): string[] {
  const names: string[] = [];
  let inBlock = false;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\/\/.*/, "").trim();
    if (!line) continue;
    if (line.startsWith("require (")) {
      inBlock = true;
      continue;
    }
    if (inBlock && line === ")") {
      inBlock = false;
      continue;
    }
    const m = inBlock ? /^(\S+)\s+\S+/.exec(line) : /^require\s+(\S+)\s+\S+/.exec(line);
    if (m?.[1]) names.push(m[1]);
  }
  return names;
}

export function parseManifest(file: string, text: string): DepKey[] {
  const eco = manifestEcosystem(file);
  if (!eco) return [];
  const base = path.posix.basename(file);
  let names: string[] = [];
  if (base === "package.json") names = parsePackageJson(text);
  else if (base === "pyproject.toml") names = parsePyproject(text);
  else if (base === "go.mod") names = parseGoMod(text);
  else names = parseRequirements(text);
  return names.map((n) => `${eco}:${n}`);
}

export interface DepSnapshot {
  deps: Set<DepKey>;
  /** Which manifest declared each dependency (first seen). */
  where: Map<DepKey, string>;
  ecosystems: Set<Ecosystem>;
  lockfiles: Set<string>;
}

/** All declared dependencies at a revision, or in the working tree when rev === WORKTREE. */
export function snapshotDeps(cwd: string, rev: string): DepSnapshot {
  const files = rev === WORKTREE ? listWorktreeFiles(cwd) : listFilesAt(cwd, rev);
  const snap: DepSnapshot = { deps: new Set(), where: new Map(), ecosystems: new Set(), lockfiles: new Set() };
  for (const file of files) {
    const base = path.posix.basename(file);
    if (base in LOCKFILES && !IGNORED_DIRS.test(file)) snap.lockfiles.add(base);
    const eco = manifestEcosystem(file);
    if (!eco) continue;
    let text: string | null = null;
    if (rev === WORKTREE) {
      try {
        text = fs.readFileSync(path.join(cwd, file), "utf8");
      } catch {
        text = null;
      }
    } else {
      text = showFile(cwd, rev, file);
    }
    if (text === null) continue;
    snap.ecosystems.add(eco);
    for (const key of parseManifest(file, text)) {
      snap.deps.add(key);
      if (!snap.where.has(key)) snap.where.set(key, file);
    }
  }
  return snap;
}

export function setDiff<T>(a: Set<T>, b: Set<T>): T[] {
  return [...a].filter((x) => !b.has(x));
}

export const depName = (key: DepKey) => key.slice(key.indexOf(":") + 1);
