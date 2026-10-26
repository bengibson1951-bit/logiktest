# Calibrate the app to LogiQ's speed

A 2026 JobMatch invitation's "logikdel" is almost certainly **JobMatch LogiQ**, not the old JobMatch Logic. LogiQ is a language-independent test with 40 or 60 items. It is split into **20-item subtests** (numerical, general or advanced logic, mathematics, complex problem solving) and scored on **correct answers per unit of time**. It has no hard time limit, but its reference times work out to about **15–30 seconds per item**. JobMatch publishes no real items for either test. The only concrete examples are the vendor's one-line descriptions of the old test's item types and JobTestPrep's imitation LogiQ items. Nothing public confirms that Unionen uses JobMatch at all, so the candidate's invitation is the only evidence of that. For Unionen's typical roles (ombudsman, facklig rådgivare, enhetschef), the most plausible versions are **"Qualified theoretical services"** (numerical + advanced logic + complex problem solving, 60 items, about 25 min) and **"Leadership"** (numerical + general logic + complex problem solving, 60 items, about 20 min). The app's current "Fullt test" (80 q / 30 min, five areas, Swedish syllogisms, language items) faithfully reproduces the **old** test. To match the test the candidate will most likely face, the app needs a LogiQ-style mode: three timed-but-uncapped 20-item blocks, mostly figural and numeric, with speed built into the score.

## Two generations of JobMatch test, one name

