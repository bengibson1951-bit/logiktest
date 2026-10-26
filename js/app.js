// UI wiring: gate → home → run → results / review, plus statistik and ämnesdrill.

import { SUPABASE_URL, SUPABASE_ANON_KEY, DEADLINE_ISO } from "./config.js";
import { AREAS, AREA_LABELS, SUBTYPES, subtypesOf } from "./taxonomy.js";
import { createDb } from "./db.js";
import { createOutbox } from "./outbox.js";
import { loadBank } from "./bank.js";
import { MODES, buildRound } from "./engine.js";
import { newRound, recordAnswer, recordSkip, timeUp } from "./round.js";
import { createStopwatch } from "./timer.js";
import { roundMetrics, subtypeStats, flags, weights, targetSeconds, FLAG_LABELS, TARGET_S } from "./metrics.js";
import { renderFigure, renderCell } from "./svg.js";
import { load, save, setResume, clearResume, addRecent } from "./store.js";

const CLIENT_VERSION = "1.0.0";
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
  if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return;
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
    <p class="muted">Träning inför JobMatch Logic: 80 blandade frågor på 30 minuter.</p>
    ${r ? `<div class="card"><div class="row spread"><div><strong>Fortsätt där du var</strong><br><span class="muted small">${esc(MODES[r.mode].label)} · fråga ${r.position + 1} av ${r.questions.length}${r.remainingMs != null ? ` · ${mmss(r.remainingMs)} kvar` : ""}</span></div>
      <div class="row"><button id="discard" class="link">Släng</button><button id="resume" class="primary">Fortsätt</button></div></div></div>` : ""}
    ${last ? `<div class="card"><div class="row spread"><strong>Senaste: ${esc(MODES[last.mode].label)}</strong><span class="muted small">${new Date(last.endedAt).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}</span></div>
      <div class="grid2" style="margin-top:10px">
        <div><div class="stat">${pct(last.metrics.hastighet)}</div><div class="stat-label">Svarshastighet</div></div>
        <div><div class="stat">${pct(last.metrics.korrekt)}</div><div class="stat-label">Korrekt resonemang</div></div>
        <div><div class="stat">${secs(last.metrics.medianS)}</div><div class="stat-label">Median per fråga (mål ${TARGET_S} s)</div></div>
      </div></div>` : ""}
    <div class="grid2">
      <button class="big" data-mode="full"><strong>Fullt test</strong><span class="muted small">80 frågor · 30 min · som riktiga testet</span></button>
      <button class="big" data-mode="quick"><strong>Snabbrunda</strong><span class="muted small">20 frågor · 7½ min · daglig uppvärmning</span></button>
      <button class="big" data-mode="weak"><strong>Träna svagheter</strong><span class="muted small">20 frågor från dina långsammaste och svagaste typer</span></button>
      <button class="big" id="drill"><strong>Ämnesdrill</strong><span class="muted small">Välj en frågetyp och nöt den</span></button>
    </div>
    <p style="margin-top:12px"><button class="link" id="stats">Statistik och utveckling →</button></p>
    <div class="card">
      <h2>Strategi</h2>
      <ul class="tips">
        <li><strong>Takt:</strong> ca ${TARGET_S} sekunder per fråga. Nästan ingen hinner alla 80 – det är både antal svar och andel rätt som räknas.</li>
        <li><strong>Fastnar du?</strong> Hoppa efter ca 30 sekunder. En överhoppad fråga kostar mindre än tre minuters grubblande.</li>
        <li><strong>Läs en gång</strong>, svara, gå vidare. Läs inte om frågan i onödan.</li>
        <li><strong>Kolla instruktionerna</strong> i riktiga testet: går det att gå tillbaka till överhoppade frågor?</li>
        <li><strong>Sant / Falskt / Möjligt / Osannolikt:</strong> Sant = följer säkert av påståendena. Falskt = motsägs säkert. Möjligt = kan stämma men bevisas inte. Osannolikt = påståendena (t.ex. "de flesta", "få") gör det osannolikt men utesluter det inte.</li>
        <li>Här: tangenterna <strong>1–5</strong> svarar direkt, <strong>S</strong> eller <strong>→</strong> hoppar över.</li>
      </ul>
    </div>
    <p id="outbox-note" class="muted small"></p>`);
  updateOutboxNote();
  app.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => startMode(b.dataset.mode)));
  document.getElementById("drill").addEventListener("click", showDrillPicker);
  document.getElementById("stats").addEventListener("click", showStats);
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
  const questions = buildRound({
    mode, bank, filter, subtypeWeights,
    seed: Math.floor(Math.random() * 2 ** 31),
    recentIds: new Set(state.recentIds),
  });
  const round = newRound({
    sessionId: crypto.randomUUID(), mode, filter, questions,
    timeLimitS: MODES[mode].timeLimitS, startedAt: new Date().toISOString(),
  });
  outbox.enqueue({
    type: "start",
    session: { id: round.sessionId, mode, filter, startedAt: round.startedAt, timeLimitS: round.timeLimitS, total: questions.length, clientVersion: CLIENT_VERSION },
  });
  flush();
  setResume(state, round);
  save(state);
  runRound(round);
}

function showDrillPicker() {
  screen(`
    <p><button class="link" id="back">← Tillbaka</button></p>
    <h1>Ämnesdrill</h1>
    <p class="muted">15 frågor av en typ, med en tidsmålstapel per fråga.</p>
    ${AREAS.map((a) => `
      <div class="card"><div class="row spread"><h2 style="margin:0">${esc(AREA_LABELS[a])}</h2><button data-area="${a}">Hela området</button></div>
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
    const q = round.questions[round.position];
    const figs = q.options.some((o) => typeof o !== "string");
    const target = targetSeconds(liveStats?.[q.subtype]);
    screen(`
      <div class="topbar">
        <span>Fråga ${round.position + 1} / ${round.questions.length}</span>
        ${timed ? `<span class="clock" id="clock">${mmss(round.remainingMs)}</span>` : `<span class="small">Mål: ${target} s</span>`}
        <button class="link" id="pause">Pausa</button>
      </div>
      ${timed ? "" : `<div class="target" id="target"><div></div></div>`}
      <div class="card">
        <div class="prompt">${esc(q.prompt)}</div>
        ${q.figure ? `<div class="figure">${renderFigure(q.figure)}</div>` : ""}
        <div class="options ${figs ? "figs" : ""}">
          ${q.options.map((o, i) => `<button class="opt" data-i="${i}"><span class="key">${i + 1}</span><span>${optionHtml(o)}</span></button>`).join("")}
        </div>
        <div class="skiprow"><span class="muted small">Tangent 1–${q.options.length} svarar · S hoppar över</span><button id="skip">Hoppa över →</button></div>
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

  function tick(target) {
    const { timeMs } = stopwatch.read();
    if (timed) {
      const left = round.remainingMs - timeMs;
      const el = document.getElementById("clock");
      if (el) { el.textContent = mmss(left); el.classList.toggle("low", left < 60000); }
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
        : `<p style="margin-top:14px">I den här takten hinner du <strong>ca ${projected} av 80</strong> frågor på 30 minuter.</p>`}
    </div>
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
