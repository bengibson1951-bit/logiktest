// Round state as a plain JSON object so it can be stored for "Fortsätt där du var".

export function newRound({ sessionId, mode, questions, timeLimitS, startedAt, filter = null }) {
  return {
    sessionId,
    mode,
    filter,
    questions,
    timeLimitS: timeLimitS ?? null,
    startedAt,
    position: 0,
    answers: [],
    remainingMs: timeLimitS ? timeLimitS * 1000 : null,
    pausedTotalMs: 0,
    done: questions.length === 0,
  };
}

function record(round, chosen, { timeMs, pausedMs }, nowIso) {
  const question = round.questions[round.position];
  const skipped = chosen === null;
  const rec = {
    position: round.position,
    questionId: question.id,
    question,
    chosen,
    isCorrect: skipped ? null : chosen === question.correct,
    skipped,
    timeMs,
    pausedMs,
    answeredAt: nowIso,
  };
  round.answers.push(rec);
  round.pausedTotalMs += pausedMs;
  if (round.remainingMs !== null) round.remainingMs = Math.max(0, round.remainingMs - timeMs);
  round.position += 1;
  if (round.position >= round.questions.length) round.done = true;
  return rec;
}

export const recordAnswer = (round, chosen, times, nowIso) => record(round, chosen, times, nowIso);
export const recordSkip = (round, times, nowIso) => record(round, null, times, nowIso);

export function timeUp(round) {
  round.done = true;
  round.remainingMs = 0;
}
