// UI wiring: gate → home → run → results / review, plus statistik and ämnesdrill.

import { SUPABASE_URL, SUPABASE_ANON_KEY, DEADLINE_ISO } from "./config.js";
import { AREAS, AREA_LABELS, SUBTYPES, subtypesOf } from "./taxonomy.js";
import { createDb } from "./db.js";
import { createOutbox } from "./outbox.js";
import { loadBank } from "./bank.js";
import { MODES, buildRound, buildLogiq, LOGIQ_VERSIONS, LOGIQ_AREAS } from "./engine.js";
import { newRound, recordAnswer, recordSkip, timeUp } from "./round.js";
import { createStopwatch } from "./timer.js";
import { roundMetrics, subtypeStats, flags, weights, targetSeconds, blockMetrics, overallEfficiency, FLAG_LABELS, TARGET_S } from "./metrics.js";
import { renderFigure, renderCell } from "./svg.js";
import { load, save, setResume, clearResume, addRecent } from "./store.js";
import { PROMPTS, TALENT_HTML, loadNotes, saveNote } from "./talent.js";

const CLIENT_VERSION = "1.5.0";
const SKIP_NUDGE_MS = 30000;
const app = document.getElementById("app");
const db = createDb({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY });
const state = load();
let bank = [];
let lastRound = null;     // finished round shown on results/review
let liveStats = null;     // subtype stats used for per-question targets this round

// ---------- uploads ----------
const outbox = createOutbox({
  storage: localStorage,
  send: async (item) => {
    if (item.type === "start") return db.startSession(state.pass, item.session);
    if (item.type === "answers") return db.recordAnswers(state.pass, item.sessionId, item.answers);
    if (item.type === "finish") return db.finishSession(state.pass, item.sessionId, item.summary);
  },
});
let retryDelay = 2000, retryTimer = null;
async function flush() {
  clearTimeout(retryTimer);
  await outbox.flush();
  updateOutboxNote();
  if (outbox.size()) {
    retryTimer = setTimeout(flush, retryDelay);
    retryDelay = Math.min(60000, retryDelay * 2);
  } else retryDelay = 2000;
}
function updateOutboxNote() {
  const el = document.getElementById("outbox-note");
  if (el) el.textContent = outbox.size() ? `${outbox.size()} uppladdningar väntar (sparas lokalt tills nätet fungerar).` : "";
}
window.addEventListener("online", flush);

// ---------- helpers ----------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const pct = (x) => `${Math.round((x ?? 0) * 100)} %`;
const secs = (x) => (x == null ? "–" : `${x.toFixed(1).replace(".", ",")} s`);
const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const optionHtml = (o) => (typeof o === "string" ? esc(o) : renderCell(o, 72));
let keyHandler = null;
let tickTimer = null;
function screen(html, onKey = null) {
  clearInterval(tickTimer);
  keyHandler = onKey;
  app.innerHTML = html;
  window.scrollTo(0, 0);
}
document.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.ctrlKey || e.metaKey || e.altKey) return;
  keyHandler?.(e);
});

// ---------- gate ----------
function showGate(msg = "") {
  screen(`
    <div class="card">
      <h1>Logikträning</h1>
      <p class="muted">Ange lösenordet för att börja.</p>
      <form id="gate" class="row">
        <input type="password" id="pass" autocomplete="current-password" autofocus />
        <button class="primary" type="submit">Fortsätt</button>
      </form>
      <p class="err small">${esc(msg)}</p>
    </div>`);
  document.getElementById("gate").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pass = document.getElementById("pass").value;
    try {
      if (await db.auth(pass)) {
        state.pass = pass;
        save(state);
        flush();
        showHome();
      } else showGate("Fel lösenord.");
    } catch {
      showGate("Kunde inte nå servern. Kontrollera nätet och försök igen.");
    }
  });
}

