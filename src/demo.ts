import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Builds a tiny team in a temp folder to reproduce the classic story:
 * you work on your own for a few days while a teammate takes the project another way.
 */
export interface DemoTeam {
  dir: string;
  origin: string;
  alice: string;
  you: string;
}

function run(cwd: string, args: string[], env: Record<string, string> = {}): string {
  const res = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", ...env },
  });
  if (res.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${res.stderr}`);
  return res.stdout;
}

function write(root: string, file: string, content: string): void {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function identity(repo: string, name: string, email: string): void {
  run(repo, ["config", "user.name", name]);
  run(repo, ["config", "user.email", email]);
  run(repo, ["config", "commit.gpgsign", "false"]);
}

const daysAgo = (d: number) => {
  const t = new Date(Date.now() - d * 86400_000).toISOString();
  return { GIT_AUTHOR_DATE: t, GIT_COMMITTER_DATE: t };
};

export function createDemoTeam(lang: "vi" | "en" = "en"): DemoTeam {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kip-demo-"));
  const origin = path.join(dir, "origin.git");
  const seed = path.join(dir, "seed");
  const alice = path.join(dir, "alice");
  const you = path.join(dir, "you");

  run(dir, ["init", "-q", "--bare", "-b", "main", origin]);
  run(dir, ["init", "-q", "-b", "main", seed]);
  identity(seed, "Minh", "minh@example.com");
  write(seed, "package.json", JSON.stringify({ name: "shop", dependencies: { express: "^4.19.0" } }, null, 2) + "\n");
  write(seed, "src/index.js", "const express = require('express');\nconst app = express();\napp.listen(3000);\n");
  write(seed, "README.md", "# Shop — group project\n");
  run(seed, ["add", "-A"]);
  run(seed, ["commit", "-q", "-m", "chore: project skeleton"], daysAgo(6));
  run(seed, ["remote", "add", "origin", origin]);
  run(seed, ["push", "-q", "-u", "origin", "main"]);

  // You clone and start working on your own...
  run(dir, ["clone", "-q", origin, you]);
  identity(you, "You", "you@example.com");
  run(you, ["checkout", "-q", "-b", "login"]);

  // ...while Alice takes the project in a specific direction.
  run(dir, ["clone", "-q", origin, alice]);
  identity(alice, "Alice", "alice@example.com");
  const decisions =
    lang === "vi"
      ? "# Quyết định của nhóm\n\n## 2026-11-12 · Dùng Prisma + PostgreSQL cho database\n- lý do: cả nhóm quen SQL\n- dùng: prisma, pg\n- tránh: mongoose\n- phụ trách: Alice\n"
      : "# Team decisions\n\n## 2026-11-12 · Use Prisma + PostgreSQL for the database\n- why: everyone knows SQL\n- use: prisma, pg\n- avoid: mongoose\n- owner: Alice\n";
  write(alice, ".kip/decisions.md", decisions);
  write(
    alice,
    "package.json",
    JSON.stringify(
      { name: "shop", dependencies: { express: "^4.19.0", "@prisma/client": "^5.20.0", pg: "^8.13.0" }, devDependencies: { prisma: "^5.20.0" } },
      null,
      2,
    ) + "\n",
  );
  write(alice, "pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
  write(alice, "prisma/schema.prisma", "model User {\n  id    Int    @id @default(autoincrement())\n  email String @unique\n}\n");
  run(alice, ["add", "-A"]);
  run(alice, ["commit", "-q", "-m", "feat(db): Prisma + Postgres, User model"], daysAgo(4));
  write(alice, "src/features/auth/loginRoute.js", "// POST /api/auth/login using Prisma\n");
  write(alice, "src/index.js", "const express = require('express');\nconst app = express();\napp.use('/api/auth', require('./features/auth/loginRoute'));\napp.listen(3000);\n");
  run(alice, ["add", "-A"]);
  run(alice, ["commit", "-q", "-m", "feat(auth): login API with sessions in Postgres"], daysAgo(3));
  run(alice, ["push", "-q", "origin", "main"]);

  // Your local work, not yet pushed: Mongo, yarn, your own login.
  write(you, "package.json", JSON.stringify({ name: "shop", dependencies: { express: "^4.19.0", mongoose: "^8.7.0" } }, null, 2) + "\n");
  write(you, "yarn.lock", "# yarn lockfile v1\n");
  write(you, "src/auth/login.js", "// login with MongoDB\n");
  write(you, "src/index.js", "const express = require('express');\nconst app = express();\nrequire('./auth/login')(app);\napp.listen(3000);\n");
  run(you, ["add", "-A"]);
  run(you, ["commit", "-q", "-m", "feat: login with mongodb"], daysAgo(1));
  // Fetch so the team line is visible locally (kip brief also fetches on its own).
  run(you, ["fetch", "-q", "origin"]);
  return { dir, origin, alice, you };
}
