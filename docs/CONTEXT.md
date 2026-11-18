# kip — project context (handoff)

> Read this first if you are a new agent session or a new contributor. It holds the full reasoning behind kip,
> written at the end of the brainstorm + MVP session (2026-11-18), so nobody has to re-derive it.
> (Yes, this file is kip's own idea applied to itself: decisions and intent travel with the repo.)

## 1. Origin & problem

The founder is a university CS student. In a 5-person group project, 2–3 people coded, each with their own AI agent, all in different directions; the other 2 couldn't follow the flow at all. The founder finished their part, then discovered the team repo was completely different and more detailed. Their own words: "cay đắng" (bitter), feeling lost and left behind. The rational strategy had become "one person codes everything".

**Problem, sharpened:** *silent divergence, detected too late.* The team's direction existed (in commits, chat, someone's agent session) but never reached this person or their agent.
**North-star metric:** time from "started diverging" to "someone noticed". Target: weeks → minutes/hours.

JTBD: *When I come back to a group project after a few days (or a teammate's agent just wrote 2,000 lines), I want to know what the team decided and why, so I can contribute in the right direction without re-asking everything or feeling useless.*

## 2. Evidence (search summaries, Nov 2026; arxiv was not directly fetchable, so verify before citing)

- Graf, Beinstingel, Krusche, Poquet (2026, arXiv 2606.23237): 103 student pairs. Code visible on GitHub, *process* (how AI was used) invisible. Early misalignment in perceived AI use → lower final scores, strongest in weaker teams; face-to-face pairing didn't fix it.
- Xia, Wu, Park (2026, arXiv 2609.25396, "Passes Alone, Fails Together"): agent patches that pass alone fail together. 97% interference on constructed tasks; ~0 on real reviewed PR pairs. In other words, human coordination and review is what prevents it.
- Capstone GenAI study (arXiv 2604.24521): different tools/prompts/models per member → inconsistent terminology, design drift.
- HEPI (2026) / Advance HE (2025): students ask AI instead of teammates → the social core of teamwork erodes.

## 3. Market (Nov 2026)

| Who | What | Gap for us |
|---|---|---|
| Slack Code (Aug 2026) | Agent per channel; tabs Conversation/Plan/Diffs/Preview | Slack + paid agents; enterprise |
| Cursor Projects multiplayer (beta, Nov 10 2026) | Shared context store + task board | Everyone must use Cursor, paid seats |
| Replit multiplayer | Per-person Agent chats + Kanban | Replit-only |
| GitHub Agent HQ / Mission Control | Assign/track agents, admin metrics | Copilot-centric, org-level |
| Mosaic/Ocean (YC S26), Augment Cosmos | Shared memory across agent sessions | Closed, enterprise |
| Agor, Orca, Conductor | One person × many agents (orchestration) | Not about teams |
| claude-duet/share/pair, manycode | Share one live session | Same session ≠ shared understanding |
| adr-kit, ArchGuard, archdrift, adr-drift | ADRs/architecture checks for agents | Framed as documentation chores; ~0 traction |
| Spec Kit (~127k★), Task Master (~27k★) | Tool-agnostic via files/MCP | Single-player planning, not team divergence |

**Positioning:** the empty cell is *many people × many agents, each with their own tool, open source*. kip = the shared-understanding layer for teams that code with AI agents. Students first; teams/enterprises later, bottom-up.

## 4. Decisions made (and why)

1. **Sync decisions, not code.** Model: Intent → Decision → Task → Change. Git already syncs code.
2. **Tool-agnostic through architecture, not integrations.** Core = files in git (`.kip/`) + CLI. Generated blocks in AGENTS.md / CLAUDE.md / GEMINI.md / copilot-instructions / Cursor rule. MCP server next.
3. **The agent is the messenger.** At session start the agent runs `kip brief` (Claude Code: SessionStart hook; others: instruction file) and briefs the human *before* coding. No new app to open.
4. **Deterministic core, no LLM, no key, no server.** High precision beats recall: noisy alerts get muted. Signals are concrete: decision violation, same-category library conflict (~20 curated categories), parallel new files on the same topic, lockfile/package-manager drift, overlapping files, schema changes, staleness. LLM only explains (via the user's own agent). Optional LLM narration in CI is roadmap, behind provider adapters.
5. **Zero-doc onboarding.** `init` auto-seeds decisions from the *team line's* dependencies (never from a possibly-drifted branch). People only edit/approve.
6. **Bilingual (vi/en) everywhere.** Vietnamese students first, global from day one.
7. **Zero runtime dependencies**, Node ≥ 18.17, MIT.
8. **Name:** `kip` from Vietnamese *kịp* (theo kịp = keep up; kịp thời = in time). Short CLI, pronounceable globally. Unscoped `kip` on npm is taken (abandoned 2013 package) → publish as **`@tiou/kip`** (the founder's ecosystem lives in the org/scope, the product name stays short). Alternatives considered: `onpage`, `teambrief`, `sametrack`.

## 5. Code map

```
src/cli.ts           argument parsing + commands (init, brief, check, summary, decide, suggest, sync, demo)
src/git.ts           thin git wrapper (spawnSync, core.quotePath=false)
src/deps.ts          manifest parsing: package.json, requirements*.txt, pyproject.toml, go.mod; lockfiles
src/categories.ts    curated "same job, different library" categories
src/decisions.ts     .kip/decisions.md format (vi/en keys), template, append, diff
src/analyze.ts       the divergence engine → Signal[]
src/brief.ts         "team news since you last looked" + per-person state in .git/kip/state.json
src/summary.ts       PR / branch summary (markdown + chat text)
src/instructions.ts  generated agent blocks + Claude Code SessionStart hook
src/setup.ts         init / decide / suggest
src/render.ts        human output; src/i18n.ts all strings (vi/en)
src/notify.ts        Discord/Slack incoming webhooks
src/demo.ts          reproducible "two directions" team in a temp dir (used by `kip demo` and tests)
action.yml           GitHub Action (one updating PR comment + optional chat webhook)
test/kip.test.ts     node:test suite (`npm test`)
```

## 6. Status

Done in v0.1: everything above, 11 passing tests, demo verified in vi and en.

Not verified yet (needs a real machine and real tools):
- Claude Code actually injecting the SessionStart hook output on the founder's machine; Codex/Cursor/Copilot/Gemini actually following the AGENTS.md / rules instruction to run `kip brief`.
- `npx -y @tiou/kip` (package not published yet; npm org `tiou` not created yet), GitHub Action from `FanAnimeVN/kip@main` on real GitHub.

Verified on the founder's Windows 11 machine (2026-11-18, Node 25, Git Bash): `npm ci`, 11/11 tests, `kip demo` in vi and en, `kip brief --hook` and `kip check` in this repo.
- **The real test:** running `kip check` / `kip brief --peek` on the founder's actual group-project repo history. Would it have caught the divergence on day 2?

## 7. Next steps (in order)

1. **Autopsy the founder's real case**: run kip on the old team repo (check out the commit where they started diverging). Record what it would have said and when. That becomes the README story with real data.
2. ~~Create the GitHub repo and push~~ (done: https://github.com/FanAnimeVN/kip). Check CI is green. Claim npm scope `@tiou`, `npm publish --access public`.
3. Dogfood: install kip in the founder's current group project, with the 4 teammates.
4. 10 short interviews: "Have you ever finished something and found the team went another way? What message would have saved you?"
5. v0.2: MCP server (`kip_brief`, `kip_check`, `kip_decide` tools), Discord bot with `/catchup` for non-coders, decision mining from merged PRs (proposal + ✅), more categories (Java/Kotlin, mobile).
6. Launch: README GIF of `kip demo`, Show HN, r/ClaudeAI, r/cursor, Viblo, Vietnamese dev groups.

## 8. Open questions

- Where did the team's direction live *before* it hit the repo (chat? a meeting? someone's agent session?). If mostly outside git, v0.2 needs chat/session capture.
- Should staleness thresholds be configurable per team (sprint-style vs. hackathon-style)?
- Instructor/lecturer view: valuable for fairness, risky as surveillance. Opt-in only, later.
