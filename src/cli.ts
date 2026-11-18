#!/usr/bin/env node
import fs from "node:fs";
import { parseArgs } from "node:util";
import { analyze } from "./analyze.js";
import { briefJson, computeBrief, renderBrief, signalJson } from "./brief.js";
import { AGENT_TARGETS, BIN_NAME, hasConfig, loadConfig, type AgentTarget, type KipConfig } from "./config.js";
import { createDemoTeam } from "./demo.js";
import { detectBase, fetchRemote, repoRoot } from "./git.js";
import { messages, type Lang, type Messages } from "./i18n.js";
import { syncInstructions, type SyncResult } from "./instructions.js";
import { notify, notifyTargets } from "./notify.js";
import { c, signalsText } from "./render.js";
import { runDecide, runInit, suggestDecisions } from "./setup.js";
import { appendDecisions } from "./decisions.js";
import { WORKTREE } from "./deps.js";
import { buildSummary } from "./summary.js";

const VERSION = (() => {
  try {
    const pkg = JSON.parse(fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { version: string };
    return pkg.version;
  } catch {
    return "0.0.0";
  }
})();

const HELP = `${BIN_NAME} ${VERSION} — keep your team (and every teammate's AI agent) on the same page

Usage: ${BIN_NAME} <command> [options]

Commands
  init                 Set up kip in this repo: .kip/, agent instruction files, Claude Code hook
  brief                What did the team change since you last looked? + divergence warnings
  check                Is my current work heading a different way from the team?
  summary              Plain-language summary of a branch/PR (for PR comments and team chat)
  decide "<title>"     Record a team decision (and update every agent's instructions)
  suggest              Suggest decisions from the libraries the project already uses
  sync                 Regenerate agent instruction files from .kip/decisions.md
  demo                 Run a 30-second demo in a temporary folder

Options
  --base <ref>         Team main line (default: auto, e.g. origin/main)
  --lang vi|en         Output language (default: .kip/config.json, then $LANG)
  --json               Machine-readable output (brief, check)
  --no-fetch           Don't fetch from the remote first (brief)
  --peek               Don't mark news as seen (brief)
  --hook               Output for an agent's session-start hook (brief; never fails)
  --strict             Exit 1 if there are warnings (check, summary) — for CI
  --head <ref>         Your side for summary (default: HEAD)
  --format md|text     Summary format (default: md)
  --notify             Also post the summary to $KIP_DISCORD_WEBHOOK / $KIP_SLACK_WEBHOOK
  --why/--use/--avoid  Details for decide (use/avoid are comma-separated)
  --agents <list>      init: ${AGENT_TARGETS.join(",")} (default: all)
  --no-hook            init: don't add the Claude Code SessionStart hook
  --no-suggest         init: don't auto-detect decisions from dependencies
  --write              suggest: append suggestions to .kip/decisions.md
  -v, --version        Print version
  -h, --help           Show this help

Docs: https://github.com/tiou/kip`;

function fail(msg: string, code = 2): never {
  process.stderr.write(`${BIN_NAME}: ${msg}\n`);
  process.exit(code);
}

function printFiles(files: SyncResult[], m: Messages): void {
  for (const f of files) {
    const label = f.result === "created" ? c.green(m.created) : f.result === "updated" ? c.cyan(m.updated) : c.dim(f.result === "skipped" ? "skipped" : m.unchanged);
    console.log(`  ${label.padEnd(12)} ${f.file}`);
  }
}

const csv = (v: unknown) =>
  typeof v === "string"
    ? v
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    : undefined;

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      base: { type: "string" },
      head: { type: "string" },
      lang: { type: "string" },
      json: { type: "boolean" },
      "no-fetch": { type: "boolean" },
      peek: { type: "boolean" },
      hook: { type: "boolean" },
      strict: { type: "boolean" },
      format: { type: "string" },
      notify: { type: "boolean" },
      why: { type: "string" },
      use: { type: "string" },
      avoid: { type: "string" },
      agents: { type: "string" },
      command: { type: "string" },
      "no-hook": { type: "boolean" },
      "no-suggest": { type: "boolean" },
      write: { type: "boolean" },
      version: { type: "boolean", short: "v" },
      help: { type: "boolean", short: "h" },
    },
  });
  const [command, ...rest] = positionals;
  if (values.version) {
    console.log(VERSION);
    return 0;
  }
  if (values.help || !command || command === "help") {
    console.log(HELP);
    return 0;
  }
  const langFlag = values.lang === "vi" || values.lang === "en" ? (values.lang as Lang) : undefined;

  if (command === "demo") return runDemo(langFlag ?? loadConfig(process.cwd()).lang);

  // Hook mode must never break the agent's session start.
  if (command === "brief" && values.hook) {
    try {
      return await runCommand(command, rest, values, langFlag);
    } catch {
      return 0;
    }
  }
  return runCommand(command, rest, values, langFlag);
}

type Values = Record<string, string | boolean | undefined>;

