// Thin client for the passphrase-checked lt_* RPCs. No SDK: plain fetch to PostgREST.

export function createDb({ url, anonKey, fetchImpl = (...a) => fetch(...a) }) {
  async function rpc(fn, params) {
    const res = await fetchImpl(`${url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      let detail = "";
      try { detail = await res.text(); } catch { /* ignore */ }
      const err = new Error(`${fn} failed (${res.status}) ${detail}`);
      err.status = res.status;
      throw err;
    }
    try { return await res.json(); } catch { return null; }
  }

  return {
    auth: async (pass) => (await rpc("lt_auth", { p_pass: pass })) === true,
    startSession: (pass, session) => rpc("lt_start_session", { p_pass: pass, p_session: session }),
    recordAnswers: (pass, sessionId, answers) =>
      rpc("lt_record_answers", { p_pass: pass, p_session: sessionId, p_answers: answers }),
    finishSession: (pass, sessionId, summary) =>
      rpc("lt_finish_session", { p_pass: pass, p_session: sessionId, p_summary: summary }),
    history: (pass, n = 20) => rpc("lt_history", { p_pass: pass, p_n: n }),
  };
}
