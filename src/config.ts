import fs from "node:fs";
import path from "node:path";
import { KIP_DIR } from "./decisions.js";
import { gitCommonDir } from "./git.js";
import { detectLang, type Lang } from "./i18n.js";

export const PACKAGE_NAME = "@tiou/kip";
export const BIN_NAME = "kip";
export const DEFAULT_COMMAND = `npx -y ${PACKAGE_NAME}`;

export const AGENT_TARGETS = ["agents", "claude", "gemini", "copilot", "cursor"] as const;
export type AgentTarget = (typeof AGENT_TARGETS)[number];

export interface KipConfig {
  lang: Lang;
  /** Team main line, e.g. "origin/main". Auto-detected when empty. */
  base?: string;
  remote: string;
  /** Which agent instruction files kip keeps in sync. */
  agents: AgentTarget[];
  /** How agents should invoke kip (kept in generated instructions and hooks). */
  command: string;
  /** Add a Claude Code SessionStart hook that runs `kip brief --hook`. */
  claudeHook: boolean;
}

export const CONFIG_FILE = `${KIP_DIR}/config.json`;

export function defaultConfig(): KipConfig {
  return {
    lang: detectLang(),
    remote: "origin",
    agents: [...AGENT_TARGETS],
    command: DEFAULT_COMMAND,
    claudeHook: true,
  };
}

export function loadConfig(root: string): KipConfig {
  const base = defaultConfig();
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(root, CONFIG_FILE), "utf8")) as Partial<KipConfig>;
    return {
      ...base,
      ...raw,
      agents: Array.isArray(raw.agents)
        ? raw.agents.filter((a): a is AgentTarget => (AGENT_TARGETS as readonly string[]).includes(a))
        : base.agents,
      lang: raw.lang === "vi" || raw.lang === "en" ? raw.lang : base.lang,
    };
  } catch {
    return base;
  }
}

export function hasConfig(root: string): boolean {
  return fs.existsSync(path.join(root, CONFIG_FILE));
}

export function saveConfig(root: string, config: KipConfig): void {
  const file = path.join(root, CONFIG_FILE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const { base, ...rest } = config;
  const out = base ? { ...rest, base } : rest;
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
}

/** Per-person state lives inside .git so it is never committed. */
interface State {
  lastSeen: Record<string, string>;
  updatedAt?: string;
}

function statePath(root: string): string {
  return path.join(gitCommonDir(root), "kip", "state.json");
}

export function readState(root: string): State {
  try {
    const s = JSON.parse(fs.readFileSync(statePath(root), "utf8")) as State;
    return { lastSeen: s.lastSeen ?? {}, updatedAt: s.updatedAt };
  } catch {
    return { lastSeen: {} };
  }
}

export function markSeen(root: string, baseRef: string, sha: string): void {
  const state = readState(root);
  state.lastSeen[baseRef] = sha;
  state.updatedAt = new Date().toISOString();
  const file = statePath(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2) + "\n");
}
