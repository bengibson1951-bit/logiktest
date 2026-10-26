# Logikträning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A private, Swedish, laptop-first web app that simulates JobMatch Logic. It records every answer with its question type and time to the millisecond in Supabase, and analyses where the candidate is slow or weak.

**Architecture:**
- A static site with ES modules and no build step, hosted on GitHub Pages.
- Pure logic modules are unit-tested with `node:test`: random numbers, generators, engine, timer, metrics, outbox and validation.
- `app.js` connects them to the DOM.
- Persistence goes through passphrase-checked `SECURITY DEFINER` RPCs on `lt_` tables in the DigitalContentNu Supabase project, with a localStorage outbox in front of them.

**Tech Stack:** HTML/CSS/vanilla JS (ES2022 modules), inline SVG, `fetch` to Supabase REST RPC, Postgres + pgcrypto, Node ≥ 20 for tests and tools.

**Spec:** `docs/superpowers/specs/2026-10-26-logiktest-design.md`

## Global Constraints

- The UI is Swedish only, with a calm neutral style and no alarm-red UI. The countdown is visible but not alarming.
- Answering uses keys **1–5** or a click, and **one press submits**. **S** or **→** skips. **A skip is final within the round.**
- Full test: **80 questions, 1800 s, 16 per area**, with difficulty rising gently. Snabbrunda: **20 questions, 450 s**. Träna svagheter: **20 questions**, no round clock. Ämnesdrill: **15 questions**, no round clock.
- Target pace is **22 s per question**. Strategi copy: skip when stuck after about **30 s**.
- `syllogism` options are always exactly `["Sant","Falskt","Möjligt","Osannolikt"]`. Every other subtype has 4 or 5 options, as set in `taxonomy.js`.
- Estimated Logikvärde applies to Fullt test only: `clamp(83.5 + 65 * totalAndel, 80, 160)`, which maps 30% to 103 and 50% to 116. It is labelled **"Uppskattning – inte JobMatch-poäng"**.
- Flags are computed over the last 3 sessions, only where a subtype has at least 5 answers:
  - `fast_sloppy`: accuracy < 0.60 and median < 15 s
  - else `weak`: accuracy < 0.60
  - else `slow_sure`: accuracy ≥ 0.75 and median > 30 s
- Weakness weight `w = max(0.15, (1 - acc) + max(0, medianS - 22) / 22)`. A subtype with no data gets 1.0.
- Hidden-tab time is excluded from `time_ms` and recorded as `paused_ms`. Round clocks pause while the tab is hidden.
- Supabase: all objects are prefixed `lt_`, RLS is on, and anon and authenticated roles have no policies. The browser holds only the URL and anon key.
  **Never** put the service-role key or the passphrase in the repo.
- Deadline is `2026-10-29T12:00:00+01:00` and is shown as a countdown on Home.
- Preview: entry `logiktest` on port **4331** in the parent `.claude/launch.json`.
- There is no service worker (an offline PWA is a non-goal).

## Review Focus

1. **The tab is hidden or the laptop sleeps mid-question.** Expect `time_ms` to exclude that gap and the round clock not to drain.
   This is pinned by the timer tests in Task 2.
2. **Network down during a round.** Expect answers to queue and flush later in order, with no duplicates (upsert on `(session_id, position)`), and the results screen still to render.
   This is pinned by the outbox tests in Task 3.
3. **The round clock hits 0 mid-question.** Expect the current question not to be recorded as answered (it counts as unreached), and the round to end immediately.
   This is pinned by the round tests in Task 2.
4. **Generated distractors coincide with the answer.** Expect exactly one correct option for every seed.
   This is pinned by the 500-seed property tests in Task 4.
5. **A reload mid-round.** Expect "Fortsätt där du var" to resume at the same position, with the remaining clock intact.
   This is pinned by the store resume test in Task 6.

---

## File Structure

