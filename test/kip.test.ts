import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { analyze, topics } from "../src/analyze.js";
import { computeBrief, renderBrief } from "../src/brief.js";
import { classifyPackage, termMatchesPackage } from "../src/categories.js";
import { defaultConfig, type KipConfig } from "../src/config.js";
import { parseDecisions } from "../src/decisions.js";
import { parseGoMod, parsePyproject, parseRequirements } from "../src/deps.js";
import { createDemoTeam } from "../src/demo.js";
import { END, START, upsertBlock } from "../src/instructions.js";
import { runDecide, runInit } from "../src/setup.js";
import { buildSummary, SUMMARY_MARKER } from "../src/summary.js";

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/cli.js");
const cfg = (lang: "vi" | "en" = "en"): KipConfig => ({ ...defaultConfig(), lang });

function kip(cwd: string, args: string[], env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8", env: { ...process.env, NO_COLOR: "1", ...env } });
}

test("detects the 'built it two different ways' story", () => {
  const team = createDemoTeam("en");
  const a = analyze(team.you, { baseRef: "origin/main" });
  const kinds = a.signals.map((s) => s.kind);

  const violation = a.signals.find((s) => s.kind === "decision-violation");
  assert.ok(violation && violation.kind === "decision-violation");
  assert.equal(violation.pkg, "mongoose");

  const parallel = a.signals.find((s) => s.kind === "parallel");
  assert.ok(parallel && parallel.kind === "parallel");
  assert.equal(parallel.topic, "auth");
  assert.deepEqual(parallel.authors, ["Alice"]);

  const lock = a.signals.find((s) => s.kind === "lockfile");
  assert.ok(lock && lock.kind === "lockfile");
  assert.equal(lock.mine, "yarn");
  assert.deepEqual(lock.theirs, ["pnpm"]);

  const overlap = a.signals.find((s) => s.kind === "overlap");
  assert.ok(overlap && overlap.kind === "overlap");
  assert.deepEqual(overlap.files, [{ path: "src/index.js", authors: ["Alice"] }]);

  assert.ok(kinds.includes("schema"));
  assert.ok(kinds.includes("decisions-changed"));
  assert.ok(kinds.includes("stale"));
  assert.equal(a.behind, 2);
  // warnings come first
  const firstInfo = a.signals.findIndex((s) => s.severity === "info");
  assert.ok(a.signals.slice(firstInfo).every((s) => s.severity === "info"));
});

test("dependency conflict without a written decision", () => {
  const team = createDemoTeam("en");
  // Remove the decisions file from the team line to rely on categories alone.
  fs.rmSync(path.join(team.alice, ".kip"), { recursive: true });
  run(team.alice, ["commit", "-qam", "drop decisions"]);
  run(team.alice, ["push", "-q", "origin", "main"]);
  run(team.you, ["fetch", "-q", "origin"]);
  const a = analyze(team.you, { baseRef: "origin/main" });
  // mongoose (ORM) vs prisma (ORM) on the team line
  const conflict = a.signals.find((s) => s.kind === "dep-conflict");
  assert.ok(conflict && conflict.kind === "dep-conflict");
  assert.equal(conflict.mine, "Mongoose");
  assert.deepEqual(conflict.theirs, ["Prisma"]);
});

test("brief shows news once, then only signals", () => {
  const team = createDemoTeam("vi");
  const config = cfg("vi");
  const first = computeBrief({ root: team.you, config, baseRef: "origin/main", fetch: false });
  assert.equal(first.news.length, 2);
  assert.ok(first.first);
  assert.deepEqual(first.decisionsAdded, ["Dùng Prisma + PostgreSQL cho database"]);
  assert.ok(first.depsAdded.includes("@prisma/client"));
  const text = renderBrief(first, config);
  assert.match(text, /Tin từ nhóm/);
  assert.match(text, /mongoose/);

  const second = computeBrief({ root: team.you, config, baseRef: "origin/main", fetch: false });
  assert.equal(second.news.length, 0);
  assert.ok(second.analysis.signals.some((s) => s.kind === "decision-violation"));
  assert.match(renderBrief(second, config), /Không có gì mới/);

  // New teammate commit shows up as news, own commits never do.
  fs.writeFileSync(path.join(team.alice, "src/features/auth/logout.js"), "// logout\n");
  run(team.alice, ["add", "-A"]);
  run(team.alice, ["commit", "-qm", "feat(auth): logout"]);
  run(team.alice, ["push", "-q", "origin", "main"]);
  const third = computeBrief({ root: team.you, config, baseRef: "origin/main", fetch: true });
  assert.deepEqual(
    third.news.map((c) => c.subject),
    ["feat(auth): logout"],
  );
  assert.equal(third.first, false);
});