async function runCommand(command: string, rest: string[], values: Values, langFlag?: Lang): Promise<number> {
  const root = repoRoot(process.cwd());
  const config: KipConfig = root ? loadConfig(root) : loadConfig(process.cwd());
  if (langFlag) config.lang = langFlag;
  const m = messages(config.lang);
  if (!root) {
    if (values.hook) return 0;
    fail(m.notRepo);
  }

  const resolveBase = (): string => {
    const base = detectBase(root, (values.base as string | undefined) ?? config.base, config.remote);
    if (!base) {
      if (values.hook) process.exit(0);
      fail(m.noBase);
    }
    return base;
  };

  switch (command) {
    case "init": {
      const agents = csv(values.agents)?.filter((a): a is AgentTarget => (AGENT_TARGETS as readonly string[]).includes(a));
      const res = runInit({
        root,
        lang: langFlag,
        agents,
        command: values.command as string | undefined,
        hook: values["no-hook"] ? false : undefined,
        suggest: values["no-suggest"] ? false : undefined,
        base: values.base as string | undefined,
      });
      const mm = messages(res.config.lang);
      console.log(c.bold(`kip · ${mm.initDone}`) + "\n");
      printFiles(res.files, mm);
      if (res.suggested.length) {
        console.log("\n" + mm.detected(res.suggested.length));
        for (const s of res.suggested) console.log(`  + ${s.title}`);
      }
      console.log("\n" + c.bold(mm.nextSteps));
      mm.initNext.forEach((step, i) => console.log(`  ${i + 1}. ${step}`));
      return 0;
    }

    case "brief": {
      const baseRef = resolveBase();
      const fetch = !values["no-fetch"];
      let result;
      try {
        result = computeBrief({ root, config, baseRef, fetch, peek: !!values.peek, hook: !!values.hook });
      } catch (e) {
        if ((e as Error).message === "no-commits") {
          if (values.hook) return 0;
          fail(m.noCommits);
        }
        throw e;
      }
      if (values.json) console.log(JSON.stringify(briefJson(result), null, 2));
      else console.log(renderBrief(result, config, !!values.hook));
      return 0;
    }

    case "check": {
      const baseRef = resolveBase();
      if (!values["no-fetch"]) fetchRemote(root, config.remote);
      const a = analyze(root, { baseRef });
      const warnings = a.signals.filter((s) => s.severity === "warn").length;
      if (values.json) {
        console.log(JSON.stringify({ base: baseRef, behind: a.behind, ahead: a.ahead, warnings, signals: a.signals.map(signalJson) }, null, 2));
      } else {
        console.log(c.bold(`kip check · ${baseRef}`) + "\n");
        console.log(signalsText(a.signals, m, baseRef).join("\n"));
      }
      return values.strict && warnings ? 1 : 0;
    }

    case "summary": {
      const baseRef = resolveBase();
      const headRef = (values.head as string | undefined) ?? "HEAD";
      const s = buildSummary({ root, config, baseRef, headRef });
      console.log(values.format === "text" ? s.text : s.markdown);
      if (values.notify) {
        const targets = notifyTargets();
        for (const t of targets) {
          try {
            await notify(t, s.text);
            process.stderr.write(m.notifySent(t.name) + "\n");
          } catch (e) {
            process.stderr.write(m.notifyFailed(t.name, (e as Error).message) + "\n");
          }
        }
      }
      return values.strict && s.warnings ? 1 : 0;
    }

    case "decide": {
      const title = rest.join(" ").trim();
      if (!title) fail('usage: kip decide "<title>" [--why ...] [--use a,b] [--avoid c,d]');
      if (!hasConfig(root)) runInit({ root, lang: config.lang, suggest: false });
      const files = runDecide(root, config, {
        title,
        why: values.why as string | undefined,
        use: csv(values.use),
        avoid: csv(values.avoid),
      });
      console.log(c.green(m.decided(title)));
      printFiles(files.filter((f) => f.result !== "unchanged"), m);
      console.log(c.dim(m.decideNext));
      return 0;
    }

    case "suggest": {
      const teamLine = detectBase(root, (values.base as string | undefined) ?? config.base, config.remote);
      const suggestions = suggestDecisions(root, config, teamLine ?? WORKTREE);
      if (!suggestions.length) {
        console.log(m.noSuggestions);
        return 0;
      }
      console.log(c.bold(m.suggestions));
      for (const s of suggestions) console.log(`  + ${s.title}  ${c.dim(`(use: ${s.use?.join(", ")}; avoid: ${s.avoid?.join(", ")})`)}`);
      if (values.write) {
        appendDecisions(root, suggestions, config.lang);
        printFiles(syncInstructions(root, config).filter((f) => f.result !== "unchanged"), m);
      } else console.log(c.dim(m.suggestWriteHint));
      return 0;
    }

    case "sync": {
      console.log(m.synced);
      printFiles(syncInstructions(root, config), m);
      return 0;
    }

    default:
      fail(`unknown command "${command}". Run \`${BIN_NAME} --help\`.`);
  }
}

function runDemo(lang: Lang): number {
  const vi = lang === "vi";
  const team = createDemoTeam(lang);
  const config: KipConfig = { ...loadConfig(team.you), lang };
  const say = (s: string) => console.log(c.cyan(s));
  say(
    vi
      ? "Câu chuyện: bạn làm phần login một mình 4 ngày. Trong lúc đó Alice đã chốt Prisma + Postgres và làm login theo cách khác."
      : "The story: you built login on your own for 4 days. Meanwhile Alice settled on Prisma + Postgres and built login a different way.",
  );
  say(vi ? `Repo demo: ${team.you}\n` : `Demo repo: ${team.you}\n`);
  say(vi ? "$ kip brief   (agent của bạn tự chạy lệnh này khi mở phiên mới)\n" : "$ kip brief   (your agent runs this when a session starts)\n");
  const result = computeBrief({ root: team.you, config, baseRef: "origin/main", fetch: false });
  console.log(renderBrief(result, config));
  console.log("");
  say(
    vi
      ? "→ Không có kip, bạn chỉ phát hiện điều này lúc merge — sau 4 ngày công. Có kip, bạn biết ngay từ phiên làm việc tiếp theo."
      : "→ Without kip you'd find out at merge time, four days of work later. With kip you find out at your next session.",
  );
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err: unknown) => {
    process.stderr.write(`${BIN_NAME}: ${(err as Error).message}\n`);
    process.exit(1);
  },
);
