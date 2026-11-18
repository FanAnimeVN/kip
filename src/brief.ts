import { analyze, isSchemaFile, type Analysis } from "./analyze.js";
import { markSeen, readState, type KipConfig } from "./config.js";
import { DECISIONS_FILE, diffDecisionTitles } from "./decisions.js";
import { depName, setDiff, snapshotDeps } from "./deps.js";
import { configValue, fetchRemote, isAncestor, logRange, mergeBase, resolveRef, showFile, type Commit } from "./git.js";
import { messages } from "./i18n.js";
import { c, commitGroupsText, signalsText } from "./render.js";

export interface BriefOptions {
  root: string;
  config: KipConfig;
  baseRef: string;
  fetch?: boolean;
  /** Don't remember that you've seen these commits. */
  peek?: boolean;
  /** Output for an agent's SessionStart hook. */
  hook?: boolean;
}

export interface BriefResult {
  baseRef: string;
  first: boolean;
  news: Commit[];
  depsAdded: string[];
  depsRemoved: string[];
  schemaFiles: string[];
  decisionsAdded: string[];
  decisionsRetired: string[];
  analysis: Analysis;
}

export function computeBrief(opts: BriefOptions): BriefResult {
  const { root, baseRef } = opts;
  if (opts.fetch !== false) fetchRemote(root, opts.config.remote, opts.hook ? 8000 : 20000);
  const baseSha = resolveRef(root, baseRef);
  const headSha = resolveRef(root, "HEAD");
  if (!baseSha || !headSha) throw new Error("no-commits");

  const myEmail = configValue(root, "user.email");
  const lastSeen = readState(root).lastSeen[baseRef];
  let start: string | null;
  let first = false;
  if (lastSeen && resolveRef(root, lastSeen) && isAncestor(root, lastSeen, baseSha)) {
    start = lastSeen;
  } else {
    first = true;
    start = mergeBase(root, headSha, baseSha);
  }

  let news: Commit[] = [];
  if (start && start !== baseSha) {
    const range = first ? `${headSha}..${baseSha}` : `${start}..${baseSha}`;
    news = logRange(root, range, 60).filter((cm) => !myEmail || cm.email !== myEmail);
  }

  let depsAdded: string[] = [];
  let depsRemoved: string[] = [];
  let decisionsAdded: string[] = [];
  let decisionsRetired: string[] = [];
  if (news.length && start) {
    const before = snapshotDeps(root, start);
    const after = snapshotDeps(root, baseSha);
    depsAdded = setDiff(after.deps, before.deps).map(depName);
    depsRemoved = setDiff(before.deps, after.deps).map(depName);
    const d = diffDecisionTitles(showFile(root, start, DECISIONS_FILE), showFile(root, baseSha, DECISIONS_FILE));
    decisionsAdded = d.added.map((x) => x.title);
    decisionsRetired = d.retired.map((x) => x.title);
  }
  const schemaFiles = [...new Set(news.flatMap((cm) => cm.files).filter(isSchemaFile))];

  const analysis = analyze(root, { baseRef });
  if (!opts.peek) markSeen(root, baseRef, baseSha);
  return { baseRef, first, news, depsAdded, depsRemoved, schemaFiles, decisionsAdded, decisionsRetired, analysis };
}

export function renderBrief(r: BriefResult, config: KipConfig, hook = false): string {
  const m = messages(config.lang);
  const lines: string[] = [];
  if (hook) lines.push(m.hookPreamble, "");
  lines.push(c.bold(`kip · ${m.briefTitle(r.baseRef)}`), "");
  if (r.news.length) {
    lines.push(m.newSince(r.news.length, r.first), "");
    lines.push(...commitGroupsText(r.news, m));
    const extra: string[] = [];
    if (r.depsAdded.length || r.depsRemoved.length) {
      const parts = [...r.depsAdded.map((d) => `+ ${d}`), ...r.depsRemoved.map((d) => `− ${d}`)];
      extra.push(`  ${m.depsLine}: ${parts.join("  ")}`);
    }
    if (r.schemaFiles.length) extra.push(`  ${m.schemaLine}: ${r.schemaFiles.slice(0, 5).join(", ")}`);
    if (r.decisionsAdded.length || r.decisionsRetired.length) {
      extra.push(`  ${m.decisionsLine}:`);
      for (const d of r.decisionsAdded) extra.push(`    + ${d}`);
      for (const d of r.decisionsRetired) extra.push(`    − ${d}`);
    }
    if (extra.length) lines.push("", ...extra);
  } else {
    lines.push(c.dim(m.nothingNew));
  }
  // The news section already covers decision and team-only schema changes.
  const signals = r.analysis.signals.filter(
    (s) => s.kind !== "decisions-changed" && !(s.kind === "schema" && s.severity === "info" && r.news.length),
  );
  lines.push("", c.bold(m.youVsTeam), ...signalsText(signals, m, r.baseRef));
  return lines.join("\n");
}

export function briefJson(r: BriefResult) {
  return {
    base: r.baseRef,
    first: r.first,
    news: r.news.map(({ sha, author, time, subject, files }) => ({ sha, author, time, subject, files })),
    dependencies: { added: r.depsAdded, removed: r.depsRemoved },
    schemaFiles: r.schemaFiles,
    decisions: { added: r.decisionsAdded, retired: r.decisionsRetired },
    behind: r.analysis.behind,
    ahead: r.analysis.ahead,
    signals: r.analysis.signals.map(signalJson),
  };
}

export function signalJson(s: Analysis["signals"][number]) {
  if (s.kind === "dep-conflict") return { ...s, category: s.category.id };
  if (s.kind === "decisions-changed")
    return { ...s, added: s.added.map((d) => d.title), retired: s.retired.map((d) => d.title) };
  return s;
}
