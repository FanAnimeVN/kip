import fs from "node:fs";
import path from "node:path";
import { classifyPackage, findLib, termMatchesPackage, type Category } from "./categories.js";
import { activeDecisions, diffDecisionTitles, parseDecisions, DECISIONS_FILE, type Decision } from "./decisions.js";
import {
  LOCKFILES,
  WORKTREE,
  depName,
  isLockfile,
  manifestEcosystem,
  setDiff,
  snapshotDeps,
  type DepKey,
  type DepSnapshot,
} from "./deps.js";
import {
  countRange,
  diffChanges,
  logRange,
  mergeBase,
  resolveRef,
  showFile,
  type Commit,
  type FileChange,
} from "./git.js";

export type Severity = "warn" | "info";

export type Signal =
  | { kind: "decision-violation"; severity: "warn"; pkg: string; decision: string; expected?: string }
  | { kind: "dep-conflict"; severity: Severity; category: Category; mine: string; theirs: string[]; pkg: string }
  | { kind: "parallel"; severity: "warn"; topic: string; mine: string[]; theirs: string[]; authors: string[] }
  | { kind: "overlap"; severity: "warn"; files: { path: string; authors: string[] }[] }
  | { kind: "lockfile"; severity: "warn"; mine: string; theirs: string[] }
  | { kind: "ecosystem"; severity: "info"; ecosystem: string; manifest: string }
  | { kind: "schema"; severity: Severity; mine: string[]; theirs: string[] }
  | { kind: "decisions-changed"; severity: "info"; added: Decision[]; retired: Decision[] }
  | { kind: "stale"; severity: Severity; behind: number; days: number };

export interface Analysis {
  baseRef: string;
  baseSha: string;
  headRef: string;
  headSha: string | null;
  mergeBase: string | null;
  behind: number;
  ahead: number;
  /** Commits on the team line that the head does not have (newest first). */
  missing: Commit[];
  mine: FileChange[];
  theirs: FileChange[];
  myAddedDeps: DepKey[];
  myRemovedDeps: DepKey[];
  signals: Signal[];
}

/** Files every kip install regenerates — never a meaningful conflict. */
const GENERATED = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  "GEMINI.md",
  ".github/copilot-instructions.md",
  ".cursor/rules/kip.mdc",
  ".claude/settings.json",
]);

export function isNoise(file: string): boolean {
  return (
    GENERATED.has(file) ||
    file.startsWith(".kip/") ||
    isLockfile(file) ||
    manifestEcosystem(file) !== null ||
    /(^|\/)(node_modules|dist|build|\.next|__pycache__)\//.test(file)
  );
}

const SCHEMA_RE = [
  /(^|\/)schema\.prisma$/,
  /(^|\/)migrations?\//,
  /\.sql$/,
  /(^|\/)models?\.py$/,
  /(^|\/)schema\.(ts|js|graphql|gql)$/,
  /\.graphql$/,
  /(^|\/)drizzle\//,
  /(^|\/)firestore\.rules$/,
];
export const isSchemaFile = (file: string) => SCHEMA_RE.some((re) => re.test(file));

const STOP = new Set(
  (
    "src lib libs app apps packages package components component pages page utils util helpers helper common shared " +
    "index main test tests spec specs public static assets asset styles style css scss less js ts tsx jsx mjs cjs py go rs java kt " +
    "md json yaml yml html vue svelte api apis routes route router routers controllers controller services service models model " +
    "views view hooks hook types type typings config configs server client frontend backend core features feature modules module " +
    "internal pkg cmd docs doc scripts script new old the and for with data store stores screens screen layout layouts ui " +
    "kip readme handlers handler middleware middlewares schemas schema migrations migration prisma test_ __tests__ mocks fixtures " +
    "default base item items list form forms button buttons modal card cards context provider providers"
  ).split(" "),
);