The old **JobMatch Logic** ("Logikanalys") is the test the app was modelled on. Its interpretation guide states **"Testet har 80 frågor totalt och är tidsbegränsat till 30 minuter"** and reports a **Logikvärde on a scale of 80–160**, correlated against Mensa Danmark. The estimated population mean is 100–105. The JobMatch database mean is 116, because most of its test-takers are white-collar applicants ([JobMatch Logic guide PDF](https://www.jobmatchtalent.com/wp-content/uploads/2018/11/JML-sample-sw.pdf)). The same guide gives the only vendor-authored item examples that exist:

- **Logiskt tänkande:** syllogisms judged as sant / falskt / möjligt / osannolikt, and odd-one-out words ("vatten, ånga, strand, is").
- **Logisk uppfattning:** 2D figures to be turned and flipped, explicitly not 3D. Averages are lower in this area.
- **Matematisk förmåga:** calculation and relations between numbers.
- **Språklig förmåga:** word understanding, grammar and vocabulary. Averages are higher in this area.
- **Komplex differentiering:** position chains such as "Om Lisa står till höger om Marko, som står till vänster om Erik, var står Sara?"

All five are from the same guide ([JML-sample-sw.pdf](https://www.jobmatchtalent.com/wp-content/uploads/2018/11/JML-sample-sw.pdf)). The test was **heavily speeded**:

- **Korrekt resonemang** is the share correct of items answered.
- **Svarshastighet** is the share of the 80 items reached.
- Multiplied together they give total percent correct. That averages **about 50%** in the JobMatch database and **about 30%** in the general population.

Most people therefore never finish, and the guide's reference to people having skipped questions in a category implies skipping was allowed ([JML-sample-sw.pdf](https://www.jobmatchtalent.com/wp-content/uploads/2018/11/JML-sample-sw.pdf)). The app's existing five areas, its Sant/Falskt/Möjligt/Osannolikt format and its 80 q / 30 min mode match this document closely.

That product is gone from the storefront. The 30-minute "JobMatch Logic" page was live until at least June 2021 ([Wayback 2021-06-21](https://web.archive.org/web/20210621105312/https://www.jobmatchtalent.com/sv/testlosningar/testverktyg/logik-och-begavningstest/)). By May 2022 the same slot sold **JobMatch LogiQ** ([Wayback 2022-05-25](https://web.archive.org/web/20220525135213/https://www.jobmatchtalent.com/sv/testlosningar/testverktyg/jobmatch-logiq/)). The 2026 tool list names Talent, Career, Screen, LogiQ and Lingua SE, with no Logic ([Testverktyg](https://www.jobmatchtalent.com/sv/testlosningar/testverktyg/)). JobMatch describes LogiQ as **adaptive**, **"inte tidsbegränsat"** and scored with time included, and says its tasks are **"språkoberoende"** with instructions in 31–32 languages ([LogiQ page, Wayback 2022](https://web.archive.org/web/20220525135213/https://www.jobmatchtalent.com/sv/testlosningar/testverktyg/jobmatch-logiq/)). **Language-independent is the single most consequential fact for calibration.** It means the vocabulary, grammar, synonym, word-analogy and probably the Swedish-syllogism items that make up a large part of the app's bank do not appear in LogiQ. JobMatch's homepage still lists "linguistic ability" among the things measured, but that copy appears to be inherited from the old product ([jobmatchtalent.com](https://www.jobmatchtalent.com/)).

Evidence on Unionen is entirely negative:

- No Unionen ad from 2025–2026 mentions JobMatch or any test.
- No JobMatch case study names a union.
- No Glassdoor or Indeed report describes Unionen's test step.

Sources: [jobb.unionen.se](https://jobb.unionen.se/), [JobMatch client testimonials](https://www.jobmatchtalent.com/clients/client-testimonials/). The phrase in the candidate's process ("JobMatch … testet inkl logikdelen") reads like JobMatch Talent (the personality test) plus a logic part. JobMatch's international partners sell exactly that bundle: "Jobmatch Talent and Jobmatch LogiQ" ([Cision 2024](https://mb.cision.com/Main/11841/4114694/3302596.pdf)). Inference: the logic part is LogiQ. One residual risk remains. A legacy customer could still have the old Logic enabled in JobMatch Center, which is unverified. That is the main argument for keeping the existing 80/30 mode rather than replacing it.

## LogiQ runs at 15–30 seconds per item

JobMatch's public example reports carry the only hard timing data for LogiQ. Each version uses **20-item subtests**. Every report shows, per subtest, the items answered, the items correct, and the candidate's time next to a reference time ([LogiQ example results](https://www.jobmatchtalent.com/en/jobmatch-logiq-example-result/)). The table below converts those reference times into seconds per item. The per-item figures are my own arithmetic.

| Version (likely Unionen fit) | Subtests | Total | Reference time per subtest | ≈ s/item |
|---|---|---|---|---|
| Qualified theoretical services (ombudsman, rådgivare, utredare) | Numerical, Advanced logic, Complex problem solving | 60 q, ~25 min, mean 110 | 5:30 / 10:00 / 9:15 | 16 / 30 / 28 |
| Leadership (enhetschef, teamchef) | Numerical, General logic, Complex problem solving | 60 q, ~20 min, mean 105 | 5:45 / 6:15 / 9:45 | 17 / 19 / 29 |
| General theoretical services (intake/admin) | Numerical, General logic | 40 q, ~10 min, mean 96 | 5:00 / 5:00 | 15 / 15 |
| Advanced technology and science (unlikely) | Mathematics, Advanced logic, Complex problem solving | 60 q, ~27 min, mean 116 | 8:00 / 10:00 / 9:00 | 24 / 30 / 27 |

The mapping of Unionen roles to versions is an inference. JobMatch does not publish a role-to-version table ([LogiQ example results](https://www.jobmatchtalent.com/en/jobmatch-logiq-example-result/)). The reports also show how speed is weighted:

- A version-5 candidate with **33 of 40 correct (83%)** took 15:25 against a 10:00 reference and scored **97**, roughly the group mean ([LogiQ example results](https://www.jobmatchtalent.com/en/jobmatch-logiq-example-result/)).
- A version-2 candidate answered only **55 of 60** items. In complex problem solving they answered only 15 of 20. So candidates can leave items unanswered, either through a skip function or a cutoff.

JobMatch's research papers explain the mechanism. Standardised scores are **"based upon the rate unit"**, meaning correct answers per unit of time, normed to M=100, SD=15 on about 1,000 people ([Jansson et al. 2022, CRPBS](https://www.jobmatchtalent.com/wp-content/uploads/2023/01/JobMatch-LogiQ-scientific-article-CRPBS-V3-22-1065.pdf)). Correctness and time-to-answer correlated **−0.60 to −0.89 per item**, except for mathematics items ([Archer et al. 2021, IJSCP](https://www.jobmatchtalent.com/wp-content/uploads/2023/01/JobMatch-LogiQ-Scientific-article-IJSCP2012JML.pdf)). "Untimed" therefore does not mean "take your time": slowness is penalised as surely as wrong answers. The old test's pace was 80 items in 30 minutes, or **22.5 s per item**, which falls inside the same band. Both generations reward fast, accurate work on short items. Neither looks like Matrigma's roughly 69 seconds per matrix ([practiceaptitudetests.com](https://www.practiceaptitudetests.com/testing-publishers/matrigma/)).

Difficulty has a published ordering. The mean proportion correct in the research sample, from easiest to hardest, ran **Numeric, Logic, Math, Complex**. Complex was the hardest and Numeric the easiest ([JAD 5(2) 2022](https://www.jobmatchtalent.com/wp-content/uploads/2023/01/JobMatch-LogiQ-scientific-study-JAD-5.2-3264.151.pdf)). JobMatch's report descriptions add some colour:

- Numerical understanding: "basic arithmetic".
- Mathematics: "more advanced mathematics".
- General logic: "draw logical conclusions".
- Advanced logic: "draw advanced logical conclusions".
- Complex problem solving: "grasp complex contexts".

Sources: [LogiQ example results](https://www.jobmatchtalent.com/en/jobmatch-logiq-example-result/). JobMatch publishes no adaptive algorithm. "Adaptive" may mean nothing more than picking one of the six versions; that is unconfirmed ([JAD 4(2) 2022](https://www.jobmatchtalent.com/wp-content/uploads/2023/01/JobMatch-LogiQ-scientific-study-JAD-4.2-2582-3264.pdf)).

## Imitation items point to arithmetic, matrices and moving figures

No candidate has publicly described a remembered LogiQ item. The one Flashback thread (November 2024) is a candidate complaining that no samples exist ([Flashback t3642193](https://www.flashback.org/t3642193)). The best proxy is JobTestPrep's LogiQ page. It says the logic section consists of **"bildserier, visuella associationer, matriser och spatiala frågor med riktningar"**, with language "sometimes" included. Its simulation has **20 numeric + 20 logic** items ([JobTestPrep JobMatch](https://www.jobtestprep.se/jobmatch-test)). Its five free samples, which are imitations rather than real items, set a useful difficulty anchor:

- **700 − (−350) = ?** (1050). Six numeric options.
- **x→f(x):** 4→12, 6→18, 8→24, 10→? (30).
- **Second-order series:** 3, 6, 10, 15, 21, 28, 36, ? (45).
- **3×3 matrix:** the figure changes and rotates 45° across each row, and changes without rotating down each column.
- **Figure series:** a circle and a square step clockwise and pause, while an X and an arrow do the reverse.

Each item is solvable in 10–40 seconds, which fits the reference times above. The app already covers the numeric samples, matrices and figure series. It lacks the two named categories that have no counterpart in its bank:

- **Visual associations** (figure analogies, A:B :: C:?). JobTestPrep's generic example swaps black and white while keeping the circle count ([JobTestPrep logiktest](https://www.jobtestprep.se/logiktest)).
- **Spatial questions with directions.** Their exact JobMatch form is undocumented. The old guide's "vända och vrida" figures and the Lisa/Marko position chains are the closest documented relatives ([JML-sample-sw.pdf](https://www.jobmatchtalent.com/wp-content/uploads/2018/11/JML-sample-sw.pdf)).

For the hardest band ("advanced logic" and "complex problem solving"), the comparable Swedish test Matrigma suggests what "hard" looks like. Its later items combine construction (A + B = C with selective overlay), frequency and rotation rules, some running along diagonals, plus objects rolling around a frame ([JobTestPrep Matrigma](https://www.jobtestprep.se/matrigma-test)). Treat this as a ceiling reference, not as evidence of LogiQ content.

## Prioritised calibration plan

The table below separates what the evidence supports from what is inferred. "E" marks a recommendation that follows directly from a cited fact. "I" marks one that rests on an inference.

| # | Action | Detail | Basis |
|---|---|---|---|
| 1 | **Add** a "LogiQ-simulering" mode | Three 20-item blocks shown in sequence, with no hard cap but a visible clock. Two presets: *Kvalificerad teoretisk* (Numerisk 5:30 → Avancerad logik 10:00 → Komplex 9:15) and *Ledarskap* (Numerisk 5:45 → Allmän logik 6:15 → Komplex 9:45). Allow skipping. | E (structure, reference times); I (preset choice for Unionen) |
| 2 | **Change scoring** in that mode to rate-based | Score = correct answers per minute, compared with the reference rate per block and mapped to an IQ-style scale (100 ± 15 around the preset's group mean). Show a report per block: answered, correct, your time against the reference time, mirroring JobMatch's report. | E |
| 3 | **Exclude language items** from LogiQ mode | Drop synonyms, antonyms, grammar, word analogies, odd-one-out words and text conclusions. Keep Swedish syllogisms out too, since LogiQ is language-independent. Keep all of them in "Fullt test" as the old-Logic simulation. | E (språkoberoende); I (syllogisms excluded) |
| 4 | **Add** figure analogies (visual associations) | A:B :: C:? with transformations such as colour swap, rotation, count kept or changed, and mirroring. Aim for 20–40 s per item at levels 1–3. | E (named category); I (format) |
| 5 | **Add** spatial-direction items | Compass and turn sequences ("facing north, right, right, left"), arrow chains where each arrow starts where the previous one pointed, and 2D rotate/mirror of an arrowed figure. 15–30 s per item. | E (category named); I (exact form) |
| 6 | **Re-weight** the numerical block toward speed | Mental arithmetic (negatives, fractions, %), x→f(x) and series, with a **15–17 s target**. Levels 1–2 dominate. Include some two-operation functions and second-order series at level 3 so the block is not trivially easy. | E (reference times, "basic arithmetic", "varies in difficulty") |
| 7 | **Build** a "Komplex problemlösning" block as the hardest | Multi-rule matrices (two or three rules at once, diagonal and construction/XOR overlays) plus multi-constraint seating, ranking and scheduling puzzles. About 28 s per item at the reference rate, so keep each puzzle solvable in under a minute. | E (Complex is the hardest scale, reference times); I (content) |
| 8 | **Map** levels 1–4 to norm groups | 1 ≈ general practical/theoretical (mean 85–96), 2 ≈ qualified practical/leadership (102–105), 3 ≈ qualified theoretical (110), 4 ≈ advanced tech/science (116). Default the Unionen preset to level 2–3 items, with about 20% level 4. | I |
| 9 | **Keep** "Fullt test" 80 q / 30 min unchanged in format | Keep it as the old-Logic simulation, with a per-area mix across the five areas and skipping allowed. Report Korrekt resonemang × Svarshastighet = total %, with a Logikvärde scale of 80–160. Calibrate so a strong candidate reaches about 60–70% of items; the JobMatch average total correct is about 50%. | E (80/30, scale, speed × accuracy); I (reach target) |
| 10 | **Retime** Snabbrunda and Utmaning | Snabbrunda (20 q / 7.5 min = 22.5 s) already matches the old pace, so keep it. Change Utmaning to 20 complex items at about 28–30 s each (about 10 min, already close), and make it rate-scored rather than a hard stop. | E (pace); I (mode design) |
| 11 | **Add** a mathematics block (optional) | Equation and algebra items for the *Advanced tech* and *Qualified practical* presets, 24 s per item. Low priority for Unionen roles. | E (Math reference 8:00/20); I (priority) |
| 12 | **Cut** emphasis on long reading-heavy items | Text-conclusion passages and long word problems do not fit 15–30 s items or a language-independent test. Keep at most a few word problems inside the numerical drills. | I |

Two uncertainties should shape how much weight the app puts on any of this:

- **The adaptive mechanism is unpublished.** The app should not imitate item-by-item adaptivity it cannot verify. Fixed blocks with rate scoring are what the reports actually show.
- **Whether candidates can go back to earlier items is undocumented.** Allowing skip-forward but not back-navigation is the safer practice setting.

## Conclusion

The app was built against the right document for the wrong era. Its five areas and its 80 q / 30 min mode track the old JobMatch Logic almost exactly. A 2026 candidate, however, will most likely face a test that strips out language entirely, measures in 20-item blocks, and turns time into score at roughly two to four items per minute. The highest-value change is therefore less about adding item types than about **practising speed under rate scoring**, with fast arithmetic and figural logic at about 15–20 s and complex multi-rule problems at about 30 s. Figure analogies and direction items fill the only two named content gaps.

The training implication for the candidate is concrete. On LogiQ, finishing an item slowly earns little more than skipping it. The habits to drill are fast first-pass solving, deliberate skipping of stuck items, and never idling on an untimed screen. The app's reports should make that trade-off visible after every block.
