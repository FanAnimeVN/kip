# Roadmap

## v0.1 — the core loop (done)
- [x] `.kip/decisions.md` (vi/en), auto-seeded from the team line's dependencies
- [x] Generated instructions for AGENTS.md, CLAUDE.md, GEMINI.md, Copilot, Cursor
- [x] Claude Code SessionStart hook → automatic briefing
- [x] `brief`, `check`, `summary`, `decide`, `suggest`, `sync`, `demo`
- [x] Divergence signals: decision violations, library conflicts (~20 categories), parallel work, package-manager drift, overlapping files, schema changes, staleness
- [x] GitHub Action: one updating PR comment + Discord/Slack webhook

## v0.2 — reach everyone, not just the person at the keyboard
- [ ] MCP server: `kip_brief`, `kip_check`, `kip_decide`, so any MCP-capable agent can query team context mid-session
- [ ] Discord bot: `/catchup` (since I was last here), `/why <topic>` (from decisions + commits), `/whohas <area>`
- [ ] Decision mining: propose decisions from merged PRs ("Looks like the team chose Zod — record it? ✅/❌")
- [ ] More categories: Java/Kotlin (Gradle/Maven), Flutter/React Native, Rust (Cargo)
- [ ] Optional LLM narration in CI behind provider adapters (bring your own key; never required)

## v0.3 — teams beyond the classroom
- [ ] Monorepo awareness (per-package team lines and owners)
- [ ] "Contract" decisions: API routes / DB schema checks beyond dependencies
- [ ] Opt-in contribution view for instructors (process, not surveillance)
- [ ] Zalo / Telegram / Lark notifications