/** Topic words of a path: `src/features/auth/LoginForm.tsx` → auth, login. */
export function topics(file: string): string[] {
  const parts = file
    .replace(/\.[^./]+$/, "")
    .split(/[\\/._\-\s]+/)
    .flatMap((p) => p.split(/(?<=[a-z0-9])(?=[A-Z])/))
    .map((p) => p.toLowerCase())
    .filter((p) => p.length >= 3 && !/^\d+$/.test(p));
  const out = new Set<string>();
  for (let w of parts) {
    if (w.length > 4 && w.endsWith("s") && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
    if (!STOP.has(w)) out.add(w);
  }
  return [...out];
}

function authorsByFile(commits: Commit[]): Map<string, string[]> {
  const map = new Map<string, Set<string>>();
  for (const c of commits) {
    for (const f of c.files) {
      if (!map.has(f)) map.set(f, new Set());
      map.get(f)!.add(c.author);
    }
  }
  return new Map([...map].map(([k, v]) => [k, [...v]]));
}

function libLabel(key: DepKey): string {
  return classifyPackage(key)?.lib.label ?? depName(key);
}

function libsInCategory(snapshot: DepSnapshot, category: Category, ecosystem: string): Map<string, string> {
  const found = new Map<string, string>(); // lib id -> label
  for (const key of snapshot.deps) {
    if (!key.startsWith(ecosystem + ":")) continue;
    const m = classifyPackage(key);
    if (m && m.category.id === category.id) found.set(m.lib.id, m.lib.label);
  }
  return found;
}

export interface AnalyzeOptions {
  /** Team line, e.g. origin/main */
  baseRef: string;
  /** Your side: a ref, or WORKTREE (default) for "my current work incl. uncommitted changes". */
  headRef?: string;
  /** Days behind before "stale" becomes a warning. */
  staleDays?: number;
}

export function analyze(cwd: string, opts: AnalyzeOptions): Analysis {
  const headRef = opts.headRef ?? WORKTREE;
  const baseSha = resolveRef(cwd, opts.baseRef);
  if (!baseSha) throw new Error(`Unknown base ref: ${opts.baseRef}`);
  const headSha = resolveRef(cwd, headRef === WORKTREE ? "HEAD" : headRef);
  const mb = headSha ? mergeBase(cwd, headSha, baseSha) : null;

  const result: Analysis = {
    baseRef: opts.baseRef,
    baseSha,
    headRef,
    headSha,
    mergeBase: mb,
    behind: 0,
    ahead: 0,
    missing: [],
    mine: [],
    theirs: [],
    myAddedDeps: [],
    myRemovedDeps: [],
    signals: [],
  };
  if (!headSha || !mb) return result;

  result.behind = countRange(cwd, `${headSha}..${baseSha}`);
  result.ahead = countRange(cwd, `${baseSha}..${headSha}`);
  result.missing = logRange(cwd, `${headSha}..${baseSha}`, 100);
  result.mine = headRef === WORKTREE ? diffChanges(cwd, mb) : diffChanges(cwd, mb, headSha);
  result.theirs = diffChanges(cwd, mb, baseSha);

  const theirCommits = logRange(cwd, `${mb}..${baseSha}`, 500);
  const fileAuthors = authorsByFile(theirCommits);
  const signals: Signal[] = [];

  // --- Dependencies & decisions --------------------------------------------------
  const before = snapshotDeps(cwd, mb);
  const baseSnap = snapshotDeps(cwd, baseSha);
  const headSnap = snapshotDeps(cwd, headRef === WORKTREE ? WORKTREE : headSha);
  result.myAddedDeps = setDiff(headSnap.deps, before.deps);
  result.myRemovedDeps = setDiff(before.deps, headSnap.deps);

  // Decisions as the team currently has them (base), plus any I added on my side.
  const decisions = activeDecisions([
    ...parseDecisions(showFile(cwd, baseSha, DECISIONS_FILE) ?? ""),
    ...parseDecisions(
      headRef === WORKTREE ? readWorktree(cwd, DECISIONS_FILE) : (showFile(cwd, headSha, DECISIONS_FILE) ?? ""),
    ),
  ]);

  const violated = new Set<DepKey>();
  for (const key of result.myAddedDeps) {
    const mine = classifyPackage(key);
    for (const d of decisions) {
      const avoided = d.avoid.find((term) => termMatchesPackage(term, key));
      if (avoided) {
        signals.push({ kind: "decision-violation", severity: "warn", pkg: depName(key), decision: d.title });
        violated.add(key);
        break;
      }
      if (mine) {
        const preferred = d.use
          .map((term) => findLib(term))
          .find((m) => m && m.category.id === mine.category.id && m.lib.id !== mine.lib.id);
        if (preferred) {
          signals.push({
            kind: "decision-violation",
            severity: "warn",
            pkg: depName(key),
            decision: d.title,
            expected: preferred.lib.label,
          });
          violated.add(key);
          break;
        }
      }
    }
  }

  for (const key of result.myAddedDeps) {
    if (violated.has(key)) continue;
    const mine = classifyPackage(key);
    if (!mine) continue;
    const eco = key.slice(0, key.indexOf(":"));
    const teamLibs = libsInCategory(baseSnap, mine.category, eco);
    teamLibs.delete(mine.lib.id);
    if (teamLibs.size === 0) continue;
    signals.push({
      kind: "dep-conflict",
      severity: mine.category.soft ? "info" : "warn",
      category: mine.category,
      pkg: depName(key),
      mine: mine.lib.label,
      theirs: [...teamLibs.values()],
    });
  }

  // Package manager: I added a lockfile from a different tool than the team uses.
  const myNewLocks = result.mine
    .filter((c) => c.status === "A" && path.posix.basename(c.path) in LOCKFILES)
    .map((c) => LOCKFILES[path.posix.basename(c.path)]!);
  const teamPMs = new Set([...baseSnap.lockfiles].map((f) => LOCKFILES[f]!));
  for (const pm of new Set(myNewLocks)) {
    const others = [...teamPMs].filter((p) => p !== pm);
    if (others.length && !teamPMs.has(pm)) signals.push({ kind: "lockfile", severity: "warn", mine: pm, theirs: others });
  }

  // New language/ecosystem introduced on my side only.
  for (const c of result.mine) {
    if (c.status !== "A") continue;
    const eco = manifestEcosystem(c.path);
    if (eco && !baseSnap.ecosystems.has(eco) && !before.ecosystems.has(eco) && baseSnap.ecosystems.size > 0) {
      signals.push({ kind: "ecosystem", severity: "info", ecosystem: eco, manifest: c.path });
    }
  }

  // --- Files ----------------------------------------------------------------------
  const myPaths = new Set(result.mine.filter((c) => !isNoise(c.path)).map((c) => c.path));
  const overlap = result.theirs
    .filter((c) => myPaths.has(c.path))
    .map((c) => ({ path: c.path, authors: fileAuthors.get(c.path) ?? [] }));
  if (overlap.length) signals.push({ kind: "overlap", severity: "warn", files: overlap });

  // Same topic, different new files: likely two people building the same thing twice.
  const myAdded = result.mine.filter((c) => c.status === "A" && !isNoise(c.path)).map((c) => c.path);
  const theirAdded = result.theirs.filter((c) => c.status === "A" && !isNoise(c.path)).map((c) => c.path);
  const theirTopic = new Map<string, string[]>();
  for (const f of theirAdded) for (const t of topics(f)) theirTopic.set(t, [...(theirTopic.get(t) ?? []), f]);
  const myTopic = new Map<string, string[]>();
  for (const f of myAdded) for (const t of topics(f)) myTopic.set(t, [...(myTopic.get(t) ?? []), f]);
  const parallel: Signal[] = [];
  const seenPairs = new Set<string>();
  for (const [topic, mine] of myTopic) {
    const theirs = theirTopic.get(topic);
    if (!theirs) continue;
    const pairKey = [...mine].sort().join("|") + "#" + [...theirs].sort().join("|");
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);
    const authors = [...new Set(theirs.flatMap((f) => fileAuthors.get(f) ?? []))];
    parallel.push({ kind: "parallel", severity: "warn", topic, mine: mine.slice(0, 3), theirs: theirs.slice(0, 3), authors });
  }
  signals.push(...parallel.slice(0, 3));

  // Schema / data model
  const mySchema = result.mine.filter((c) => isSchemaFile(c.path)).map((c) => c.path);
  const theirSchema = result.theirs.filter((c) => isSchemaFile(c.path)).map((c) => c.path);
  if (theirSchema.length) {
    signals.push({ kind: "schema", severity: mySchema.length ? "warn" : "info", mine: mySchema, theirs: theirSchema });
  }

  // Decisions changed on the team line since I branched.
  const decisionDiff = diffDecisionTitles(showFile(cwd, mb, DECISIONS_FILE), showFile(cwd, baseSha, DECISIONS_FILE));
  if (decisionDiff.added.length || decisionDiff.retired.length) {
    signals.push({ kind: "decisions-changed", severity: "info", ...decisionDiff });
  }

  // How far behind am I?
  if (result.behind > 0) {
    const oldest = result.missing[result.missing.length - 1];
    const days = oldest ? Math.floor((Date.now() / 1000 - oldest.time) / 86400) : 0;
    const warn = days >= (opts.staleDays ?? 2) || result.behind >= 15;
    signals.push({ kind: "stale", severity: warn ? "warn" : "info", behind: result.behind, days });
  }

  const order: Signal["kind"][] = [
    "decision-violation",
    "dep-conflict",
    "parallel",
    "lockfile",
    "overlap",
    "schema",
    "ecosystem",
    "decisions-changed",
    "stale",
  ];
  signals.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "warn" ? -1 : 1) || order.indexOf(a.kind) - order.indexOf(b.kind));
  result.signals = signals;
  return result;
}

function readWorktree(cwd: string, file: string): string {
  try {
    return fs.readFileSync(path.join(cwd, file), "utf8");
  } catch {
    return "";
  }
}