// ---------- home ----------
function deadlineText() {
  const ms = new Date(DEADLINE_ISO) - Date.now();
  if (ms <= 0) return "Deadline för testet har passerat.";
  const h = Math.floor(ms / 3600000);
  return `${Math.floor(h / 24)} dagar ${h % 24} tim kvar till testets deadline (29/10 kl 12).`;
}

function showHome() {
  const last = state.last;
  const r = state.resume;
  screen(`
    <div class="row spread"><h1>Logikträning</h1><span class="pill">${esc(deadlineText())}</span></div>
    <p class="muted">Träning inför JobMatch LogiQ: figurer, tal och problemlösning – där tiden räknas.</p>
    ${r ? `<div class="card"><div class="row spread"><div><strong>Fortsätt där du var</strong><br><span class="muted small">${esc(MODES[r.mode].label)} · fråga ${r.position + 1} av ${r.questions.length}${r.remainingMs != null ? ` · ${mmss(r.remainingMs)} kvar` : ""}</span></div>
      <div class="row"><button id="discard" class="link">Släng</button><button id="resume" class="primary">Fortsätt</button></div></div></div>` : ""}
    ${last ? `<div class="card"><div class="row spread"><strong>Senaste: ${esc(MODES[last.mode].label)}</strong><span class="muted small">${new Date(last.endedAt).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}</span></div>
      <div class="grid2" style="margin-top:10px">
        <div><div class="stat">${pct(last.metrics.hastighet)}</div><div class="stat-label">Svarshastighet</div></div>
        <div><div class="stat">${pct(last.metrics.korrekt)}</div><div class="stat-label">Korrekt resonemang</div></div>
        <div><div class="stat">${secs(last.metrics.medianS)}</div><div class="stat-label">Median per fråga (mål ${TARGET_S} s)</div></div>
      </div></div>` : ""}
    <div class="grid2">
      <button class="big primary-card" id="logiq"><strong>LogiQ-simulering</strong><span class="muted small">3 block × 20 frågor · tiden räknas · närmast det riktiga testet</span></button>
      <button class="big" data-mode="quick"><strong>Snabbrunda</strong><span class="muted small">20 frågor · 7½ min · figurer, tal och problemlösning</span></button>
      <button class="big" data-mode="weak"><strong>Träna svagheter</strong><span class="muted small">20 frågor från dina långsammaste och svagaste typer</span></button>
      <button class="big" data-mode="challenge"><strong>Utmaning</strong><span class="muted small">20 svåra frågor · 10 min · avancerad logik</span></button>
      <button class="big" id="drill"><strong>Ämnesdrill</strong><span class="muted small">Välj en frågetyp och nöt den</span></button>
    </div>
    <p style="margin-top:12px" class="row spread"><span class="row"><button class="link" id="stats">Statistik och utveckling →</button><button class="link" id="talent">Förbered JobMatch Talent →</button></span>
      <button class="link muted small" data-mode="full">Gammalt format: JobMatch Logic, 80 frågor · 30 min (inkl. språk)</button></p>
    <div class="card">
      <h2>Strategi inför JobMatch LogiQ</h2>
      <ul class="tips">
        <li><strong>Tiden räknas in i poängen.</strong> Det finns ingen tidsgräns, men poängen bygger på rätta svar per tidsenhet. Snabbt och rätt slår långsamt och perfekt.</li>
        <li><strong>Takt:</strong> ca 15–17 s per fråga i det numeriska blocket, ca 20–30 s i logik och komplex problemlösning.</li>
        <li><strong>Fastnar du?</strong> Gissa smart eller hoppa – en fråga som tar tre minuter sänker poängen mer än ett fel.</li>
        <li><strong>Inga pauser</strong> mitt i riktiga testet. Gör det utvilad, ostörd och med laddad dator.</li>
        <li><strong>Läs instruktionerna</strong> innan du startar: antal frågor, och om man kan gå tillbaka.</li>
        <li>JobMatch Talent (personlighetstestet) har inga rätta svar – svara ärligt och utan att övertänka.</li>
        <li>Här: tangenterna <strong>1–5</strong> svarar direkt, <strong>S</strong> eller <strong>→</strong> hoppar över.</li>
      </ul>
    </div>
    <p id="outbox-note" class="muted small"></p>`);
  updateOutboxNote();
  app.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => startMode(b.dataset.mode)));
  document.getElementById("drill").addEventListener("click", showDrillPicker);
  document.getElementById("logiq").addEventListener("click", showLogiqPicker);
  document.getElementById("stats").addEventListener("click", showStats);
  document.getElementById("talent").addEventListener("click", showTalent);
  document.getElementById("resume")?.addEventListener("click", () => runRound(state.resume));
  document.getElementById("discard")?.addEventListener("click", () => {
    if (!confirm("Släng den pågående rundan? Svaren du redan gett är sparade.")) return;
    clearResume(state); save(state); showHome();
  });
}

