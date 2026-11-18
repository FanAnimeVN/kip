# kip

**Keep your team — and every teammate's AI coding agent — on the same page.**

[Tiếng Việt](README.vi.md) · MIT · Zero dependencies · Works with Claude Code, Codex, Cursor, Copilot, Gemini CLI, and any agent that reads `AGENTS.md`

> *kịp* (Vietnamese): to keep up, to be in time. As in *theo kịp nhóm*: "keep up with the team".

---

## The story

Five students, one group project. Everyone codes with their own AI agent.
I worked on login for four days. When I finally looked at the team repo, it was **nothing like mine**: they had picked Prisma + Postgres, built login in a different folder, and switched to pnpm. My four days were wasted, and I felt left behind.

Nobody did anything wrong. The team's direction existed. It just never reached me, or my agent.

AI agents make this worse. Drifting used to take days of typing; now an agent writes 2,000 lines in your own direction in an hour. Research agrees:

- Teams whose members misjudge each other's AI use get lower project scores, and weaker teams are hit hardest ([Graf et al., 2026](https://arxiv.org/pdf/2606.23237)).
- Patches from parallel agents that each pass their own tests break when merged in 97% of runs on constructed tasks ([Xia, Wu & Park, 2026](https://arxiv.org/abs/2609.25396v1)).

**kip shortens the time between "we started going different ways" and "someone noticed" from weeks to minutes.**

## What it looks like

When you open your agent, it runs `kip brief` and tells you this **before writing any code**:

```text
kip · Team news (origin/main)

2 commits on the team line that you don't have yet:

  Alice · 2 commits · 3 days ago
    • feat(auth): login API with sessions in Postgres
    • feat(db): Prisma + Postgres, User model
    areas: src/features, src, prisma

  Dependencies: + @prisma/client  + pg  + prisma
  Data model: prisma/schema.prisma
  Decisions:
    + Use Prisma + PostgreSQL for the database

You vs. the team:
  ⚠ You added mongoose, but the decision "Use Prisma + PostgreSQL for the database" says to avoid it.
  ⚠ Both you and Alice are building "auth" — in two different places:
      you: src/auth/login.js
      Alice: src/features/auth/loginRoute.js
  ⚠ You're installing packages with yarn; the team uses pnpm.
  ⚠ You and the team both changed 1 file:
      src/index.js (Alice)
  ⚠ You're 2 commits behind the team line (4 days).

  What to do:
  → Ask the team before switching libraries — or propose a new decision: kip decide "..."
  → Ping Alice: are you two building the same thing? Agree who owns it.
  → Delete your lockfile and reinstall with pnpm.
  → Bring in the team's work before going further: git pull --rebase (or git merge origin/main).
```

To see this in 30 seconds without touching your own repo:

```bash
npx -y @tiou/kip demo
```

## Quick start

In your project (any git repo with a shared `main`):

```bash
npx -y @tiou/kip init
```

Commit what it created and push. That's it: every teammate's agent now picks it up.

| What `init` creates | Who reads it |
|---|---|
| `.kip/decisions.md` | Humans. The team's decisions in plain language, auto-seeded from the libraries you already use |
| `AGENTS.md` | Codex, Cursor, Copilot coding agent, Zed, Amp, Jules, and more |
| `CLAUDE.md` + `.claude/settings.json` hook | Claude Code. It briefs you automatically when a session starts |
| `GEMINI.md` | Gemini CLI |
| `.github/copilot-instructions.md` | GitHub Copilot |
| `.cursor/rules/kip.mdc` | Cursor |

kip only edits its own block (between `<!-- kip:start -->` and `<!-- kip:end -->`); the rest of your files stay yours.

## How it works

kip treats **decisions** as what needs syncing, not code. Git already syncs code.

```
Intent ── Decision ("use Prisma, not Mongoose") ── Task ── Change (commit/PR)
```

1. **One source of truth in your repo**: `.kip/decisions.md`. Plain markdown, versioned with git, in English or Vietnamese.
2. **Compiled into every agent's instructions**, so your teammate's Cursor and your Claude Code follow the same decisions.
3. **A briefing at the start of every agent session**: what teammates changed since you last looked, and whether your work is drifting.
4. **High-precision, deterministic checks.** No LLM, no API key, no server, no account. kip warns only on concrete signals:

| Signal | Example |
|---|---|
| Decision violation | You added `mongoose`; the team decided "avoid mongoose" |
| Same job, different library | You added `axios`; the team uses `ky` (~20 categories: ORM, DB, auth, state, UI kit, test runner, …) |
| Parallel work | You and Alice both created new `auth` files in different places |
| Package manager drift | You committed `yarn.lock`; the team uses pnpm |
| Overlapping edits | You both changed `src/index.js` |
| Data model changed | The team changed `prisma/schema.prisma` |
| Falling behind | You're 12 commits / 4 days behind `origin/main` |

Your agent does the talking: it reads kip's output and explains it to you in your own language. kip itself never calls an AI model.

## Commands

```bash
kip init                    # set up kip in this repo
kip brief                   # team news since you last looked + divergence warnings
kip check                   # am I heading a different way? (--strict exits 1 for CI)
kip decide "Use Zod for validation" --why "one schema for client+server" --use zod --avoid yup,joi
kip suggest [--write]       # propose decisions from libraries the team already uses
kip sync                    # regenerate agent instruction files after editing decisions.md
kip summary [--notify]      # plain-language summary of a branch/PR (markdown or --format text)
kip demo                    # 30-second demo in a temp folder
```

Common flags: `--lang vi|en`, `--base origin/main`, `--json`, `--no-fetch`, `--peek`.

## Pull requests and team chat (GitHub Action)

Give teammates who don't code (or don't pull) a plain-language view of every PR, with divergence warnings, in the PR and in Discord or Slack:

```yaml
# .github/workflows/kip.yml
name: kip
on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]
permissions:
  contents: read
  pull-requests: write
jobs:
  catch-up:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: tiou/kip@main
        with:
          lang: en
          discord-webhook: ${{ secrets.KIP_DISCORD_WEBHOOK }} # optional
```

kip keeps one summary comment per PR and updates it on every push.

## Decisions format

```markdown
## 2026-11-18 · Use Prisma + PostgreSQL for the database
- why: everyone knows SQL; free hosting is easy
- use: prisma, pg
- avoid: mongoose, typeorm
- owner: @an
```

`use` and `avoid` are optional; with them, kip can check the decision automatically. To change your mind, add `- status: superseded` to the old decision and write a new one. Vietnamese keys work too (`lý do`, `dùng`, `tránh`, `phụ trách`, `trạng thái`).

## FAQ

**Does my code leave my machine?** No. kip is a local CLI that reads git. The optional webhook sends only the summary text to a URL you choose.

**Do I need an API key?** No. Your agent (Claude Code, Codex, Cursor, …) explains kip's output, so kip works with whatever you already use.

**Will it spam us?** kip stays quiet unless there's a concrete signal. Everything is deterministic, so the same input always gives the same output.

**Is this only for students?** It started from a student group project, but every team where people code with different AI agents has the same problem.

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md). Next: an MCP server (agents can query team context mid-session), a chat bot with `/catchup` for teammates who don't code, decision mining from merged PRs, and optional LLM narration via your own provider.

## Contributing

Issues and PRs are welcome, especially new library categories, new agent targets, and translations. See [CONTRIBUTING.md](CONTRIBUTING.md).