```
logiktest/
  index.html              shell, loads js/app.js
  style.css
  package.json            scripts: test, validate
  js/config.js            SUPABASE_URL, SUPABASE_ANON_KEY, DEADLINE_ISO
  js/rng.js               seeded PRNG helpers
  js/taxonomy.js          AREAS, SUBTYPES (label, area, optionCount, source)
  js/bank.js              loadBank(), validateQuestion()
  js/svg.js               renderFigure(spec) -> svg string
  js/generators/index.js  generate(name, seed, difficulty), GENERATORS
  js/generators/poly.js   polyomino helpers (rotate, mirror, canonical)
  js/generators/figures.js  matris, figurserie, rotation, udda_figur
  js/generators/numbers.js  talserie, huvudrakning, talsamband
  js/engine.js            MODES, buildRound()
  js/round.js             newRound(), recordAnswer(), recordSkip(), timeUp()
  js/timer.js             createStopwatch()
  js/metrics.js           roundMetrics(), estimateLogik(), subtypeStats(), flags(), weights(), targetSeconds()
  js/outbox.js            createOutbox()
  js/db.js                createDb()
  js/store.js             load/save 'logik.v1', resume helpers
  js/app.js               screens + DOM wiring
  bank/logik.json  bank/sprak.json  bank/komplex.json  bank/matte.json
  bank/index.json         ["logik","sprak","komplex","matte"]
  supabase/001_logiktest.sql
  tools/validate.js       npm run validate
  tools/blind-check.js    compares blind solutions to keys
  tools/stats.js          service-role CLI for Claude's analysis (reads env SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)
  tests/*.test.js
```

**Question shape**, used everywhere:

```js
{ id, area, subtype, difficulty /*1|2|3*/, source /*'bank'|'generated'*/,
  generator?, seed?, prompt /*string, Swedish*/, options /*string[] | FigureSpec[]*/,
  correct /*index*/, explanation /*Swedish*/, figure? /*FigureSpec|null*/ }
```

- Generated ids are `gen:<generator>:<difficulty>:<seed>`.
- A `FigureSpec` is a plain JSON object, for example `{ kind:'matrix', cells:[Cell|null ×9] }`, `{ kind:'series', items:[Cell…] }` or `{ kind:'cell', cell }`.
- A `Cell` is `{ items:[{shape, x, y, size, rot, fill}] }` or `{ poly:[[r,c]…], rot, mirror }`.
- The builder chooses the exact shape vocabulary. `renderFigure` must handle every spec the generators emit.

**Answer record**, local and in the RPC payload:

```js
{ position, questionId, question /*snapshot*/, chosen /*int|null*/, isCorrect /*bool|null*/,
  skipped /*bool*/, timeMs, pausedMs, answeredAt /*ISO*/ }
```

---

### Task 1: Scaffold, taxonomy, Supabase migration, RPC client

**Files:**
- Create: `package.json`, `.gitignore`, `js/config.js`, `js/taxonomy.js`, `js/db.js`, `supabase/001_logiktest.sql`, `tests/db.test.js`
- Modify: parent `../.claude/launch.json` (add the `logiktest` entry: `npx -y serve logiktest -l 4331`)

**Interfaces:**
- Produces:
  - `AREAS = ['logik','uppfattning','matte','sprak','komplex']` and `AREA_LABELS` (Swedish).
  - `SUBTYPES: {[subtype]: {area, label, optionCount: 4|5, source:'bank'|'generated'}}`, covering every subtype in spec §5.
    `rangordning` is `source:'bank'`, and generation of it is dropped (YAGNI).
  - `createDb({url, anonKey, fetchImpl}) -> {auth(pass): Promise<boolean>, startSession(pass, session), recordAnswers(pass, sessionId, answers), finishSession(pass, sessionId, summary), history(pass, n=20): Promise<{sessions, answers}>}`.
    Every call is `POST {url}/rest/v1/rpc/<fn>` with headers `apikey` and `Authorization: Bearer anonKey`. A non-2xx response throws `Error` with `.status`.

- [ ] **Step 1:** Write `tests/db.test.js` with a fake `fetchImpl` that records calls.
  - `recordAnswers('pw','s1',[a])` posts to `/rest/v1/rpc/lt_record_answers` with body `{p_pass:'pw', p_session:'s1', p_answers:[a]}`.
  - A 401 response rejects with `err.status === 401`.
  - `auth` returns `true` when the RPC returns `true`.
- [ ] **Step 2:** Run `npm test` and expect FAIL (module missing).
- [ ] **Step 3:** Implement `js/config.js`, `js/taxonomy.js` and `js/db.js`.
  Put the URL and anon key from `../../DigitalContentNu/.env.local` into `config.js`. Both are public by design. Do not copy the service-role key.
