import { test } from "node:test";
import assert from "node:assert/strict";
import { createDb } from "../js/db.js";

function fakeFetch(responses) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const r = responses.shift() ?? { status: 200, json: null };
    return { ok: r.status < 300, status: r.status, json: async () => r.json, text: async () => JSON.stringify(r.json) };
  };
  return { impl, calls };
}

test("recordAnswers posts to the rpc with prefixed params and anon headers", async () => {
  const f = fakeFetch([{ status: 200, json: null }]);
  const db = createDb({ url: "https://x.supabase.co", anonKey: "anon", fetchImpl: f.impl });
  const a = { position: 0 };
  await db.recordAnswers("pw", "s1", [a]);
  assert.equal(f.calls[0].url, "https://x.supabase.co/rest/v1/rpc/lt_record_answers");
  assert.deepEqual(f.calls[0].body, { p_pass: "pw", p_session: "s1", p_answers: [a] });
  assert.equal(f.calls[0].init.headers.apikey, "anon");
  assert.equal(f.calls[0].init.headers.Authorization, "Bearer anon");
});

test("non-2xx rejects with status", async () => {
  const f = fakeFetch([{ status: 401, json: { message: "nope" } }]);
  const db = createDb({ url: "https://x.supabase.co", anonKey: "anon", fetchImpl: f.impl });
  await assert.rejects(db.recordAnswers("pw", "s1", []), (e) => e.status === 401);
});

test("auth returns the rpc boolean", async () => {
  const f = fakeFetch([{ status: 200, json: true }, { status: 200, json: false }]);
  const db = createDb({ url: "https://x.supabase.co", anonKey: "anon", fetchImpl: f.impl });
  assert.equal(await db.auth("pw"), true);
  assert.equal(await db.auth("bad"), false);
  assert.deepEqual(f.calls[0].body, { p_pass: "pw" });
});

test("history passes n", async () => {
  const f = fakeFetch([{ status: 200, json: { sessions: [], answers: [] } }]);
  const db = createDb({ url: "https://x.supabase.co", anonKey: "anon", fetchImpl: f.impl });
  const h = await db.history("pw", 5);
  assert.deepEqual(h, { sessions: [], answers: [] });
  assert.deepEqual(f.calls[0].body, { p_pass: "pw", p_n: 5 });
});