test("init writes instructions for every agent and is idempotent", () => {
  const team = createDemoTeam("en");
  fs.writeFileSync(path.join(team.you, "AGENTS.md"), "# Our agent notes\n\nKeep functions small.\n");
  fs.mkdirSync(path.join(team.you, ".claude"), { recursive: true });
  fs.writeFileSync(path.join(team.you, ".claude/settings.json"), JSON.stringify({ permissions: { allow: ["Bash(npm test)"] } }));

  const res = runInit({ root: team.you, lang: "en" });
  for (const f of ["AGENTS.md", "CLAUDE.md", "GEMINI.md", ".github/copilot-instructions.md", ".cursor/rules/kip.mdc", ".kip/config.json", ".kip/decisions.md"]) {
    assert.ok(fs.existsSync(path.join(team.you, f)), `${f} should exist`);
  }
  const agents = fs.readFileSync(path.join(team.you, "AGENTS.md"), "utf8");
  assert.match(agents, /Keep functions small/);
  assert.match(agents, /kip brief/);
  // Auto-detected decision from the local deps (express + mongoose)
  assert.ok(res.suggested.some((d) => d.title.includes("Express")));
  assert.ok(res.suggested.some((d) => d.title.includes("Prisma")), "suggestions come from the team line");
  assert.ok(!res.suggested.some((d) => d.title.includes("Mongoose")), "never encode a drifted branch as a decision");

  const settings = JSON.parse(fs.readFileSync(path.join(team.you, ".claude/settings.json"), "utf8"));
  assert.deepEqual(settings.permissions, { allow: ["Bash(npm test)"] });
  assert.equal(settings.hooks.SessionStart.length, 1);
  assert.match(settings.hooks.SessionStart[0].hooks[0].command, /brief --hook$/);

  // Run again: no duplicate blocks, hooks or decisions
  const again = runInit({ root: team.you, lang: "en" });
  assert.equal(again.suggested.length, 0);
  const agents2 = fs.readFileSync(path.join(team.you, "AGENTS.md"), "utf8");
  assert.equal(agents2.split(START).length - 1, 1);
  const settings2 = JSON.parse(fs.readFileSync(path.join(team.you, ".claude/settings.json"), "utf8"));
  assert.equal(settings2.hooks.SessionStart.length, 1);
  assert.ok(again.files.filter((f) => f.file !== ".kip/config.json").every((f) => f.result === "unchanged"));
});

test("decide records a decision and every agent sees it", () => {
  const team = createDemoTeam("en");
  runInit({ root: team.you, lang: "en", suggest: false });
  runDecide(team.you, cfg("en"), { title: "Use Zod for validation", why: "one schema for client and server", use: ["zod"], avoid: ["yup", "joi"] });
  const decisions = parseDecisions(fs.readFileSync(path.join(team.you, ".kip/decisions.md"), "utf8"));
  const d = decisions.find((x) => x.title === "Use Zod for validation");
  assert.ok(d);
  assert.deepEqual(d.use, ["zod"]);
  assert.deepEqual(d.avoid, ["yup", "joi"]);
  assert.equal(d.owner, "You");
  for (const f of ["AGENTS.md", "CLAUDE.md", ".cursor/rules/kip.mdc"]) {
    assert.match(fs.readFileSync(path.join(team.you, f), "utf8"), /Use Zod for validation/);
  }
});

test("summary for a PR has a stable marker and divergence section", () => {
  const team = createDemoTeam("en");
  const s = buildSummary({ root: team.you, config: cfg("en"), baseRef: "origin/main", headRef: "HEAD" });
  assert.ok(s.markdown.startsWith(SUMMARY_MARKER));
  assert.match(s.markdown, /feat: login with mongodb/);
  assert.match(s.markdown, /\+ `mongoose`/);
  assert.match(s.markdown, /Divergence from origin\/main/);
  assert.ok(s.warnings >= 3);
  assert.match(s.text, /⚠/);
});