- [ ] **Step 4:** Write `supabase/001_logiktest.sql`, making it idempotent (`create … if not exists`, `create or replace`).
  - `create extension if not exists pgcrypto`
  - Tables `lt_config`, `lt_questions`, `lt_sessions`, `lt_answers`, as in spec §9 (no `changes` column):
    - `lt_answers` has a unique `(session_id, position)`.
    - `lt_sessions.id` is a client-generated uuid.
  - `alter table … enable row level security` on all four tables, and `revoke all … from anon, authenticated`.
  - `lt_check(p_pass text)` is internal. It raises `insufficient_privilege` unless `crypt(p_pass, value) = value` for `key='pass_hash'`.
  - The public functions are `SECURITY DEFINER`, `set search_path = public, extensions`, and each calls `lt_check` first. `grant execute … to anon` only on these:
    - `lt_auth(p_pass) returns boolean`. It returns false instead of raising.
    - `lt_start_session(p_pass, p_session jsonb)`, an upsert.
    - `lt_record_answers(p_pass, p_session uuid, p_answers jsonb)`. It upserts each `question` snapshot into `lt_questions`, then upserts the answers on `(session_id, position)`.
    - `lt_finish_session(p_pass, p_session uuid, p_summary jsonb)`. It sets `ended_at`, the counters and `metrics`.
    - `lt_history(p_pass, p_n int default 20) returns jsonb`. It returns `{sessions:[…last n by started_at desc], answers:[{session_id, position, area, subtype, is_correct, skipped, time_ms}]}` for those sessions.
  - The passphrase is **not** in the file. A comment shows the line Ben runs separately:
    `insert into lt_config values ('pass_hash', crypt('<pass>', gen_salt('bf'))) on conflict (key) do update set value = excluded.value;`
- [ ] **Step 5:** Run `npm test` and expect PASS.
- [ ] **Step 6:** Commit with message `feat: scaffold, taxonomy, supabase migration and rpc client`.
- [ ] **Step 7 (needs Ben):**
  1. Ben pastes `001_logiktest.sql` plus the passphrase line into the Supabase SQL editor for project `xrtvvmvmueafdbdhuwqt`.
  2. Verify with `curl` that `lt_auth` returns `true` for the passphrase and `false` for a wrong one.
  3. Verify that `GET /rest/v1/lt_answers` with the anon key returns `[]` or an error, and never rows.

### Task 2: RNG, timer, round state

**Files:**
- Create: `js/rng.js`, `js/timer.js`, `js/round.js`, `tests/rng.test.js`, `tests/timer.test.js`, `tests/round.test.js`

**Interfaces:**
- Produces:
  - `mulberry32(seed:number) -> () => number`, plus `randInt(rand, lo, hi)` (inclusive), `pick(rand, arr)` and `shuffle(rand, arr) -> new array`.
  - `createStopwatch({now = () => performance.now()}) -> {start(), hide(), show(), read() -> {timeMs, pausedMs}}`.
    `app.js` calls `hide`/`show` from `visibilitychange`. `timeMs` excludes paused spans.
  - `newRound({sessionId, mode, questions, timeLimitS|null, startedAt}) -> round`, a plain JSON object that is serialisable for resume. It holds `position`, `answers[]`, `remainingMs`, `done`.
  - `recordAnswer(round, chosen, {timeMs, pausedMs}, nowIso) -> AnswerRecord` and `recordSkip(round, {timeMs, pausedMs}, nowIso) -> AnswerRecord`.
    Both advance `position`, subtract `timeMs` from `remainingMs` when there is a limit, and set `done` at the end.
  - `timeUp(round)` sets `done` and `remainingMs = 0` **without** recording the current question.

- [ ] **Step 1:** Write the tests.
  - The same seed gives the same sequence. `shuffle` is a permutation.
  - Stopwatch with a fake clock: start at 0, hide at 5000, show at 65000, read at 70000 gives `{timeMs:10000, pausedMs:60000}`.
  - `recordAnswer` with the correct index gives `isCorrect:true`, and `recordSkip` gives `skipped:true, chosen:null, isCorrect:null`.
  - After answering the last question, `done` is true.
  - `timeUp` at position 7 of 20 leaves `answers.length === 7`.
  - `JSON.parse(JSON.stringify(round))` round-trips.