// ---------- start ----------
async function fetchStats() {
  const h = await db.history(state.pass, 20);
  return subtypeStats(h.answers ?? []);
}

async function startMode(mode, filter = null) {
  let subtypeWeights = null;
  liveStats = null;
  if (mode === "weak" || mode === "drill") {
    try { liveStats = await fetchStats(); } catch { liveStats = {}; }
    if (mode === "weak") subtypeWeights = weights(liveStats);
  }
  const seed = Math.floor(Math.random() * 2 ** 31);
  const recentIds = new Set(state.recentIds);
  let questions, blocks = null;
  if (mode === "logiq") ({ questions, blocks } = buildLogiq({ version: filter.version, bank, seed, recentIds }));
  else questions = buildRound({ mode, bank, filter, subtypeWeights, seed, recentIds });
  const round = newRound({
    sessionId: crypto.randomUUID(), mode, filter, questions,
    timeLimitS: MODES[mode].timeLimitS, startedAt: new Date().toISOString(),
  });
  if (blocks) { round.blocks = blocks; round.blockAck = 0; }
  outbox.enqueue({
    type: "start",
    session: { id: round.sessionId, mode, filter, startedAt: round.startedAt, timeLimitS: round.timeLimitS, total: questions.length, clientVersion: CLIENT_VERSION },
  });
  flush();
  setResume(state, round);
  save(state);
  runRound(round);
}

function showLogiqPicker() {
  screen(`
    <p><button class="link" id="back">← Tillbaka</button></p>
    <h1>LogiQ-simulering</h1>
    <p>Det här liknar troligen det riktiga testet: <strong>3 block med 20 frågor</strong>, utan språkfrågor. Det finns ingen tidsgräns, men <strong>tiden räknas in i poängen</strong> – snabba och rätta svar ger mest. Varje block jämförs med JobMatchs referenstid.</p>
    <p class="muted small">Blocken bygger på JobMatchs publicerade resultatexempel. Vilken version Unionen använder vet vi inte – välj den som passar tjänsten.</p>
    ${Object.entries(LOGIQ_VERSIONS).map(([k, v]) => `
      <div class="card"><div class="row spread"><div><strong>${esc(v.label)}</strong><br><span class="muted small">${esc(v.hint)} · ${v.blocks.map(([b, s]) => `${esc(BLOCK_LABELS[b])} (${mmss(s * 1000)})`).join(" · ")}</span></div>
      <button class="primary" data-version="${k}">Starta</button></div></div>`).join("")}`);
  document.getElementById("back").addEventListener("click", showHome);
  app.querySelectorAll("[data-version]").forEach((b) => b.addEventListener("click", () => startMode("logiq", { version: b.dataset.version })));
}

