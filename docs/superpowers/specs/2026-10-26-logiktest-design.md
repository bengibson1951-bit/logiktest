# Logikträning — design

Date: 2026-10-26 · Owner: Ben · User: Erika (Ben's partner, Swedish)

## 1. Intent and the why

Erika is in Unionen's interview process. Before the next interview she must take the
**JobMatch Logic** test (JobMatch Sweden AB) via a link, **deadline Thursday 2026-10-29 kl 12:00**.
She does fine on this kind of test but is **slow**, and JobMatch Logic is a speed test, so being slow costs her points.

We are building a small private training web app that simulates JobMatch Logic. It
**records the time spent on every question and the type of every question**, so Ben,
Erika and Claude can see exactly where her time and errors go and aim the next practice at those areas.

Success means that by Wednesday evening Erika has done several timed rounds. Her **answer pace
(Svarshastighet)** has gone up without her accuracy dropping, and she goes into the real test
knowing her weak question types and how to pace herself and when to skip.

### What we know about the real test (from JobMatch's own interpretation guide)

- **80 questions, 30 minutes** (about 22.5 s per question). Almost nobody finishes.
- Score **Logikvärde** on a scale of 80–160. The population average is about 100–105 and the JobMatch test-taker average is 116.
- Reported bars:
  - **Korrekt resonemang** = % correct of the questions answered.
  - **Svarshastighet** = % of all 80 questions answered.
  - **Total andel korrekt** = Svarshastighet × Korrekt resonemang. The JobMatch average is about 50% and the population about 30%.
  - Five sub-areas, each reported as % correct of all questions:
    - **Logiskt tänkande:** conclusions from verbal statements ("if A and B are true, is C true / false / possible / unlikely?") and odd-one-out words ("vatten, ånga, strand, is").
    - **Logisk uppfattning:** figures to turn and rotate, and patterns between figures. It is explicitly *not* 3D spatial.
    - **Matematisk förmåga:** calculations of various kinds and relationships between numbers.
    - **Språklig förmåga:** word understanding, grammar and vocabulary.
    - **Komplex differentiering:** multi-step reasoning with several variables ("Om Lisa står till höger om Marko, som står till vänster om Erik, var står Sara?").
- Taken in Swedish, on her **laptop**, in a browser.
- Unknown: the exact answer format, whether questions can be skipped or revisited, and whether the five types are mixed or in blocks. We assume **multiple choice, types mixed, skipping allowed**. The app tells Erika to read the real test's instructions carefully.

Source: https://www.jobmatchtalent.com/wp-content/uploads/2018/11/JML-sample-sw.pdf (2018 guide; it may have changed).

## 2. Goals

1. **A realistic simulation:** a full mock test of 80 mixed questions in 30 minutes, in Swedish, covering all five areas, with a visible countdown and a skip key.
2. **Timing per question:** for every question shown, store the time from display to answer or skip, in ms, accurate to tens of ms.
3. **A question type on every question:** an `area` (one of the five) and a finer `subtype` (see §5).
4. **Analysis after each round and over time:**
   - per area and per subtype: % correct, median seconds, number seen
   - Korrekt resonemang, Svarshastighet, Total andel korrekt
   - an **estimated** Logikvärde (heuristic, labelled as an estimate)
   - flags for "slow but accurate", "fast but sloppy" and "weak"
   - trend across sessions
5. **Targeted training:** a "Träna svagheter" mode that builds rounds weighted toward her weakest and slowest subtypes, and a per-subtype drill.
6. **A durable database** in Supabase holding every question shown, every session and every answer, so Ben and Claude can query it and Claude can write new targeted questions between her sessions.
7. **Usable by the evening of Tuesday 2026-10-27**, so she gets at least one full day of practice before the deadline.

## 3. Non-goals

- The JobMatch Talent personality test.
- Any AI calls or API keys in the app. New questions are written by Claude in conversation and added to the bank, the same pattern as Pluggquiz.
- User accounts or multiple users. There is one user, Erika.
- A phone layout. It must not break on a phone, but the target is a laptop.
- Copying real JobMatch questions. We only imitate the published question types.
- An offline PWA or app-store packaging.

## 4. Anti-goals (failure even if it "works")

- **Wrong answer keys.** A bad key teaches her wrong and erodes her trust. Every hand-written
  question needs a verified answer and a short Swedish explanation (see §8).
- **Timing that includes idle time.** If the tab is hidden or the laptop sleeps, that time must not count as "slow".
- **Touching DigitalContentNu's data.** We share its Supabase project, so everything we add must be prefixed and
  isolated. No changes to existing tables, policies, auth or storage.
- **Leaking the service-role key.** It must never be in the browser or the repo.
- **Making her more anxious than the real thing.** Feedback is factual and encouraging, with no red-alarm UI.
- **Losing answers** because of a network hiccup.

## 5. Question content

**Language:** Swedish only, UI included.
**Format:** multiple choice with 4 or 5 options (the number depends on the subtype). The exception is `syllogism`, which always has the 4 fixed options **Sant / Falskt / Möjligt / Osannolikt**, matching the wording in the JobMatch guide (Claude's call). "Möjligt" means the statements allow it but don't prove it. "Osannolikt" means the statements make it unlikely but don't rule it out. These meanings are explained once on the Strategi card. Answers are given with the mouse or keys **1–5**, and **S** or **→** skips.
Each question also has a **difficulty from 1 to 3** and a **one- or two-sentence Swedish explanation** shown in the review.

| Area (`area`) | Subtypes (`subtype`) | Source |
|---|---|---|
| `logik` — Logiskt tänkande | `syllogism` (Sant / Falskt / Möjligt / Osannolikt), `udda_ord` (odd one out), `slutsats` (which conclusion follows from a short text) | hand-written bank |
| `uppfattning` — Logisk uppfattning | `matris` (3×3, find the missing cell), `figurserie` (next in series), `rotation` (which option is the same figure rotated, not mirrored), `udda_figur` (odd figure) | **generated by code**, as SVG |
| `matte` — Matematisk förmåga | `huvudrakning`, `talserie`, `procent_brak`, `textuppgift`, `talsamband` (4→12, 6→18 …) | `talserie`, `huvudrakning` and `talsamband` generated; the rest hand-written |
| `sprak` — Språklig förmåga | `synonym`, `motsats`, `ordbetydelse`, `grammatik` (correct form or word), `analogi` (hund : valp = katt : ?) | hand-written bank |
| `komplex` — Komplex differentiering | `placering` (row and seat order), `rangordning` (taller than, older than), `flerstegs` (multi-step with several conditions) | hand-written bank; `rangordning` can be generated |

- **Hand-written bank size:** at least 60 questions per area that is mainly hand-written (logik, språk, komplex),
  and at least 40 hand-written matte questions. That is about **220–280 questions**, so a few full tests don't repeat much.
  Generated subtypes are unlimited.
- **Generated questions** are deterministic from `(generator, seed, difficulty)`, so a stored question can be rebuilt exactly for review.
- **Full-test area mix:** 16 questions from each area, shuffled, with difficulty rising gently through the test.
  The real test's mix is unknown, so this is an assumption.

## 6. Modes

1. **Fullt test:** 80 questions, 30:00, mixed, mimics the real test. Ends at 80 questions or when time runs out.
2. **Snabbrunda:** 20 questions in 7:30, mixed. The daily warm-up.
3. **Träna svagheter:** 20 questions with no total clock but a per-question **target time** shown as a subtle bar (starts at 22 s).
   Subtypes are picked by weakness weight (see §7). The target tightens as she gets faster in that subtype.
4. **Ämnesdrill:** pick one area or subtype, 15 questions, per-question target bar.

After every round:
- the **results screen** (§7)
- **Genomgång:** each wrong or skipped question with her answer, the right answer, the explanation and her time.

**Home screen:**
- the last result
- a "Fortsätt där du var" option if a round was interrupted mid-way
- the four mode buttons
- a short **Strategi** card:
  - 22 s per question pace
  - skip when stuck after about 30 s
  - don't reread
  - read the real test's instructions about skipping and going back
- the **days and hours left to the deadline**

## 7. Timing and analysis

**Timing:**
- The clock starts when the question is fully rendered (after the SVG is drawn) and stops on answer or skip, using `performance.now()`.
- Time while the page is hidden (`visibilitychange`) is subtracted and stored as `paused_ms`.
- Round clocks (Fullt test, Snabbrunda) **pause** while the page is hidden, and the session records `paused_total_ms`.
- **One click or key submits and moves on at once** (Claude's call). There is no separate confirm step, which builds the fastest rhythm. There is therefore no `changes` column.
- **A skip is final within the round** (Claude's call). Each question is shown exactly once per round, at one `position`. This trains the "let it go and move on" habit, and the Strategi card tells her to check whether the real test lets her go back.

**Per-round metrics** (shown on the results screen and stored on the session):
- *Korrekt resonemang* = correct / answered
- *Svarshastighet* = answered / total in the round
- *Total andel korrekt* = correct / total
- for each area: % correct of those shown, median seconds, count

**Estimated Logikvärde:** applies to Fullt test only. Map *Total andel korrekt* onto the 80–160 scale with linear anchors at 30% → 103 and 50% → 116, clamped to 80–160.
- It is labelled "Uppskattning – inte JobMatch-poäng".
- For shorter rounds the app shows the pace that **projects** to 80 questions in 30 minutes instead of a score.

**Subtype flags**, computed over her last 3 sessions, only when the subtype has at least 5 answers:
- "Långsam men säker": accuracy ≥ 75% and median > 30 s
- "Snabb men slarvig": accuracy < 60% and median < 15 s
- "Svag": accuracy < 60%

**Weakness weight** for Träna svagheter, per subtype:
`w = (1 - accuracy) + max(0, median_s - 22) / 22`, minimum 0.15. Subtypes with no data get 1.0.
These thresholds and formulas are starting points, and the builder may tune them.

**Trend view:** a simple line or table per session showing Svarshastighet, Korrekt resonemang, and the median time per area over time.

## 8. Correctness of the bank

- The bank lives in the repo as JSON files: `bank/<area>.json`.
- Each entry has `id`, `area`, `subtype`, `difficulty`, `prompt`, `options[]`, `correct` (index), `explanation`, and optional `figure` data.
- `npm run validate` checks:
  - the schema
  - unique ids
  - `correct` is in range
  - no duplicate options
  - the option count matches the subtype
- **Every hand-written question is independently re-solved** by a second pass (a separate agent solving it blind) before it ships. Disagreements are fixed or the question is dropped.
- Generators have unit tests proving the marked answer is the only valid one. For example, a `rotation` question has exactly one non-mirrored match.

## 9. Database (Supabase)

**Project:** the existing **DigitalContentNu** project (`xrtvvmvmueafdbdhuwqt.supabase.co`). Ben approved sharing it.

**Isolation:**
- All objects are prefixed **`lt_`**, in `public`.
- One migration file lives in this repo (`supabase/001_logiktest.sql`), not in DigitalContentNu's migrations folder.
- **RLS is enabled on every `lt_` table, with no policies for `anon` or `authenticated`.**
- All browser access goes through `SECURITY DEFINER` RPC functions that check a **passphrase**. The passphrase hash is stored in `lt_config`.
- The browser holds only the project URL and the **anon key**, which are already public by design, plus the passphrase Erika types once. The passphrase is remembered in `localStorage`.

**Tables:**
- `lt_questions(id text pk, area, subtype, difficulty, source 'bank'|'generated', generator, seed, prompt, options jsonb, correct int, explanation, figure jsonb, created_at)`
  - The browser sends a snapshot of each question with the answer, and the RPC upserts it.
  - The table therefore always contains exactly what she saw, including generated questions.
- `lt_sessions(id uuid pk, mode, filter, started_at, ended_at, time_limit_s, paused_total_ms, total, answered, correct, metrics jsonb, client_version)`
- `lt_answers(id uuid pk, session_id fk, question_id fk, position int, chosen int null, is_correct bool null, skipped bool, time_ms int, paused_ms int, changes int, answered_at)`
  - The pair `(session_id, position)` is unique, which makes answer uploads safe to retry.
- `lt_config(key text pk, value text)`, holding the passphrase hash.

**RPCs:**
- `lt_auth(pass)` checks the passphrase.
- `lt_start_session(pass, …)`
- `lt_record_answers(pass, session_id, answers jsonb)` handles a batch and upserts the questions too.
- `lt_finish_session(pass, session_id, metrics)`
- `lt_stats(pass)` returns per-subtype aggregates for flags, weights and trend.

**Resilience:**
- Each answer is written first to a local outbox in `localStorage`.
- The outbox is flushed after every answer, and retried with backoff until confirmed.
- The results screen is computed locally, so it works even if the network is down.

**Applying the migration:**
- Ben pastes the SQL into the Supabase SQL editor, or Claude runs it if a database connection is available.
- The **seed and admin scripts** (for example, sending bank questions up front, or a `stats` CLI for Claude) use the service-role key read from DigitalContentNu's `.env.local` locally, and are never committed.

**Claude's analysis loop:**
- Between her sessions, Claude queries `lt_answers` joined to `lt_questions` to find weak or slow subtypes.
- Claude then writes new questions for those subtypes into `bank/`, validates them, has them blind re-solved, and deploys.

## 10. Platform and hosting (Claude's call, following Ben's other apps)

- Plain static HTML, CSS and ES-module JavaScript, with no framework and no build step. This is the same pattern as Pluggquiz, Math Sprint and Flashcards.
- The Supabase client is called with plain `fetch` to `/rest/v1/rpc/...`, so no SDK is needed.
- Pure logic lives in testable modules (`engine.js`, `metrics.js`, `generators/*.js`, `bank.js`), tested with `node:test` via `npm test`.
- New folder `Bright Blue Project - Event/logiktest` as its own git repo. Preview entry `logiktest` on **port 4331** in the parent `.claude/launch.json`.
- Hosted on GitHub Pages: `bengibson1951-bit/logiktest`. The URL is shared only with Erika.
- The repo is public, like the other apps. The bank being visible is acceptable, but no keys beyond the anon key go in it.
- Laptop-first layout: large readable question area, keyboard shortcuts shown, a calm neutral visual style, and a countdown that is visible but not alarming.

## 11. Delivery order (to meet the deadline)

1. **By the evening of Tuesday 2026-10-27, the minimum usable version:**
   - Fullt test and Snabbrunda
   - all five areas with an initial bank of at least 30 per hand-written area, plus the generators
   - timing and results screen, Genomgång
   - Supabase writes, and deployed
2. **Wednesday 2026-10-28:**
   - Träna svagheter, Ämnesdrill, trend view
   - the bank expanded to its full size
   - the first round of Claude-written targeted questions, based on her data
3. Erika should take the **real test by Wednesday evening or Thursday morning at the latest**, well before 12:00.

## 12. Left to the builder

- Exact visual design, SVG figure styles and the shape vocabulary for the generators.
- How difficulty maps to generator parameters.
- Exact wording of UI copy (in Swedish).
- Tuning the flag thresholds and the weakness formula after seeing real data.