- [ ] **Step 2:** Run `npm test` and expect FAIL.
- [ ] **Step 3:** Implement the three modules.
- [ ] **Step 4:** Run `npm test` and expect PASS.
- [ ] **Step 5:** Commit with message `feat: rng, stopwatch with hidden-tab exclusion, round state`.

### Task 3: Metrics and outbox

**Files:**
- Create: `js/metrics.js`, `js/outbox.js`, `tests/metrics.test.js`, `tests/outbox.test.js`

**Interfaces:**
- Consumes: `AnswerRecord` from Task 2, and `SUBTYPES`/`AREAS` from Task 1.
- Produces:
  - `roundMetrics(answers, total, {mode}) -> {answered, correct, korrekt, hastighet, totalAndel, estLogik|null, byArea:{[area]:{shown, correct, pct, medianS}}, bySubtype:{…same}}`.
    It has `estLogik` only when `mode === 'full'`.
  - `estimateLogik(totalAndel) -> number`, rounded to an integer.
  - `subtypeStats(rows, {lastSessions=3}) -> {[subtype]:{n, accuracy, medianS}}`. The rows are `lt_history().answers`. Skips count as answered-wrong for accuracy and are excluded from the median.
  - `flags(stats) -> {[subtype]: 'slow_sure'|'fast_sloppy'|'weak'}`. Only flagged subtypes appear.
  - `weights(stats, subtypes) -> {[subtype]: number}`.
  - `targetSeconds(stat|undefined) -> number`: 22 when `n < 5`, else `clamp(Math.round(medianS * 0.9), 10, 22)`.
  - `createOutbox({storage, key='logik.outbox', send}) -> {enqueue(item), flush(): Promise<number /*sent*/>, size()}`.
    `send(item)` returns a promise. `flush` sends in FIFO order and stops at the first failure, keeping the rest. The outbox is persisted to `storage` after every change.
    The caller schedules retries with backoff of 2 s, 4 s, 8 s … capped at 60 s.

- [ ] **Step 1:** Write the tests.
  - For 20 answers with 12 answered and 9 correct: `korrekt` = 0.75, `hastighet` = 0.6, `totalAndel` = 0.45.
  - `estimateLogik(0.30) === 103`, `estimateLogik(0.50) === 116`, `estimateLogik(1) === 149`, and `estimateLogik(0) === 84` (clamp floor not hit, but stays ≥ 80).
  - The flag cases match the Global Constraints exactly, including a subtype with n = 4 getting no flag.
  - `weights` floors at 0.15 and gives no-data subtypes 1.0.
  - Outbox: when `send` fails on item 2 of 3, `flush` returns 1 and `size()` is 2. A new outbox on the same storage sees 2. A later successful flush sends items 2 and 3 in order.
- [ ] **Step 2:** Run `npm test` and expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and expect PASS.
- [ ] **Step 5:** Commit with message `feat: round metrics, flags, weights and outbox`.

### Task 4: Generators and SVG renderer

**Files:**
- Create: `js/generators/poly.js`, `js/generators/figures.js`, `js/generators/numbers.js`, `js/generators/index.js`, `js/svg.js`, `tests/generators.test.js`, `tests/svg.test.js`

**Interfaces:**
- Consumes: `rng.js` and `SUBTYPES`.
- Produces:
  - `GENERATORS = ['matris','figurserie','rotation','udda_figur','talserie','huvudrakning','talsamband']`.
  - `generate(name, seed, difficulty) -> Question`, with `source:'generated'`, the id format above, and a Swedish `prompt` and `explanation`.
  - `renderFigure(spec, {size}) -> string`, an `<svg …>` string using `currentColor`.

**Generator rules:**