const BLOCK_LABELS = { numeric: "Numerisk förståelse", general: "Generell logik", advanced: "Avancerad logik", complex: "Komplex problemlösning" };
const blockAt = (round, pos) => round.blocks?.findIndex((b) => pos >= b.start && pos < b.start + b.count) ?? -1;
const blockElapsedMs = (round, bi) => round.answers.filter((a) => blockAt(round, a.position) === bi).reduce((s, a) => s + a.timeMs, 0);

function showDrillPicker() {
  screen(`
    <p><button class="link" id="back">← Tillbaka</button></p>
    <h1>Ämnesdrill</h1>
    <p class="muted">15 frågor av en typ, med en tidsmålstapel per fråga.</p>
    ${[...LOGIQ_AREAS, ...AREAS.filter((x) => !LOGIQ_AREAS.includes(x))].map((a) => `
      <div class="card"><div class="row spread"><h2 style="margin:0">${esc(AREA_LABELS[a])}${LOGIQ_AREAS.includes(a) ? "" : ` <span class="pill">gammalt format</span>`}</h2><button data-area="${a}">Hela området</button></div>
      <div class="row" style="margin-top:10px">${subtypesOf(a).map((s) => `<button data-sub="${s}">${esc(SUBTYPES[s].label)}</button>`).join("")}</div></div>`).join("")}`);
  document.getElementById("back").addEventListener("click", showHome);
  app.querySelectorAll("[data-area]").forEach((b) => b.addEventListener("click", () => startMode("drill", { area: b.dataset.area })));
  app.querySelectorAll("[data-sub]").forEach((b) => b.addEventListener("click", () => startMode("drill", { subtype: b.dataset.sub })));
}

