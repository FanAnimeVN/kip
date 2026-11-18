# Team decisions

<!--
One "##" section per decision. Keep it short: what we chose and why.
The optional "- use:" / "- avoid:" lines let kip check that everyone's code
(and everyone's AI agent) is heading the same way.

Example:

## 2026-11-18 · Use Prisma + PostgreSQL for the database
- why: everyone knows SQL, free hosting is easy
- use: prisma, pg
- avoid: mongoose, typeorm
- owner: @an

Changed your mind? Don't delete — add "- status: superseded" to the old one and record a new one.
Shortcut: kip decide "Title" --why "..." --use a,b --avoid c
-->

## 2026-11-18 · Zero runtime dependencies
- why: npx must be instant and trustworthy
- avoid: commander, yargs, chalk, axios
- owner: Claude

## 2026-11-18 · Deterministic core, no LLM required
- why: precise, free, private; the user's own agent does the explaining
- owner: Claude

## 2026-11-18 · Every user-facing string in Vietnamese and English
- why: students in Vietnam first, global from day one
- owner: Claude