| Generator | Rule | Options |
|---|---|---|
| **rotation** | A random chiral polyomino of 5 cells (difficulty 1–2) or 6 cells (difficulty 3), where the mirror image is not equal to any rotation. The answer is a random rotation of the shape. | 4 options: the answer plus 3 rotations of the mirror image. |
| **udda_figur** | Four rotations of one chiral polyomino plus one rotation of its mirror image. | 5 options; the odd one is correct. |
| **matris** | 3×3 grid where each row follows the rule(s) and the bottom-right cell is missing. Attributes are shape, count (1–3), fill (`none`/`solid`/`striped`) and rotation. Rules are "each value once per row" (a Latin square) or "progression along the row". Difficulty 1 uses 1 varying attribute, difficulty 2 uses 2, difficulty 3 uses 3. | 5 options; each distractor differs from the answer in exactly one attribute. |
| **figurserie** | 4 frames and then "what comes next". Rules are a marker moving clockwise around 4 or 8 positions, a rotation step of 45° or 90°, or a count step. Difficulty 3 combines two rules. | 5 options. |
| **talserie** | Arithmetic or geometric (difficulty 1); growing difference or alternating two series (difficulty 2); Fibonacci-like or ×a+b (difficulty 3). | 5 numeric options near the answer. |
| **huvudrakning** | Mixed-sign `+ − × ÷` with integer results, and magnitude scaled by difficulty. | 5 options. |
| **talsamband** | 3 pairs x→f(x) with `f = a·x + b`, and the question asks f of a 4th x. | 5 options. |

- [ ] **Step 1:** Write the property tests. For every generator, difficulties 1–3 and seeds 1–500:
  - The options are pairwise distinct (deep-equal for figures, string-equal for numbers).
  - `correct` is in range, and the option count equals `SUBTYPES[subtype].optionCount`.
  - `generate` is deterministic for the same arguments.
  - `rotation`: exactly one option is rotation-equivalent to the target.
  - `udda_figur`: exactly one option is not rotation-equivalent to the other four.
  - `matris`: the answer satisfies the row rule recomputed independently in the test, and no distractor does.
  - `svg.test`: `renderFigure` returns a string starting with `<svg` for every figure spec produced by seeds 1–50.
- [ ] **Step 2:** Run `npm test` and expect FAIL.
- [ ] **Step 3:** Implement `poly.js` (`rotate90`, `mirror`, `normalize`, `canonicalRot`, `isChiral`, `randomPolyomino(rand, n)`), the generators and `svg.js`.
- [ ] **Step 4:** Run `npm test` and expect PASS.
- [ ] **Step 5:** Commit with message `feat: seeded figure and number generators with svg rendering`.

### Task 5: Bank format, validator, engine

**Files:**
- Create: `js/bank.js`, `js/engine.js`, `tools/validate.js`, `bank/index.json`, `tests/bank.test.js`, `tests/engine.test.js`
- Modify: `package.json` (add `"validate": "node tools/validate.js"`)

**Interfaces:**
- Consumes: `generate`, `SUBTYPES`, `AREAS`, `shuffle`/`mulberry32`, and `weights` from Task 3.
- Produces:
  - `validateQuestion(q) -> string[]` (empty means valid). It checks:
    - the required fields
    - that the subtype is known and its area matches
    - that `correct` is in range
    - unique options
    - the option count for the subtype
    - for `syllogism`, options deep-equal to `["Sant","Falskt","Möjligt","Osannolikt"]`
    - non-empty `explanation`
  - `loadBank(fetchImpl=fetch) -> Promise<Question[]>`, which reads `bank/index.json` and then each file.
  - `MODES = {full:{count:80,timeLimitS:1800}, quick:{count:20,timeLimitS:450}, weak:{count:20,timeLimitS:null}, drill:{count:15,timeLimitS:null}}`.
  - `buildRound({mode, bank, seed, subtypeWeights?, filter? /*{area}|{subtype}*/, recentIds? /*Set*/}) -> Question[]`.

**`buildRound` behaviour:**
- `full` and `quick` take an equal quota per area: 16 per area for full, and 4 per area for quick.
- Within an area, subtypes are spread round-robin.
- Generated subtypes call `generate(name, seed', d)` with derived seeds.
- Bank questions in `recentIds` are avoided while unused ones remain.
- The order is the questions sorted into difficulty thirds (1s first, then 2s, then 3s), each third shuffled with areas interleaved.
- `weak` samples subtypes in proportion to `subtypeWeights`.
- `drill` is restricted to `filter`.
- No question id appears twice in one round.
- If a bank subtype runs out, top up from other subtypes in the same area.

