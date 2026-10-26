// JobMatch Talent preparation: format, tips and interview reflection prompts.
// Answers are personal notes, kept only in this browser.

const NOTES_KEY = "logik.talent";

export const PROMPTS = [
  {
    id: "styrkor",
    q: "Vilka tre drag i din profil stämmer bäst med dig?",
    help: "Välj tre och ge ett konkret exempel från jobbet för varje (STAR).",
  },
  {
    id: "overraskning",
    q: "Vad i profilen överraskade dig – håller du med?",
    help: "Intervjuare frågar gärna om det som sticker ut. Förbered ett lugnt, ärligt svar: \"Jag känner igen det när…\" eller \"I mitt nuvarande jobb märks det mer som…\".",
  },
  {
    id: "utveckling",
    q: "Vilket utvecklingsområde visar profilen, och hur hanterar du det?",
    help: "Visa självinsikt: hur märks det, vad gör du konkret åt det, och ett exempel där du lyckats.",
  },
  {
    id: "rollen",
    q: "Hur passar din profil rollen på Unionen?",
    help: "Tänk på det rollen kräver: förhandla och hantera konflikter, bygga relationer med medlemmar och arbetsgivare, arbeta självständigt, hålla många ärenden igång.",
  },
  {
    id: "konflikt",
    q: "Ge ett exempel på när du hanterade en svår konflikt eller förhandling.",
    help: "Situation – Uppgift – Handling – Resultat. Vad gjorde just du, och vad blev utfallet?",
  },
  {
    id: "tempo",
    q: "När har du arbetat självständigt med högt tempo eller många ärenden samtidigt?",
    help: "Hur prioriterade du, och hur höll du kvaliteten?",
  },
  {
    id: "samarbete",
    q: "Ge ett exempel där du anpassade dig till någon som arbetar annorlunda än du.",
    help: "Profilen beskriver ditt naturliga sätt – intervjuaren vill höra att du kan växla när det behövs.",
  },
  {
    id: "drivkraft",
    q: "Vad motiverar dig i arbetet – och varför just Unionen?",
    help: "Koppla dina drivkrafter i profilen till Unionens uppdrag och medlemmarna.",
  },
];

export function loadNotes(storage = globalThis.localStorage) {
  try { return JSON.parse(storage.getItem(NOTES_KEY) ?? "{}") || {}; } catch { return {}; }
}

export function saveNote(id, text, storage = globalThis.localStorage) {
  const notes = loadNotes(storage);
  notes[id] = text;
  try { storage.setItem(NOTES_KEY, JSON.stringify(notes)); } catch { /* full or blocked */ }
}

export const TALENT_HTML = `
  <div class="card">
    <h2>Vad är JobMatch Talent?</h2>
    <p>Ett personlighetsformulär om hur du brukar arbeta och fungera med andra. Du läser påståenden och anger hur väl de stämmer in på dig. Det finns <strong>inga rätta eller felaktiga svar</strong> och ingen poäng att maximera – resultatet blir en profil som arbetsgivaren använder som underlag i intervjun.</p>
    <p class="muted small">Enligt testförberedelseföretag bygger det på femfaktormodellen (t.ex. utåtriktning, samvetsgrannhet, samarbetsvilja, stabilitet, öppenhet). JobMatch publicerar inga exempelfrågor.</p>
  </div>
  <div class="card">
    <h2>Tips när du gör testet</h2>
    <ul class="tips">
      <li><strong>Var ärlig.</strong> Formulär som detta brukar fånga upp inkonsekventa eller "för bra" svar, och en konstlad profil blir svår att försvara i intervjun.</li>
      <li><strong>Tänk på dig själv i jobbet</strong> – hur du faktiskt beter dig, inte hur du skulle vilja vara.</li>
      <li><strong>Gå på första känslan.</strong> Övertänk inte och gå inte tillbaka och ändra.</li>
      <li><strong>Undvik att bara välja mittenalternativet</strong> – det ger en otydlig profil.</li>
      <li><strong>Lugn miljö</strong>, gärna en annan stund än LogiQ-testet så att du är fokuserad på båda.</li>
    </ul>
  </div>
  <div class="card">
    <h2>Efter testet: förbered intervjun</h2>
    <p>Mejlet ber dig läsa din <strong>återkoppling</strong> innan nästa intervju – räkna med att intervjuarna har profilen framför sig och frågar utifrån den, t.ex. <em>"Din profil visar att du … – kan du ge ett exempel?"</em></p>
    <ol class="tips">
      <li>Läs rapporten i lugn och ro och stryk under det som stämmer och det som inte gör det.</li>
      <li>Välj <strong>tre styrkor</strong> och <strong>ett–två utvecklingsområden</strong>.</li>
      <li>Förbered ett konkret exempel per punkt med <strong>STAR</strong>: Situation, Uppgift, Handling, Resultat.</li>
      <li>Koppla profilen till vad rollen kräver.</li>
    </ol>
  </div>`;