// ---------- run ----------
function runRound(round) {
  const stopwatch = createStopwatch();
  let locked = true;
  const timed = round.remainingMs != null;

  const onVis = () => (document.hidden ? stopwatch.hide() : stopwatch.show());
  document.addEventListener("visibilitychange", onVis);
  const cleanup = () => document.removeEventListener("visibilitychange", onVis);

  function show() {
    if (round.done) { cleanup(); return finishRound(round); }
    const bi = blockAt(round, round.position);
    if (bi > 0 && round.blockAck !== bi) return blockBreak(bi);
    const q = round.questions[round.position];
    const figs = q.options.some((o) => typeof o !== "string");
    const block = bi >= 0 ? round.blocks[bi] : null;
    const target = block ? Math.round(block.refS / block.count) : targetSeconds(liveStats?.[q.subtype]);
    screen(`
      <div class="topbar">
        <span>${block ? `Block ${bi + 1}/${round.blocks.length} · ${esc(block.label)} · ${round.position - block.start + 1}/${block.count}` : `Fråga ${round.position + 1} / ${round.questions.length}`}</span>
        ${timed ? `<span class="clock" id="clock">${mmss(round.remainingMs)}</span>` : block ? `<span><span class="clock" id="bclock">${mmss(blockElapsedMs(round, bi))}</span> <span class="small">/ ref ${mmss(block.refS * 1000)}</span></span>` : `<span class="small">Mål: ${target} s</span>`}
        <button class="link" id="pause">Pausa</button>
      </div>
      ${timed ? "" : `<div class="target" id="target"><div></div></div>`}
      <div class="card">
        <div class="prompt">${esc(q.prompt)}</div>
        ${q.figure ? `<div class="figure">${renderFigure(q.figure)}</div>` : ""}
        <div class="options ${figs ? "figs" : ""}">
          ${q.options.map((o, i) => `<button class="opt" data-i="${i}"><span class="key">${i + 1}</span><span>${optionHtml(o)}</span></button>`).join("")}
        </div>
        <div class="skiprow"><span class="muted small" id="hint">Tangent 1–${q.options.length} svarar · S hoppar över</span><button id="skip">Hoppa över →</button></div>
      </div>`,
      (e) => {
        const n = Number(e.key);
        if (n >= 1 && n <= q.options.length) { e.preventDefault(); answer(n - 1); }
        else if (e.key === "s" || e.key === "S" || e.key === "ArrowRight") { e.preventDefault(); answer(null); }
      });
    app.querySelectorAll(".opt").forEach((b) => b.addEventListener("click", () => answer(Number(b.dataset.i))));
    document.getElementById("skip").addEventListener("click", () => answer(null));
    document.getElementById("pause").addEventListener("click", () => {
      cleanup();
      save(state);
      showHome();
    });
    // Start timing once the question is actually painted.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      stopwatch.start();
      if (document.hidden) stopwatch.hide();
      locked = false;
      tickTimer = setInterval(() => tick(target), 250);
    }));
  }

  function blockBreak(bi) {
    const prev = round.blocks[bi - 1], next = round.blocks[bi];
    const go = () => { round.blockAck = bi; save(state); show(); };
    screen(`
      <div class="card">
        <h2>Block ${bi} klart</h2>
        <p>${esc(prev.label)}: ${mmss(blockElapsedMs(round, bi - 1))} (referens ${mmss(prev.refS * 1000)}).</p>
        <p>Nästa: <strong>${esc(next.label)}</strong>, ${next.count} frågor, referenstid ${mmss(next.refS * 1000)}. Klockan startar när du fortsätter.</p>
        <button class="primary" id="go">Fortsätt (Enter)</button>
      </div>`, (e) => { if (e.key === "Enter") go(); });
    document.getElementById("go").addEventListener("click", go);
  }

  function tick(target) {
    const { timeMs } = stopwatch.read();
    const bi = blockAt(round, round.position);
    if (bi >= 0) {
      const el = document.getElementById("bclock");
      if (el) el.textContent = mmss(blockElapsedMs(round, bi) + timeMs);
      const hint = document.getElementById("hint");
      if (hint && timeMs > Math.max(SKIP_NUDGE_MS, target * 2000) && !hint.classList.contains("nudge")) {
        hint.classList.add("nudge");
        hint.textContent = "Långt över referenstakten – överväg att hoppa över (S). Tiden räknas in i poängen.";
      }
    }
    if (timed) {
      const left = round.remainingMs - timeMs;
      const el = document.getElementById("clock");
      if (el) { el.textContent = mmss(left); el.classList.toggle("low", left < 60000); }
      // Gentle nudge: one stuck question costs more than a skipped one.
      const hint = document.getElementById("hint");
      if (hint && timeMs > SKIP_NUDGE_MS && !hint.classList.contains("nudge")) {
        hint.classList.add("nudge");
        hint.textContent = "Över 30 s – överväg att hoppa över (S) och ta poängen på nästa fråga.";
      }
      if (left <= 0) {
        locked = true;
        clearInterval(tickTimer);
        timeUp(round);
        save(state);
        cleanup();
        finishRound(round);
      }
    } else {
      const bar = document.getElementById("target");
      if (bar) {
        bar.firstElementChild.style.width = `${Math.min(100, (timeMs / 1000 / target) * 100)}%`;
        bar.classList.toggle("over", timeMs / 1000 > target);
      }
    }
  }

  function answer(i) {
    if (locked) return;
    locked = true;
    clearInterval(tickTimer);
    const times = stopwatch.read();
    const now = new Date().toISOString();
    const rec = i === null ? recordSkip(round, times, now) : recordAnswer(round, i, times, now);
    outbox.enqueue({ type: "answers", sessionId: round.sessionId, answers: [rec] });
    flush();
    save(state);
    show();
  }

  show();
}

function finishRound(round) {
  const total = round.questions.length;
  const metrics = roundMetrics(round.answers, total, { mode: round.mode });
  if (round.blocks) {
    metrics.blocks = blockMetrics(round.answers, round.blocks);
    metrics.efficiency = overallEfficiency(metrics.blocks);
  }
  outbox.enqueue({
    type: "finish",
    sessionId: round.sessionId,
    summary: { endedAt: new Date().toISOString(), pausedTotalMs: round.pausedTotalMs, answered: metrics.answered, correct: metrics.correct, metrics },
  });
  flush();
  addRecent(state, round.answers.map((a) => a.questionId).filter((id) => !id.startsWith("gen:")));
  state.last = { metrics, mode: round.mode, endedAt: new Date().toISOString() };
  clearResume(state);
  save(state);
  lastRound = round;
  showResults(round, metrics);
}

