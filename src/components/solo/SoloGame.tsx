import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  Flame,
  LogOut,
  SkipForward,
  Sparkles,
  Split,
  Trophy,
  XCircle,
  Zap
} from "lucide-react";
import {
  createInitialBotStates,
  planBotTurn,
  type BotMatchState,
  type PlannedBotAnswer
} from "../../lib/aiOpponents";
import {
  playCorrect,
  playLifeline,
  playRankUp,
  playTick,
  playWrong
} from "../../lib/soundEffects";
import {
  answerSoloQuestion,
  finishSoloGame,
  getSoloState,
  useSoloLifeline
} from "../../services/triviaApi";
import type {
  LifelineKey,
  SoloAnswerResult,
  SoloGameState,
  Student
} from "../../types/trivia";
import { SoundToggle } from "../shared/SoundToggle";

interface Props {
  student: Student;
  initialState: SoloGameState;
  botIds: string[];
  onFinished: (
    finalState: SoloGameState,
    newlyUnlocked: Array<{ code: string; title: string }>,
    finalBots: BotMatchState[]
  ) => void;
  onExit: () => void;
}

export const SoloGame: React.FC<Props> = ({
  student,
  initialState,
  botIds,
  onFinished,
  onExit
}) => {
  const [state, setState] = useState<SoloGameState>(initialState);
  const [bots, setBots] = useState<BotMatchState[]>(() => createInitialBotStates(botIds));
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<SoloAnswerResult | null>(null);
  const [skipFeedback, setSkipFeedback] = useState<{
    correct_text: string;
    explanation: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlockedAll, setUnlockedAll] = useState<Array<{ code: string; title: string }>>([]);
  const [rankDeltas, setRankDeltas] = useState<Record<string, number>>({});

  const q = state.current_question;
  const isPractice = state.mode === "practica";
  const baseLimit = isPractice ? 0 : state.time_limit_sec + (q?.extra_time_sec ?? 0);
  const [timeLeft, setTimeLeft] = useState<number>(baseLimit);
  const startedAtRef = useRef<number>(Date.now());
  const timeoutFiredRef = useRef<boolean>(false);
  const plannedTurnsRef = useRef<Map<string, PlannedBotAnswer>>(new Map());
  const botsResolvedOrdinalRef = useRef<number>(-1);
  const botsRef = useRef<BotMatchState[]>(bots);
  botsRef.current = bots;
  const prevRankMapRef = useRef<Record<string, number>>({});

  // Reiniciar temporizador y planificar turnos de los rivales de la PC al cambiar de pregunta
  useEffect(() => {
    if (!q) return;
    startedAtRef.current = Date.now();
    timeoutFiredRef.current = false;
    setSelected(null);
    setFeedback(null);
    setSkipFeedback(null);
    setError(null);
    setRankDeltas({});
    setTimeLeft(isPractice ? 0 : state.time_limit_sec + q.extra_time_sec);

    if (botsRef.current.length === 0) return;

    const plans = new Map<string, PlannedBotAnswer>();
    const timers: number[] = [];

    setBots((prev) =>
      prev.map((b) => {
        const plan = planBotTurn(b, q, state.mode, state.time_limit_sec);
        plans.set(b.profile.id, plan);
        const id = window.setTimeout(() => {
          setBots((curr) =>
            curr.map((item) =>
              item.profile.id === b.profile.id ? { ...item, status: "answered" } : item
            )
          );
        }, plan.delayMs);
        timers.push(id);
        return { ...b, status: "thinking", lastResult: null };
      })
    );
    plannedTurnsRef.current = plans;

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [q?.ordinal, isPractice, state.mode, state.time_limit_sec]);

  function resolveBotsForCurrentQuestion(nextHumanScore: number, nextHumanCorrect: number) {
    if (!q || botsRef.current.length === 0) return;
    if (botsResolvedOrdinalRef.current === q.ordinal) return;
    botsResolvedOrdinalRef.current = q.ordinal;

    // Guardar posiciones previas
    const prevRanking = [
      { id: student.id, score: state.score, correct: state.correct_count },
      ...botsRef.current.map((b) => ({
        id: b.profile.id,
        score: b.score,
        correct: b.correctCount
      }))
    ].sort((a, b) => b.score - a.score || b.correct - a.correct);

    const prevMap: Record<string, number> = {};
    prevRanking.forEach((item, idx) => {
      prevMap[item.id] = idx + 1;
    });
    prevRankMapRef.current = prevMap;

    const plans = plannedTurnsRef.current;
    const nextBots = botsRef.current.map((b) => {
      const plan = plans.get(b.profile.id);
      if (!plan) return b;
      return {
        ...b,
        status: "answered" as const,
        score: b.score + plan.pointsEarned,
        correctCount: b.correctCount + (plan.isCorrect ? 1 : 0),
        incorrectCount: b.incorrectCount + (plan.isCorrect ? 0 : 1),
        currentStreak: plan.nextStreak,
        bestStreak: plan.nextBestStreak,
        lastResult: {
          isCorrect: plan.isCorrect,
          pointsEarned: plan.pointsEarned,
          responseSec: Math.round(plan.delayMs / 100) / 10
        }
      };
    });

    setBots(nextBots);

    const nextRanking = [
      { id: student.id, score: nextHumanScore, correct: nextHumanCorrect },
      ...nextBots.map((b) => ({
        id: b.profile.id,
        score: b.score,
        correct: b.correctCount
      }))
    ].sort((a, b) => b.score - a.score || b.correct - a.correct);

    const deltas: Record<string, number> = {};
    nextRanking.forEach((item, idx) => {
      const oldRank = prevMap[item.id] ?? idx + 1;
      const diff = oldRank - (idx + 1); // positivo = subió de posición
      if (diff !== 0) deltas[item.id] = diff;
    });
    setRankDeltas(deltas);
    if ((deltas[student.id] ?? 0) > 0) {
      window.setTimeout(() => playRankUp(), 260);
    }
  }

  // Actualizar tiempo si el jugador activó +10s
  useEffect(() => {
    if (!q || isPractice || feedback || skipFeedback) return;
    if (q.extra_time_sec > 0) {
      setTimeLeft((prev) => prev + 10);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.extra_time_sec]);

  // Cuenta regresiva con sonido opcional
  useEffect(() => {
    if (!q || isPractice || feedback || skipFeedback) return;
    if (timeLeft <= 0) {
      if (!timeoutFiredRef.current) {
        timeoutFiredRef.current = true;
        void submitAnswer(null);
      }
      return;
    }
    if (timeLeft <= 5) {
      playTick(timeLeft <= 3);
    }
    const timer = window.setTimeout(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, q?.ordinal, isPractice, feedback, skipFeedback]);

  async function submitAnswer(option: string | null) {
    if (!q || busy || feedback || skipFeedback) return;
    setBusy(true);
    setSelected(option);
    setError(null);
    try {
      const elapsed = Date.now() - startedAtRef.current;
      const result = await answerSoloQuestion(
        state.game_id,
        student.id,
        q.ordinal,
        option,
        elapsed
      );
      if (result.is_correct) {
        playCorrect(result.current_streak);
      } else {
        playWrong();
      }
      setFeedback(result);
      const nextCorrect = state.correct_count + (result.is_correct ? 1 : 0);
      resolveBotsForCurrentQuestion(result.total_score, nextCorrect);

      if (result.newly_unlocked?.length) {
        setUnlockedAll((prev) => [...prev, ...result.newly_unlocked]);
      }
      setState((prev) => ({
        ...prev,
        score: result.total_score,
        current_streak: result.current_streak,
        best_streak: result.best_streak,
        correct_count: nextCorrect,
        incorrect_count: prev.incorrect_count + (result.is_correct ? 0 : 1),
        answered_count: prev.answered_count + 1
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al validar respuesta.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLifeline(key: LifelineKey) {
    if (!q || busy || feedback || skipFeedback) return;
    setBusy(true);
    setError(null);
    try {
      const res = await useSoloLifeline(state.game_id, student.id, q.ordinal, key);
      playLifeline();
      setState((prev) => ({
        ...prev,
        lifelines_used: { ...prev.lifelines_used, [key]: true },
        current_question: prev.current_question
          ? {
              ...prev.current_question,
              eliminated_options:
                res.eliminated_options.length > 0
                  ? res.eliminated_options
                  : prev.current_question.eliminated_options,
              extra_time_sec: res.extra_time_sec,
              double_active: res.double_active
            }
          : null
      }));
      if (res.skipped) {
        resolveBotsForCurrentQuestion(state.score, state.correct_count);
        setSkipFeedback({
          correct_text: res.correct_text ?? "",
          explanation: res.explanation ?? ""
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo aplicar el comodín.");
    } finally {
      setBusy(false);
    }
  }

  async function handleContinue() {
    setBusy(true);
    setError(null);
    try {
      const next = await getSoloState(state.game_id, student.id);
      if (next.status === "finished" || !next.current_question) {
        const finalState =
          next.status === "finished" ? next : await finishSoloGame(state.game_id, student.id);
        onFinished(finalState, unlockedAll, botsRef.current);
      } else {
        setState(next);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la siguiente pregunta.");
    } finally {
      setBusy(false);
    }
  }

  if (!q) {
    return (
      <div className="page-shell">
        <main className="main-container narrow">
          <div className="card center-box">
            <p>Cargando resumen de partida…</p>
            <button type="button" className="btn btn-primary" onClick={handleContinue}>
              Ver resultados
            </button>
          </div>
        </main>
      </div>
    );
  }

  const progressPct = Math.round(((q.ordinal - 1) / Math.max(state.total_questions, 1)) * 100);
  const timerPct = isPractice
    ? 100
    : Math.max(0, Math.round((timeLeft / Math.max(state.time_limit_sec + q.extra_time_sec, 1)) * 100));
  const beatingRecord = !isPractice && state.score > state.personal_best && state.personal_best > 0;
  const hasBots = bots.length > 0;

  const standings = [
    {
      id: student.id,
      name: student.name,
      avatar: student.name.slice(0, 2).toUpperCase(),
      isHuman: true,
      tierLabel: "Tú",
      score: state.score,
      correctCount: state.correct_count,
      streak: state.current_streak,
      status: feedback || skipFeedback ? ("answered" as const) : ("thinking" as const),
      lastDelta: feedback
        ? feedback.is_correct
          ? `+${feedback.points_earned}`
          : "Falló"
        : skipFeedback
        ? "Saltó"
        : null
    },
    ...bots.map((b) => ({
      id: b.profile.id,
      name: b.profile.name,
      avatar: b.profile.avatar,
      isHuman: false,
      tierLabel: b.profile.tierLabel,
      score: b.score,
      correctCount: b.correctCount,
      streak: b.currentStreak,
      status: b.status,
      lastDelta: b.lastResult
        ? b.lastResult.isCorrect
          ? `+${b.lastResult.pointsEarned}`
          : "Falló"
        : null
    }))
  ].sort((a, b) => b.score - a.score || b.correctCount - a.correctCount);

  return (
    <div className="page-shell show-stage-bg">
      <header className="topbar">
        <div className="hud-left">
          <span className="round-badge">
            RONDA {q.round_number} / {state.total_rounds}
          </span>
          <span className="muted">
            Pregunta {q.ordinal} de {state.total_questions}
          </span>
        </div>

        <div className="hud-center">
          {!isPractice ? (
            <>
              <div className="score-pill">
                <Trophy size={16} />
                <strong>{state.score.toLocaleString()} pts</strong>
                {beatingRecord && <span className="record-tag">¡RÉCORD!</span>}
              </div>
              <div className="record-pill muted">
                <Award size={15} /> Récord: {state.personal_best.toLocaleString()}
              </div>
            </>
          ) : (
            <span className="tag-pill">Modo Práctica · Sin límite de tiempo</span>
          )}
          {state.current_streak >= 2 && (
            <div className="streak-pill">
              <Flame size={16} /> Racha x{state.current_streak}
            </div>
          )}
        </div>

        <div className="topbar-actions">
          <SoundToggle />
          <button type="button" className="btn btn-ghost" onClick={onExit}>
            <LogOut size={16} /> Salir
          </button>
        </div>
      </header>

      <div className="progress-bar-outer">
        <div className="progress-bar-inner" style={{ width: `${progressPct}%` }} />
      </div>

      <main className="main-container">
        {error && <div className="alert alert-error">{error}</div>}

        <div className="mp-play-layout">
          <div className="stack-lg">
            <article key={q.ordinal} className="stage-card stage-enter">
              <div className="stage-top-bar">
                <span className="stage-q-badge">
                  PREGUNTA {q.ordinal} · {q.subject_name}
                </span>
                {!isPractice && (
                  <span className="stage-pts-badge">
                    {q.base_points} pts × {q.multiplier}
                    {q.double_active ? " ×2" : ""}
                  </span>
                )}
              </div>

              {!isPractice && (
                <div className="stage-timer">
                  <div className="timer-track neon">
                    <div
                      className={`timer-fill ${timeLeft <= 4 ? "urgent" : ""}`}
                      style={{ width: `${timerPct}%` }}
                    />
                  </div>
                  <span className={`timer-clock ${timeLeft <= 4 && !feedback ? "urgent" : ""}`}>
                    <Clock size={16} />
                    {feedback || skipFeedback ? "—" : `${timeLeft}s`}
                  </span>
                </div>
              )}

              <div className="stage-question-box">
                <h2 className="stage-question-text">{q.prompt}</h2>
                <div className="stage-submeta">
                  <span className="meta-chip">
                    {q.qtype === "verdadero_falso" ? "Verdadero / Falso" : "Opción múltiple"}
                  </span>
                  <span className="meta-chip">Dificultad: {q.difficulty}</span>
                </div>
              </div>

              <div className={`arcade-options-grid ${q.qtype === "verdadero_falso" ? "vf-grid" : ""}`}>
                {q.options.map((option, idx) => {
                  const eliminated = q.eliminated_options.includes(option);
                  const revealedCorrect =
                    (feedback && option === feedback.correct_text) ||
                    (skipFeedback && option === skipFeedback.correct_text);
                  const revealedWrong =
                    feedback && !feedback.is_correct && selected === option;

                  let cls = `arcade-option opt-color-${idx % 4}`;
                  if (eliminated) cls += " eliminated";
                  if (revealedCorrect) cls += " correct anim-correct";
                  else if (revealedWrong) cls += " wrong anim-wrong";

                  return (
                    <button
                      key={`${q.ordinal}-${idx}`}
                      type="button"
                      className={cls}
                      disabled={busy || eliminated || Boolean(feedback) || Boolean(skipFeedback)}
                      onClick={() => submitAnswer(option)}
                    >
                      <span className={`arcade-letter letter-${idx % 4}`}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="arcade-option-text">{option}</span>
                    </button>
                  );
                })}
              </div>

              {state.lifelines_enabled && !feedback && !skipFeedback && (
                <div className="arcade-lifelines">
                  <button
                    type="button"
                    className="lifeline-tile"
                    disabled={
                      busy || state.lifelines_used.fifty_fifty || q.qtype !== "opcion_multiple"
                    }
                    onClick={() => handleLifeline("fifty_fifty")}
                    title="Elimina 2 opciones incorrectas"
                  >
                    <Split size={20} />
                    <span>50:50</span>
                  </button>
                  {!isPractice && (
                    <>
                      <button
                        type="button"
                        className="lifeline-tile"
                        disabled={busy || state.lifelines_used.extra_time}
                        onClick={() => handleLifeline("extra_time")}
                        title="Agrega 10 segundos a esta pregunta"
                      >
                        <Clock size={20} />
                        <span>+10s</span>
                      </button>
                      <button
                        type="button"
                        className="lifeline-tile gold"
                        disabled={busy || state.lifelines_used.double_points}
                        onClick={() => handleLifeline("double_points")}
                        title="Duplica los puntos si aciertas esta pregunta"
                      >
                        <Zap size={20} />
                        <span>×2 PTS</span>
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="lifeline-tile"
                    disabled={busy || state.lifelines_used.skip}
                    onClick={() => handleLifeline("skip")}
                    title="Salta la pregunta y muestra la explicación"
                  >
                    <SkipForward size={20} />
                    <span>SALTAR</span>
                  </button>
                </div>
              )}

              {(feedback || skipFeedback) && (
                <div
                  className={`feedback-panel ${
                    skipFeedback
                      ? "neutral"
                      : feedback?.is_correct
                      ? "is-correct anim-correct"
                      : "is-wrong anim-wrong"
                  }`}
                >
                  <div className="feedback-head">
                    {skipFeedback ? (
                      <>
                        <Sparkles size={22} />
                        <strong>Pregunta saltada con comodín</strong>
                      </>
                    ) : feedback?.is_correct ? (
                      <>
                        <CheckCircle2 size={22} />
                        <strong>
                          ¡Correcto! {!isPractice && `+${feedback.points_earned.toLocaleString()} pts`}
                        </strong>
                      </>
                    ) : (
                      <>
                        <XCircle size={22} />
                        <strong>
                          {selected === null ? "¡Se acabó el tiempo!" : "Respuesta incorrecta"}
                        </strong>
                      </>
                    )}
                  </div>

                  <p className="feedback-answer">
                    <strong>Respuesta correcta:</strong>{" "}
                    {skipFeedback ? skipFeedback.correct_text : feedback?.correct_text}
                  </p>

                  {(skipFeedback?.explanation || feedback?.explanation) && (
                    <p className="feedback-explanation">
                      <strong>Explicación:</strong>{" "}
                      {skipFeedback ? skipFeedback.explanation : feedback?.explanation}
                    </p>
                  )}

                  <div className="feedback-actions">
                    <button
                      type="button"
                      className="btn btn-gold btn-lg"
                      disabled={busy}
                      onClick={handleContinue}
                    >
                      {feedback?.finished || q.ordinal >= state.total_questions
                        ? "Ver podio y resultados"
                        : "Siguiente pregunta"}
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </div>
              )}
            </article>
          </div>

          <aside className="stack-lg">
            <section className="card hud-panel">
              <div className="hud-score-head">
                <span className="eyebrow">Tu Marcador</span>
                <strong className="gold-text">
                  {isPractice ? `${state.correct_count} aciertos` : `${state.score.toLocaleString()} pts`}
                </strong>
              </div>
              <div className="hud-score-bar">
                <div
                  className="hud-score-fill"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((state.answered_count / Math.max(state.total_questions, 1)) * 100)
                    )}%`
                  }}
                />
              </div>
              <div className="hud-mini-stats">
                <div className="hud-mini good">
                  <CheckCircle2 size={16} />
                  <strong>{state.correct_count}</strong>
                  <span>Bien</span>
                </div>
                <div className="hud-mini bad">
                  <XCircle size={16} />
                  <strong>{state.incorrect_count}</strong>
                  <span>Mal</span>
                </div>
                <div className="hud-mini fire">
                  <Flame size={16} />
                  <strong>{state.current_streak}</strong>
                  <span>Racha</span>
                </div>
              </div>
            </section>

            {hasBots && (
              <section className="card leaderboard-card">
                <h3>
                  <Trophy size={18} className="gold-text" /> Posiciones en vivo
                </h3>
                <div className="leaderboard-list">
                  {standings.map((p, idx) => {
                    const rankChange = rankDeltas[p.id] ?? 0;
                    return (
                      <div
                        key={p.id}
                        className={`lb-row ${p.isHuman ? "is-me" : ""} ${
                          rankChange > 0 ? "rank-up" : ""
                        }`}
                      >
                        <span className={`rank-medal rank-${idx + 1}`}>{idx + 1}</span>
                        <span className="bot-lb-avatar">{p.avatar}</span>
                        <div className="lb-info">
                          <strong>
                            {p.name}
                            {rankChange > 0 && (
                              <span className="rank-shift up">▲+{rankChange}</span>
                            )}
                            {rankChange < 0 && (
                              <span className="rank-shift down">▼{rankChange}</span>
                            )}
                            {p.lastDelta && (
                              <span
                                className={`delta-chip ${
                                  p.lastDelta.startsWith("+") ? "good" : "bad"
                                }`}
                              >
                                {p.lastDelta}
                              </span>
                            )}
                          </strong>
                          <span className="muted" style={{ fontSize: "0.76rem" }}>
                            {p.tierLabel} ·{" "}
                            {p.lastDelta
                              ? `${p.correctCount} aciertos${p.streak >= 2 ? ` · 🔥x${p.streak}` : ""}`
                              : p.status === "answered"
                              ? "Respondió ✓"
                              : "Pensando…"}
                          </span>
                        </div>
                        <strong className="lb-score">
                          {isPractice ? `${p.correctCount}✓` : p.score.toLocaleString()}
                        </strong>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
};