test("CLI: check --strict fails on warnings, brief --hook never fails", () => {
  const team = createDemoTeam("en");
  const check = kip(team.you, ["check", "--no-fetch", "--strict"]);
  assert.equal(check.status, 1, check.stderr);
  assert.match(check.stdout, /mongoose/);

  const json = kip(team.you, ["check", "--no-fetch", "--json"]);
  assert.equal(json.status, 0);
  const parsed = JSON.parse(json.stdout);
  assert.equal(parsed.base, "origin/main");
  assert.ok(parsed.warnings >= 3);

  const hook = kip(team.you, ["brief", "--hook", "--no-fetch"]);
  assert.equal(hook.status, 0);
  assert.match(hook.stdout, /^\[kip\]/);

  const outside = kip(os.tmpdir(), ["brief", "--hook"]);
  assert.equal(outside.status, 0);
  assert.equal(outside.stdout, "");

  const notRepo = kip(os.tmpdir(), ["check"]);
  assert.equal(notRepo.status, 2);
});

test("clean branch reports no divergence", () => {
  const team = createDemoTeam("en");
  run(team.alice, ["checkout", "-q", "-b", "readme"]);
  fs.appendFileSync(path.join(team.alice, "README.md"), "\nSetup: pnpm i\n");
  const a = analyze(team.alice, { baseRef: "origin/main" });
  assert.deepEqual(a.signals, []);
});

test("parsers: decisions (vi/en), requirements, pyproject, go.mod", () => {
  const ds = parseDecisions(`# x
## 2026-01-02 · Dùng FastAPI
- lý do: nhanh
- dùng: fastapi
- tránh: flask, django
## Old choice
- status: superseded
- use: flask
`);
  assert.equal(ds.length, 2);
  assert.equal(ds[0]!.date, "2026-01-02");
  assert.equal(ds[0]!.title, "Dùng FastAPI");
  assert.deepEqual(ds[0]!.avoid, ["flask", "django"]);
  assert.equal(ds[1]!.status, "superseded");

  assert.deepEqual(parseRequirements("Flask==3.0\n# c\nrequests>=2 ; python_version>'3'\n-r other.txt\nSQLAlchemy[asyncio]\n"), [
    "flask",
    "requests",
    "sqlalchemy",
  ]);
  const py = parsePyproject(`[project]
name = "x"
dependencies = [
  "fastapi>=0.110",
  "uvicorn[standard]>=0.29",
  "pydantic",
]
[project.optional-dependencies]
dev = ["pytest"]
[tool.poetry.dependencies]
python = "^3.11"
httpx = "^0.27"
`);
  assert.deepEqual(py.sort(), ["fastapi", "httpx", "pydantic", "pytest", "uvicorn"]);
  assert.deepEqual(parseGoMod("module x\n\nrequire github.com/gin-gonic/gin v1.10.0\nrequire (\n\tgorm.io/gorm v1.25.0 // indirect\n)\n"), [
    "github.com/gin-gonic/gin",
    "gorm.io/gorm",
  ]);
});

test("categories and topics", () => {
  assert.equal(classifyPackage("npm:@prisma/client")?.lib.id, "prisma");
  assert.equal(classifyPackage("pypi:fastapi")?.category.id, "server");
  assert.ok(termMatchesPackage("Prisma", "npm:@prisma/client"));
  assert.ok(!termMatchesPackage("prisma", "npm:mongoose"));
  assert.deepEqual(topics("src/features/auth/LoginForm.tsx"), ["auth", "login"]);
  assert.deepEqual(topics("app/orders/OrderList.vue"), ["order"]);
});

test("upsertBlock keeps user content and replaces only the kip block", () => {
  const block1 = `${START} -->\nv1\n${END}`;
  const block2 = `${START} -->\nv2\n${END}`;
  const once = upsertBlock("# Mine\n\nhello\n", block1);
  const twice = upsertBlock(once, block2);
  assert.match(twice, /# Mine/);
  assert.match(twice, /v2/);
  assert.doesNotMatch(twice, /v1/);
});

function run(cwd: string, args: string[]) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout;
}