// ---------- results ----------
function areaTable(byArea) {
  return `<table><tr><th>Område</th><th class="num">Frågor</th><th class="num">Rätt</th><th class="num">Median</th><th></th></tr>
    ${AREAS.filter((a) => byArea[a]).map((a) => {
      const g = byArea[a];
      const slow = g.medianS != null && g.medianS > TARGET_S;
      return `<tr><td>${esc(AREA_LABELS[a])}</td><td class="num">${g.shown}</td><td class="num">${pct(g.pct)}</td><td class="num">${secs(g.medianS)}</td><td>${slow ? `<span class="pill warn">över ${TARGET_S} s</span>` : ""}</td></tr>`;
    }).join("")}</table>`;
}

function showResults(round, m) {
  const usedS = round.answers.reduce((s, a) => s + a.timeMs, 0) / 1000;
  const projected = usedS > 0 ? Math.min(80, Math.round((m.answered * 1800) / usedS)) : 0;
  screen(`
    <h1>Resultat – ${esc(MODES[round.mode].label)}</h1>
    <div class="card">
      <div class="grid2">
        <div><div class="stat">${pct(m.hastighet)}</div><div class="stat-label">Svarshastighet (${m.answered} av ${m.total} besvarade)</div></div>
        <div><div class="stat">${pct(m.korrekt)}</div><div class="stat-label">Korrekt resonemang (rätt av besvarade)</div></div>
        <div><div class="stat">${pct(m.totalAndel)}</div><div class="stat-label">Total andel korrekt</div></div>
        <div><div class="stat">${secs(m.medianS)}</div><div class="stat-label">Median per fråga (mål ${TARGET_S} s)</div></div>
      </div>
      ${m.estLogik != null
        ? `<p style="margin-top:14px"><strong>Logikvärde ≈ ${m.estLogik}</strong> <span class="muted small">Uppskattning – inte JobMatch-poäng. Snittet bland JobMatch-testade är 116.</span></p>`
        : m.blocks ? "" : `<p style="margin-top:14px">I den här takten hinner du <strong>ca ${projected} av 80</strong> frågor på 30 minuter.</p>`}
    </div>
    ${m.blocks ? blocksCard(m) : ""}
    <div class="card"><h2>Per område</h2>${areaTable(m.byArea)}</div>
    <div class="card" id="flags"><h2>Mönster över senaste passen</h2><p class="muted small">Hämtar…</p></div>
    <div class="row"><button class="primary" id="review">Genomgång</button><button id="home">Hem</button></div>
    <p id="outbox-note" class="muted small"></p>`);
  updateOutboxNote();
  document.getElementById("review").addEventListener("click", () => showReview(round));
  document.getElementById("home").addEventListener("click", showHome);
  // Server stats may lag behind the outbox; flush first so this round is included.
  outbox.flush().then(fetchStats).then((st) => {
    const el = document.getElementById("flags");
    if (el) el.innerHTML = `<h2>Mönster över senaste passen</h2>${flagsHtml(st)}`;
  }).catch(() => {
    const el = document.getElementById("flags");
    if (el) el.innerHTML = `<h2>Mönster över senaste passen</h2><p class="muted small">Kunde inte hämta statistik just nu.</p>`;
  });
}