**Steps:**
- [ ] **Step 1:** Write the tests.
  - `validateQuestion` rejects a syllogism with 3 options and a duplicate option, and accepts a well-formed fixture.
  - `buildRound({mode:'full'})` on a fixture bank (8 questions per bank subtype) gives 80 questions, exactly 16 per area, no duplicate ids, and a non-decreasing difficulty-third order.
  - `quick` gives 20 questions with 4 per area.
  - `drill` with `{subtype:'talserie'}` gives 15 questions, all talserie.
  - `weak` with weights `{syllogism: 10, others: 0.15}` gives at least 8 syllogisms out of 20 for seed 1.
- [ ] **Step 2:** Run `npm test` and expect FAIL.
- [ ] **Step 3:** Implement `bank.js`, `engine.js` and `tools/validate.js`.
  The validator runs `validateQuestion` on every file in `bank/index.json`, checks that ids are unique across files, prints per-subtype counts, and exits 1 on any error.
- [ ] **Step 4:** Run `npm test` and expect PASS.
- [ ] **Step 5:** Commit with message `feat: bank validation and round builder`.

### Task 6: Store and UI

**Files:**
- Create: `js/store.js`, `js/app.js`, `index.html`, `style.css`, `tests/store.test.js`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `load()` and `save(state)` for key `logik.v1`, with shape `{pass:string|null, resume: round|null, last:{metrics, mode, endedAt}|null, recentIds:string[] /*cap 400*/}`.
  - `setResume(state, round)` and `clearResume(state)`.

**Screens** (hash routing: `#home`, `#run`, `#results`, `#review`, `#trend`, `#drill`):

1. **Gate.** Shown when there is no stored pass. A passphrase field; `db.auth` must return true before the pass is saved.
2. **Home.**
   - A deadline countdown ("2 dagar 14 tim kvar till 29/10 kl 12").
   - The last result card.
   - "Fortsätt där du var" when `resume` is set.
   - Buttons: Fullt test (80 · 30 min), Snabbrunda (20 · 7½ min), Träna svagheter, Ämnesdrill.
   - The Strategi card. It covers the 22 s pace, skipping at about 30 s, not rereading, checking whether the real test lets her go back, and the meaning of Sant / Falskt / Möjligt / Osannolikt.
   - The outbox state ("3 svar väntar på uppladdning") when it is not empty.
3. **Run.**
   - A top bar with "Fråga n / N", a round countdown or a per-question target bar, and the area label hidden (as in the real test).
   - Prompt, figure and options labelled 1–5, with "S = hoppa över".
   - The stopwatch starts after the options are painted (`requestAnimationFrame` twice).
   - On answer or skip: `recordAnswer`/`recordSkip`, then `outbox.enqueue({type:'answers', sessionId, answers:[rec]})` and flush, then `setResume`, then the next question.
   - `visibilitychange` calls `stopwatch.hide`/`show` and pauses the round countdown.
   - Each 250 ms tick checks `remainingMs - elapsed <= 0`; when it is, call `timeUp`.
   - The session starts via the outbox item `{type:'start', session}`, and finishes via `{type:'finish', sessionId, summary}`.
4. **Results.**
   - Korrekt resonemang, Svarshastighet and Total andel korrekt.
   - `estLogik` with its label (full only), or the projected pace for other modes ("I den här takten hinner du X av 80 på 30 min").
   - A per-area table of % correct and median seconds against the 22 s goal.
   - Flags from `lt_history` stats ("Långsam men säker" / "Snabb men slarvig" / "Svag"), shown if the request succeeds.
   - Buttons: Genomgång, Hem.
5. **Review.** Wrong and skipped questions, with her answer, the right answer, the explanation and her seconds.
6. **Trend.** A table per session of date, mode, Svarshastighet, Korrekt resonemang and median seconds per area, from `db.history`.
7. **Drill.** Pick an area or subtype, then start `drill`. **Träna svagheter** calls `db.history`, then `subtypeStats`, then `weights`, then `buildRound({mode:'weak'})`. The target bar per question uses `targetSeconds(stats[subtype])`.

