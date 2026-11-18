import { analyze, isNoise, isSchemaFile } from "./analyze.js";
import type { KipConfig } from "./config.js";
import { DECISIONS_FILE, diffDecisionTitles } from "./decisions.js";
import { depName } from "./deps.js";
import { logRange, showFile } from "./git.js";
import { messages } from "./i18n.js";
import { areas, describeSignals, groupByAuthor, signalsMarkdown } from "./render.js";

export const SUMMARY_MARKER = "<!-- kip-summary -->";

export interface SummaryOptions {
  root: string;
  config: KipConfig;
  baseRef: string;
  headRef: string;
}

/** A plain-language summary of a branch/PR plus divergence signals — for PR comments and team chat. */
export function buildSummary(opts: SummaryOptions): { markdown: string; text: string; warnings: number } {
  const { root, config, baseRef, headRef } = opts;
  const m = messages(config.lang);
  const a = analyze(root, { baseRef, headRef });
  const commits = logRange(root, `${a.baseSha}..${a.headSha ?? headRef}`, 200);
  const authors = groupByAuthor(commits).map((g) => g.author);
  const files = a.mine.map((ch) => ch.path);
  const meaningful = files.filter((f) => !isNoise(f));
  const schema = files.filter(isSchemaFile);
  const decisions = a.mergeBase
    ? diffDecisionTitles(showFile(root, a.mergeBase, DECISIONS_FILE), a.headSha ? showFile(root, a.headSha, DECISIONS_FILE) : null)
    : { added: [], retired: [] };
  const signals = a.signals.filter((s) => s.kind !== "decisions-changed");
  const warnings = signals.filter((s) => s.severity === "warn").length;

  const md: string[] = [SUMMARY_MARKER, `### ${m.summaryTitle}`, ""];
  md.push(m.summaryBy(commits.length, authors.length ? authors : ["?"], files.length), "");
  if (commits.length) {
    for (const cm of commits.slice(0, 10)) md.push(`- ${cm.subject} — _${cm.author}_`);
    if (commits.length > 10) md.push(`- ${m.moreCommits(commits.length - 10)}`);
    md.push("");
  }
  const areaList = areas(meaningful, 6);
  if (areaList.length) md.push(`**${m.summaryAreas}:** ${areaList.map((x) => `\`${x}\``).join(", ")}`);
  if (a.myAddedDeps.length || a.myRemovedDeps.length) {
    const parts = [...a.myAddedDeps.map((d) => `+ \`${depName(d)}\``), ...a.myRemovedDeps.map((d) => `− \`${depName(d)}\``)];
    md.push(`**${m.depsLine}:** ${parts.join(" · ")}`);
  }
  if (schema.length) md.push(`**${m.schemaLine}:** ${schema.slice(0, 6).map((x) => `\`${x}\``).join(", ")}`);
  if (decisions.added.length || decisions.retired.length) {
    md.push(`**${m.decisionsLine}:**`);
    for (const d of decisions.added) md.push(`- + ${d.title}`);
    for (const d of decisions.retired) md.push(`- − ${d.title}`);
  }
  md.push("");
  if (signals.length) {
    md.push(`#### ${warnings ? "⚠️ " : ""}${m.summaryDivergence(baseRef)}`, "", ...signalsMarkdown(signals, m));
  } else {
    md.push(m.summaryNoDivergence(baseRef));
  }
  md.push("", `<sub>${m.summaryFooter}</sub>`);

  // Compact plain text for chat webhooks.
  const text: string[] = [`${m.summaryTitle} — ${headRef} → ${baseRef}`];
  text.push(m.summaryBy(commits.length, authors.length ? authors : ["?"], files.length).replace(/\*\*/g, ""));
  for (const cm of commits.slice(0, 5)) text.push(`• ${cm.subject} (${cm.author})`);
  if (areaList.length) text.push(`${m.summaryAreas}: ${areaList.join(", ")}`);
  if (a.myAddedDeps.length) text.push(`${m.depsLine}: ${a.myAddedDeps.map((d) => "+" + depName(d)).join(" ")}`);
  for (const line of describeSignals(signals, m)) text.push(`${line.severity === "warn" ? "⚠" : "ℹ"} ${line.text}`);

  return { markdown: md.join("\n"), text: text.join("\n"), warnings };
}
