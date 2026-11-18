import { CATEGORIES } from "./categories.js";
import { hasConfig, loadConfig, saveConfig, defaultConfig, type KipConfig } from "./config.js";
import {
  appendDecisions,
  decisionTemplate,
  readDecisions,
  DECISIONS_FILE,
  type NewDecision,
} from "./decisions.js";
import { snapshotDeps, WORKTREE } from "./deps.js";
import { configValue, detectBase } from "./git.js";
import { messages } from "./i18n.js";
import { syncInstructions, type SyncResult } from "./instructions.js";
import fs from "node:fs";
import path from "node:path";

/**
 * Propose decisions from what the project already uses, so nobody has to write docs from scratch.
 * One suggestion per category where the project has exactly one library (per ecosystem).
 */
export function suggestDecisions(root: string, config: KipConfig, rev: string = WORKTREE): NewDecision[] {
  const m = messages(config.lang);
  const snap = snapshotDeps(root, rev);
  const existing = readDecisions(root).filter((d) => d.status !== "superseded");
  const covered = new Set(existing.flatMap((d) => [...d.use, ...d.avoid]).map((t) => t.toLowerCase()));
  const out: NewDecision[] = [];
  for (const category of CATEGORIES) {
    if (category.soft) continue;
    for (const eco of ["npm", "pypi", "go"] as const) {
      const present = category.libs.filter((l) => l.packages.some((p) => p.startsWith(eco + ":") && snap.deps.has(p)));
      if (present.length !== 1) continue;
      const chosen = present[0]!;
      const alternatives = category.libs
        .filter((l) => l.id !== chosen.id && l.packages.some((p) => p.startsWith(eco + ":")))
        .map((l) => l.id);
      if (covered.has(chosen.id) || chosen.packages.some((p) => covered.has(p.slice(p.indexOf(":") + 1)))) continue;
      out.push({
        title: m.useFor(chosen.label, category.label[config.lang]),
        use: [chosen.id],
        avoid: alternatives.slice(0, 4),
        source: m.autoDetected,
      });
    }
  }
  return out;
}

export interface InitOptions {
  root: string;
  lang?: KipConfig["lang"];
  agents?: KipConfig["agents"];
  command?: string;
  hook?: boolean;
  suggest?: boolean;
  base?: string;
}

export interface InitResult {
  config: KipConfig;
  files: SyncResult[];
  suggested: NewDecision[];
}

export function runInit(opts: InitOptions): InitResult {
  const { root } = opts;
  const config = hasConfig(root) ? loadConfig(root) : defaultConfig();
  if (opts.lang) config.lang = opts.lang;
  if (opts.agents?.length) config.agents = opts.agents;
  if (opts.command) config.command = opts.command;
  if (opts.hook === false) config.claudeHook = false;
  if (opts.base) config.base = opts.base;
  const files: SyncResult[] = [];

  const configExisted = hasConfig(root);
  saveConfig(root, config);
  files.push({ file: ".kip/config.json", result: configExisted ? "updated" : "created" });

  const decisionsPath = path.join(root, DECISIONS_FILE);
  if (!fs.existsSync(decisionsPath)) {
    fs.writeFileSync(decisionsPath, decisionTemplate(config.lang));
    files.push({ file: DECISIONS_FILE, result: "created" });
  }

  let suggested: NewDecision[] = [];
  if (opts.suggest !== false) {
    // Detect from the team line, not from a branch that may already have drifted.
    const base = detectBase(root, config.base, config.remote);
    suggested = suggestDecisions(root, config, base ?? WORKTREE);
    if (suggested.length) appendDecisions(root, suggested, config.lang);
  }

  files.push(...syncInstructions(root, config));
  return { config, files, suggested };
}

export function runDecide(
  root: string,
  config: KipConfig,
  d: { title: string; why?: string; use?: string[]; avoid?: string[]; owner?: string },
): SyncResult[] {
  const owner = d.owner ?? configValue(root, "user.name") ?? undefined;
  appendDecisions(root, [{ ...d, owner }], config.lang);
  return syncInstructions(root, config);
}