**Steps:**
- [ ] **Step 1:** Write `tests/store.test.js` with an in-memory storage shim.
  - `setResume` then `load` returns an equal round.
  - Corrupt JSON loads the defaults.
  - `recentIds` is capped at 400 (oldest dropped).
- [ ] **Step 2:** Run `npm test` and expect FAIL, then implement `store.js` and expect PASS.
- [ ] **Step 3:** Build `index.html`, `style.css` and `app.js` per the screens above.
  Use the system font stack and a max content width of about 760 px.
  The keyboard handler is ignored while the passphrase input has focus.
- [ ] **Step 4:** Verify in the preview (`logiktest`, port 4331).
  1. Gate with a wrong pass, then the right pass.
  2. A Snabbrunda answered by keyboard and mouse, with skips.
  3. Hide the tab for 10 s mid-question, and confirm that the stored `time_ms` excludes it.
  4. Reload mid-round and resume.
  5. Results and review.
  6. Check rows in `lt_answers` via `tools/stats.js`.
- [ ] **Step 5:** Commit with message `feat: app ui — gate, home, run, results, review, trend, drill`.

### Task 7: Question bank (parallel with Tasks 2–6)

**Files:**
- Create: `bank/logik.json`, `bank/sprak.json`, `bank/komplex.json`, `bank/matte.json`, and `tools/blind-check.js`

**Interfaces:**
- Consumes: the Question shape and `validateQuestion`.
- Produces: bank files that pass `npm run validate`.

**Counts:**
- First pass (Tuesday), at least 30 per area file, spread across subtypes and difficulties 1–3:
  - `logik`: syllogism, udda_ord, slutsats
  - `sprak`: synonym, motsats, ordbetydelse, grammatik, analogi
  - `komplex`: placering, rangordning, flerstegs
  - `matte` (hand-written only): procent_brak, textuppgift
- Second pass (Wednesday): logik, sprak and komplex reach 60 or more each, and matte reaches 40 or more.

**Content rules:**
- Correct, natural Swedish. Each question is solvable in 10–40 s with exactly one defensible answer.
- `explanation` is 1–2 sentences.
- Ids are `<area>-<subtype>-NNN`.
- No real JobMatch items.

**Steps:**
- [ ] **Step 1:** Writer agents, one per area file, author the questions. Run `npm run validate` and expect exit 0.
- [ ] **Step 2:** Implement `tools/blind-check.js <bank file> <solutions.json>`.
  `solutions.json` is `{id: chosenIndex}`. The tool prints every id where the solution ≠ `correct`, and exits 1 if there are any.
- [ ] **Step 3:** Fresh solver agents receive each file **with `correct` and `explanation` stripped** and return `{id: index}`.
  Run blind-check. Every disagreement is either fixed (key or wording) or the question is deleted.
- [ ] **Step 4:** Re-run validate and blind-check, and expect both to exit 0.
- [ ] **Step 5:** Commit with message `content: question bank (blind-verified)`.

### Task 8: Analysis CLI and deploy

**Files:**
- Create: `tools/stats.js`, `README.md`

**Interfaces:**
- `tools/stats.js` reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the environment. It queries `lt_answers` joined to `lt_questions` over REST and prints:
  - a per-subtype table (n, accuracy, median seconds, flag) over the last 3 sessions
  - a per-session trend

  It is run locally with the key exported from DigitalContentNu's `.env.local`.

**Steps:**
- [ ] **Step 1:** Implement `stats.js` reusing `subtypeStats`/`flags` from `js/metrics.js`. Run it against the test session data and expect a table.
- [ ] **Step 2:** Write the README: what the app is, how to run it, the bank format, how to add questions, and the analysis loop.
- [ ] **Step 3:** Run `npm test` and `npm run validate`, and expect both to pass.
- [ ] **Step 4:** Deploy.
  1. `gh repo create bengibson1951-bit/logiktest --public --source . --push`.
  2. Enable Pages from `main` root.
  3. Open `https://bengibson1951-bit.github.io/logiktest/` and run a Snabbrunda end-to-end.
- [ ] **Step 5:** Commit and push with message `docs: readme and stats cli`.

**After Task 8 (Wednesday):**
1. Run `stats.js` on the candidate's data.
2. Writer agents add targeted questions for her flagged subtypes.
3. Run blind-check, then validate.
4. Commit and push.
