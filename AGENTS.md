# kip — contributor guide for agents and humans

Start with [docs/CONTEXT.md](docs/CONTEXT.md): the problem, research, design decisions, status, and next steps.

## Commands
- `npm ci` — install (dev-only deps: typescript, @types/node)
- `npm test` — build + run `test/kip.test.ts` (node:test)
- `npm run demo` — reproduce the "two directions" story in a temp folder
- `node dist/src/cli.js <command>` — run the local build

## Conventions
- TypeScript, ESM, Node ≥ 18.17, **zero runtime dependencies**.
- Deterministic analysis only (no network/LLM in `src/analyze.ts`).
- Every user-facing string goes through `src/i18n.ts` in both `vi` and `en`.
- Only ever touch kip's own marked block in user files.