function blocksCard(m) {
  return `<div class="card"><h2>LogiQ-block</h2>
    <p><strong>Effektivitet totalt: ${Math.round(m.efficiency * 100)} %</strong> <span class="muted small">= rätta svar per minut jämfört med alla rätt på referenstiden. I JobMatchs publicerade exempel motsvarade ca 55 % ungefär normgruppens snitt – en grov fingervisning, inte JobMatch-poäng.</span></p>
    <table><tr><th>Block</th><th class="num">Rätt</th><th class="num">Besvarade</th><th class="num">Din tid</th><th class="num">Referens</th><th class="num">Effektivitet</th></tr>
    ${m.blocks.map((b) => `<tr><td>${esc(b.label)}</td><td class="num">${b.correct}/${b.count}</td><td class="num">${b.answered}</td><td class="num">${mmss(b.timeS * 1000)}</td><td class="num">${mmss(b.refS * 1000)}</td><td class="num">${Math.round(b.efficiency * 100)} %</td></tr>`).join("")}
    </table></div>`;
}

function flagsHtml(st) {
  const f = flags(st);
  const keys = Object.keys(f);
  if (!keys.length) return `<p class="muted small">Inga tydliga svagheter ännu (kräver minst 5 svar per frågetyp).</p>`;
  return `<table><tr><th>Frågetyp</th><th class="num">Antal</th><th class="num">Rätt</th><th class="num">Median</th><th></th></tr>
    ${keys.map((k) => `<tr><td>${esc(SUBTYPES[k]?.label ?? k)}</td><td class="num">${st[k].n}</td><td class="num">${pct(st[k].accuracy)}</td><td class="num">${secs(st[k].medianS)}</td><td><span class="pill ${f[k] === "slow_sure" ? "" : "warn"}">${FLAG_LABELS[f[k]]}</span></td></tr>`).join("")}</table>`;
}

// ---------- review ----------
function reviewItem(a) {
  const q = a.question;
  return `<div class="review-item">
    <div class="row spread"><span class="pill">${esc(SUBTYPES[q.subtype]?.label ?? q.subtype)}</span><span class="muted small">${secs(a.timeMs / 1000)}${a.skipped ? " · överhoppad" : ""}</span></div>
    <p class="prompt" style="font-size:1rem;margin-top:8px">${esc(q.prompt)}</p>
    ${q.figure ? `<div class="figure">${renderFigure(q.figure, 56)}</div>` : ""}
    <div class="review-opts">${q.options.map((o, i) => `<span class="review-opt ${i === q.correct ? "right" : i === a.chosen ? "mine" : ""}">${i + 1}. ${typeof o === "string" ? esc(o) : renderCell(o, 48)}</span>`).join("")}</div>
    <p class="small" style="margin-top:8px">${esc(q.explanation)}</p>
  </div>`;
}

function showReview(round) {
  const wrong = round.answers.filter((a) => a.skipped || !a.isCorrect);
  const slowRight = round.answers.filter((a) => a.isCorrect && a.timeMs > 30000);
  screen(`
    <p><button class="link" id="back">← Resultat</button></p>
    <h1>Genomgång</h1>
    <div class="card"><h2>Fel och överhoppade (${wrong.length})</h2>
      ${wrong.length ? wrong.map(reviewItem).join("") : `<p class="muted">Inga – snyggt!</p>`}</div>
    <div class="card"><h2>Rätt men långsamma, över 30 s (${slowRight.length})</h2>
      ${slowRight.length ? slowRight.map(reviewItem).join("") : `<p class="muted">Inga.</p>`}</div>
    <button id="home">Hem</button>`);
  document.getElementById("back").addEventListener("click", () => showResults(round, roundMetrics(round.answers, round.questions.length, { mode: round.mode })));
  document.getElementById("home").addEventListener("click", showHome);
}

