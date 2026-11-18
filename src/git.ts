import { spawnSync } from "node:child_process";
import path from "node:path";

/** A failed git command. */
export class GitError extends Error {}

export interface GitOptions {
  /** Return null instead of throwing when git exits non-zero. */
  allowFail?: boolean;
  timeoutMs?: number;
}

/** Run git and return stdout. Non-ASCII paths are kept readable (core.quotePath=false). */
export function git(cwd: string, args: string[], opts: GitOptions & { allowFail: true }): string | null;
export function git(cwd: string, args: string[], opts?: GitOptions): string;
export function git(cwd: string, args: string[], opts: GitOptions = {}): string | null {
  const res = spawnSync("git", ["-c", "core.quotePath=false", ...args], {
    cwd,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    timeout: opts.timeoutMs,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  if (res.error || res.status !== 0) {
    if (opts.allowFail) return null;
    const why = res.error?.message ?? res.stderr?.trim() ?? `exit ${res.status}`;
    throw new GitError(`git ${args.join(" ")}: ${why}`);
  }
  return res.stdout;
}

export function repoRoot(cwd: string): string | null {
  const out = git(cwd, ["rev-parse", "--show-toplevel"], { allowFail: true });
  return out ? out.trim() : null;
}

/** The shared .git directory (works inside worktrees too). */
export function gitCommonDir(cwd: string): string {
  const out = git(cwd, ["rev-parse", "--git-common-dir"]).trim();
  return path.isAbsolute(out) ? out : path.resolve(cwd, out);
}

export function resolveRef(cwd: string, ref: string): string | null {
  const out = git(cwd, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { allowFail: true });
  return out ? out.trim() : null;
}

/** Pick the team's main line: configured ref, then origin/HEAD, then the usual names. */
export function detectBase(cwd: string, configured?: string, remote = "origin"): string | null {
  if (configured && resolveRef(cwd, configured)) return configured;
  const sym = git(cwd, ["symbolic-ref", "--quiet", `refs/remotes/${remote}/HEAD`], { allowFail: true });
  if (sym) {
    const ref = sym.trim().replace(/^refs\/remotes\//, "");
    if (resolveRef(cwd, ref)) return ref;
  }
  for (const ref of [`${remote}/main`, `${remote}/master`, `${remote}/develop`, "main", "master"]) {
    if (resolveRef(cwd, ref)) return ref;
  }
  return null;
}

/** Best-effort fetch; never throws (offline is fine). */
export function fetchRemote(cwd: string, remote = "origin", timeoutMs = 15000): boolean {
  const hasRemote = git(cwd, ["remote"], { allowFail: true })?.split("\n").includes(remote);
  if (!hasRemote) return false;
  return git(cwd, ["fetch", "--quiet", "--no-tags", remote], { allowFail: true, timeoutMs }) !== null;
}

export function mergeBase(cwd: string, a: string, b: string): string | null {
  const out = git(cwd, ["merge-base", a, b], { allowFail: true });
  return out ? out.trim() : null;
}

export function isAncestor(cwd: string, a: string, b: string): boolean {
  return git(cwd, ["merge-base", "--is-ancestor", a, b], { allowFail: true }) !== null;
}

export function countRange(cwd: string, range: string): number {
  const out = git(cwd, ["rev-list", "--count", range], { allowFail: true });
  return out ? Number.parseInt(out.trim(), 10) || 0 : 0;
}

export interface Commit {
  sha: string;
  author: string;
  email: string;
  /** Unix seconds */
  time: number;
  subject: string;
  files: string[];
}

const REC = "@@kip-commit@@";

/** Non-merge commits in a range, newest first, with the files each touched. */
export function logRange(cwd: string, range: string, max = 200): Commit[] {
  const out = git(
    cwd,
    ["log", "--no-merges", `--max-count=${max}`, `--format=${REC}%H%x1f%an%x1f%ae%x1f%at%x1f%s`, "--name-only", range],
    { allowFail: true },
  );
  if (!out) return [];
  const commits: Commit[] = [];
  for (const chunk of out.split(REC)) {
    if (!chunk.trim()) continue;
    const [header = "", ...rest] = chunk.split("\n");
    const [sha = "", author = "", email = "", time = "0", subject = ""] = header.split("\x1f");
    commits.push({
      sha,
      author,
      email,
      time: Number.parseInt(time, 10) || 0,
      subject,
      files: rest.map((l) => l.trim()).filter(Boolean),
    });
  }
  return commits;
}

export type ChangeStatus = "A" | "M" | "D" | "R";

export interface FileChange {
  status: ChangeStatus;
  path: string;
  oldPath?: string;
}

function parseNameStatus(out: string): FileChange[] {
  const changes: FileChange[] = [];
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    const code = (parts[0] ?? "").charAt(0);
    if (code === "R" || code === "C") {
      changes.push({ status: code === "R" ? "R" : "A", oldPath: parts[1], path: parts[2] ?? parts[1] ?? "" });
    } else if (code === "A" || code === "M" || code === "D") {
      changes.push({ status: code, path: parts[1] ?? "" });
    } else if (code === "T") {
      changes.push({ status: "M", path: parts[1] ?? "" });
    }
  }
  return changes;
}

/** Changes from `from` to `to`; if `to` is omitted, compares against the working tree (incl. untracked files). */
export function diffChanges(cwd: string, from: string, to?: string): FileChange[] {
  const args = ["diff", "--name-status", "-M", from];
  if (to) args.push(to);
  const changes = parseNameStatus(git(cwd, args, { allowFail: true }) ?? "");
  if (!to) {
    const untracked = git(cwd, ["ls-files", "--others", "--exclude-standard"], { allowFail: true }) ?? "";
    for (const p of untracked.split("\n")) {
      if (p.trim()) changes.push({ status: "A", path: p.trim() });
    }
  }
  return changes;
}

export function showFile(cwd: string, rev: string, file: string): string | null {
  return git(cwd, ["show", `${rev}:${file}`], { allowFail: true });
}

export function listFilesAt(cwd: string, rev: string): string[] {
  const out = git(cwd, ["ls-tree", "-r", "--name-only", rev], { allowFail: true }) ?? "";
  return out.split("\n").filter(Boolean);
}

export function listWorktreeFiles(cwd: string): string[] {
  const out = git(cwd, ["ls-files", "--cached", "--others", "--exclude-standard"], { allowFail: true }) ?? "";
  return [...new Set(out.split("\n").filter(Boolean))];
}

export function configValue(cwd: string, key: string): string | null {
  const out = git(cwd, ["config", "--get", key], { allowFail: true });
  return out ? out.trim() : null;
}
