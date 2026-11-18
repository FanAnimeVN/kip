import { isNoise, type Signal } from "./analyze.js";
import type { Commit } from "./git.js";
import { ago, type Messages } from "./i18n.js";

const useColor = () => process.stdout.isTTY && !process.env.NO_COLOR && process.env.TERM !== "dumb";
const paint = (code: string, s: string) => (useColor() ? `\x1b[${code}m${s}\x1b[0m` : s);
export const c = {
  bold: (s: string) => paint("1", s),
  dim: (s: string) => paint("2", s),
  yellow: (s: string) => paint("33", s),
  green: (s: string) => paint("32", s),
  cyan: (s: string) => paint("36", s),
};

const WARN = "⚠";
const INFO = "ℹ";

export interface SignalLine {
  severity: Signal["severity"];
  text: string;
  details: string[];
}

/** Turn signals into human sentences (shared by terminal and markdown output). */
export function describeSignals(signals: Signal[], m: Messages): SignalLine[] {
  const out: SignalLine[] = [];
  for (const s of signals) {
    switch (s.kind) {
      case "decision-violation":
        out.push({ severity: s.severity, text: m.violation(s.pkg, s.decision, s.expected), details: [] });
        break;
      case "dep-conflict":
        out.push({ severity: s.severity, text: m.depConflict(s.mine, s.theirs, s.category.label[m.lang]), details: [] });
        break;
      case "parallel": {
        const who = s.authors.length ? m.list(s.authors) : m.team;
        out.push({
          severity: s.severity,
          text: m.parallel(s.topic, who),
          details: [
            ...s.mine.map((f) => `${m.yourFiles}: ${f}`),
            ...s.theirs.map((f) => `${s.authors[0] ?? m.team}: ${f}`),
          ],
        });
        break;
      }
      case "lockfile":
        out.push({ severity: s.severity, text: m.lockfile(s.mine, s.theirs), details: [] });
        break;
      case "ecosystem":
        out.push({ severity: s.severity, text: m.ecosystem(s.ecosystem, s.manifest), details: [] });
        break;
      case "overlap":
        out.push({
          severity: s.severity,
          text: m.overlap(s.files.length),
          details: s.files.slice(0, 8).map((f) => (f.authors.length ? `${f.path} (${f.authors.join(", ")})` : f.path)),
        });
        break;
      case "schema":
        out.push({
          severity: s.severity,
          text: s.mine.length ? m.schemaBoth : m.schemaTheirs,
          details: [...new Set([...s.theirs, ...s.mine])].slice(0, 6),
        });
        break;
      case "decisions-changed":
        out.push({
          severity: s.severity,
          text: m.decisionsChanged,
          details: [...s.added.map((d) => `+ ${d.title}`), ...s.retired.map((d) => `− ${d.title}`)],
        });
        break;
      case "stale":
        out.push({ severity: s.severity, text: m.stale(s.behind, s.days), details: [] });
        break;
    }
  }
  return out;
}

/** Concrete next steps, most important first, no duplicates. */
export function nextSteps(signals: Signal[], m: Messages, baseRef: string): string[] {
  const steps: string[] = [];
  const add = (s: string) => {
    if (!steps.includes(s)) steps.push(s);
  };
  for (const s of signals) {
    if (s.severity !== "warn") continue;
    if (s.kind === "decision-violation" || s.kind === "dep-conflict") add(m.nextViolation);
    if (s.kind === "parallel") add(m.nextParallel(s.authors.length ? m.list(s.authors) : m.team));
    if (s.kind === "lockfile") add(m.nextLockfile(s.theirs[0] ?? ""));
    if (s.kind === "overlap" || s.kind === "stale" || s.kind === "schema") add(m.nextSync(baseRef));
  }
  return steps;
}

export function signalsText(signals: Signal[], m: Messages, baseRef: string, indent = "  "): string[] {
  const lines: string[] = [];
  if (!signals.some((s) => s.severity === "warn") && signals.length === 0) {
    lines.push(indent + c.green(m.allClear));
    return lines;
  }
  for (const line of describeSignals(signals, m)) {
    const icon = line.severity === "warn" ? c.yellow(WARN) : c.cyan(INFO);
    lines.push(`${indent}${icon} ${line.text}`);
    for (const d of line.details) lines.push(`${indent}    ${c.dim(d)}`);
  }
  if (!signals.some((s) => s.severity === "warn")) lines.push(indent + c.green(m.allClear));
  const steps = nextSteps(signals, m, baseRef);
  if (steps.length) {
    lines.push("", indent + c.bold(m.nextTitle));
    for (const s of steps) lines.push(`${indent}→ ${s}`);
  }
  return lines;
}

export function signalsMarkdown(signals: Signal[], m: Messages): string[] {
  return describeSignals(signals, m).flatMap((line) => [
    `- ${line.severity === "warn" ? "⚠️" : "ℹ️"} ${line.text}`,
    ...line.details.map((d) => `  - \`${d}\``),
  ]);
}

/** Top-level areas a set of files lives in: src/features/auth/x.ts → src/features. */
export function areas(files: string[], max = 4): string[] {
  const counts = new Map<string, number>();
  for (const f of files) {
    const parts = f.split("/");
    const area = parts.length > 2 ? parts.slice(0, 2).join("/") : parts.length === 2 ? parts[0]! : f;
    counts.set(area, (counts.get(area) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([a]) => a);
}

export interface AuthorGroup {
  author: string;
  commits: Commit[];
}

export function groupByAuthor(commits: Commit[]): AuthorGroup[] {
  const map = new Map<string, Commit[]>();
  for (const cm of commits) map.set(cm.author, [...(map.get(cm.author) ?? []), cm]);
  return [...map.entries()].map(([author, cs]) => ({ author, commits: cs })).sort((a, b) => b.commits.length - a.commits.length);
}

export function commitGroupsText(commits: Commit[], m: Messages, maxPerAuthor = 5): string[] {
  const lines: string[] = [];
  for (const g of groupByAuthor(commits)) {
    const newest = g.commits[0]!;
    lines.push(`  ${c.bold(g.author)} · ${m.commits(g.commits.length)} · ${ago(newest.time, m.lang)}`);
    for (const cm of g.commits.slice(0, maxPerAuthor)) lines.push(`    • ${cm.subject}`);
    if (g.commits.length > maxPerAuthor) lines.push(`    ${c.dim(m.moreCommits(g.commits.length - maxPerAuthor))}`);
    const a = areas(g.commits.flatMap((cm) => cm.files).filter((f) => !isNoise(f)));
    if (a.length) lines.push(`    ${c.dim(`${m.areas}: ${a.join(", ")}`)}`);
  }
  return lines;
}
