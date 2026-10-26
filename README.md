# Logikträning

Private practice app for **JobMatch LogiQ** (language-free, 20-item blocks, rate-scored), with the old **JobMatch Logic** 80/30 format kept as a legacy mode. Built for the candidate's
Unionen application. Swedish UI, laptop first. Times every answer and tags it with its question type,
so slow and weak spots show up.

- Design: `docs/superpowers/specs/2026-10-26-logiktest-design.md`
- Plan: `docs/superpowers/plans/2026-10-26-logiktest.md`

## Run locally

Static site, no build step: preview entry `logiktest` (port 4331) in the parent `.claude/launch.json`,
or `npx serve . -l 4331`.

```
npm test          # node:test suite
npm run validate  # checks bank/*.json
```

## Data

Supabase project `ytuhqjexdsbicdaasram`. Tables `lt_config`, `lt_questions`, `lt_sessions`, `lt_answers`
(RLS on, no anon access); the browser only calls the passphrase-checked RPCs in
`supabase/001_logiktest.sql`. Answers go through a localStorage outbox first, so nothing is lost offline.

Analysis: `LT_PASS=<passphrase> node tools/stats.js` prints the session trend and per-subtype
accuracy / median seconds / flags.

## Adding questions

Add entries to `bank/<area>.json` (shape and subtypes in `js/taxonomy.js` / `js/bank.js`), then:

1. `npm run validate`
2. Blind check: strip `correct`/`explanation` into `solutions/<area>.blind.json`, have a fresh agent
   solve it into `solutions/<area>.json`, run `node tools/blind-check.js bank/<area>.json solutions/<area>.json`.
3. Commit and push (GitHub Pages redeploys).

Figure, matrix, rotation, number-series, mental-arithmetic and x→f(x) questions are generated in
`js/generators/` from a seed and never run out.