// ---------- talent ----------
function showTalent() {
  const notes = loadNotes();
  screen(`
    <p><button class="link" id="back">← Tillbaka</button></p>
    <h1>Förbered JobMatch Talent</h1>
    ${TALENT_HTML}
    <div class="card">
      <h2>Reflektionsfrågor inför intervjun</h2>
      <p class="muted small">Fyll i när du har läst din återkoppling. Anteckningarna sparas automatiskt, men bara i den här webbläsaren.</p>
      ${PROMPTS.map((p) => `
        <div class="review-item">
          <label for="n-${p.id}"><strong>${esc(p.q)}</strong></label>
          <p class="muted small">${esc(p.help)}</p>
          <textarea id="n-${p.id}" data-note="${p.id}" rows="4">${esc(notes[p.id] ?? "")}</textarea>
        </div>`).join("")}
    </div>`);
  document.getElementById("back").addEventListener("click", showHome);
  app.querySelectorAll("[data-note]").forEach((t) => t.addEventListener("input", () => saveNote(t.dataset.note, t.value)));
}

// ---------- statistik ----------
async function showStats() {
  screen(`<p><button class="link" id="back">← Tillbaka</button></p><h1>Statistik</h1><p class="muted">Hämtar…</p>`);
  document.getElementById("back").addEventListener("click", showHome);
  let h;
  try {
    await outbox.flush();
    h = await db.history(state.pass, 30);
  } catch {
    app.querySelector("p.muted").textContent = "Kunde inte hämta statistik just nu.";
    return;
  }
  const st = subtypeStats(h.answers ?? []);
  const sessions = (h.sessions ?? []).filter((s) => s.metrics);
  const allSubs = Object.keys(SUBTYPES).filter((k) => st[k]);
  screen(`
    <p><button class="link" id="back">← Tillbaka</button></p>
    <h1>Statistik</h1>
    <div class="card"><h2>Flaggade frågetyper (senaste 3 passen)</h2>${flagsHtml(st)}</div>
    <div class="card"><h2>Alla frågetyper (senaste 3 passen)</h2>
      <table><tr><th>Frågetyp</th><th>Område</th><th class="num">Antal</th><th class="num">Rätt</th><th class="num">Median</th></tr>
      ${allSubs.sort((a, b) => (st[b].medianS ?? 0) - (st[a].medianS ?? 0)).map((k) => `<tr><td>${esc(SUBTYPES[k].label)}</td><td class="small muted">${esc(AREA_LABELS[SUBTYPES[k].area])}</td><td class="num">${st[k].n}</td><td class="num">${pct(st[k].accuracy)}</td><td class="num">${secs(st[k].medianS)}</td></tr>`).join("")}
      </table></div>
    <div class="card"><h2>Utveckling per pass</h2>
      ${sessions.length ? `<table><tr><th>Datum</th><th>Läge</th><th class="num">Hastighet</th><th class="num">Korrekt</th><th class="num">Median</th>${AREAS.map((a) => `<th class="num" title="${esc(AREA_LABELS[a])}">${esc(AREA_LABELS[a].split(" ")[0].slice(0, 6))}</th>`).join("")}</tr>
      ${sessions.map((s) => `<tr><td>${new Date(s.started_at).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}</td><td>${esc(MODES[s.mode]?.label ?? s.mode)}</td><td class="num">${pct(s.metrics.hastighet)}</td><td class="num">${pct(s.metrics.korrekt)}</td><td class="num">${secs(s.metrics.medianS)}</td>${AREAS.map((a) => `<td class="num">${secs(s.metrics.byArea?.[a]?.medianS)}</td>`).join("")}</tr>`).join("")}</table>` : `<p class="muted">Inga avslutade pass ännu.</p>`}
      <p class="muted small">Områdeskolumnerna visar mediantid per fråga.</p></div>`);
  document.getElementById("back").addEventListener("click", showHome);
}

// ---------- boot ----------
(async function boot() {
  try {
    bank = await loadBank();
  } catch {
    screen(`<div class="card"><p class="err">Kunde inte ladda frågebanken. Ladda om sidan.</p></div>`);
    return;
  }
  if (!state.pass) return showGate();
  flush();
  showHome();
})();
