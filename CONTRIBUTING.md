# Contributing to kip

Thanks for helping teams stay on the same page!

## Setup

```bash
npm ci
npm test        # builds and runs the test suite
npm run demo    # see kip in action in a temp folder
```

Node ≥ 18.17. No runtime dependencies. Please keep it that way.

## Ground rules

- **Precision over recall.** A new signal must be concrete and rarely wrong. Noisy alerts get muted, and then kip is useless.
- **Deterministic core.** No network calls or AI models in `analyze`. Same input, same output.
- **Every user-facing string in both languages.** Add it to `src/i18n.ts` (vi + en).
- **Never clobber user files.** kip only edits its own marked block, and skips files it can't parse.

## Good first contributions

- Add a library to a category in `src/categories.ts` (with a test in `test/kip.test.ts`).
- Add a manifest parser (Gradle, Cargo, pubspec) in `src/deps.ts`.
- Add an agent target in `src/instructions.ts`.
- Translate `src/i18n.ts` into another language.

See [docs/CONTEXT.md](docs/CONTEXT.md) for the why behind the design.
