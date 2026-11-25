import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Crown,
  Flame,
  Home,
  Link2,
  LogOut,
  Play,
  Share2,
  SkipForward,
  Split,
  Trophy,
  Users,
  Zap
} from "lucide-react";
import {
  playCorrect,
  playLifeline,
  playTick,
  playVictory,
  playWrong
} from "../../lib/soundEffects";
import {
  advanceMpRoom,
  answerMpQuestion,
  getMpState,
  setMpReady,
  startMpRoom,
  subscribeMpRoom,
  useMpLifeline
} from "../../services/triviaApi";
import type { LifelineKey, MpRoomState, Student } from "../../types/trivia";
import { Podium } from "../shared/Podium";
import { SoundToggle } from "../shared/SoundToggle";

interface Props {
  student: Student;
  initialRoom: MpRoomState;
  onExit: () => void;
}

export const MpRoom: React.FC<Props> = ({ student, initialRoom, onExit }) => {
  const [room, setRoom] = useState<MpRoomState>(initialRoom);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(initialRoom.time_limit_sec);
  const [timerOrdinal, setTimerOrdinal] = useState<number>(initialRoom.current_ordinal);
  const [roomTimeLeft, setRoomTimeLeft] = useState<number>(initialRoom.time_limit_sec);
  const [roomTotalTime, setRoomTotalTime] = useState<number>(initialRoom.time_limit_sec);
  const [extraTimeNotice, setExtraTimeNotice] = useState<string | null>(null);
  const startedAtRef = useRef<number>(Date.now());
  const timeoutSentRef = useRef<boolean>(false);
  const extraTimeUsedSetRef = useRef<Set<string>>(
    new Set(
      initialRoom.players
        .filter((p) => p.lifelines_used?.extra_time)
        .map((p) => p.student_id)
    )
  );

  const isHost = room.host_student_id === student.id;
  const me = room.players.find((p) => p.student_id === student.id);
  const allReady = room.players.length > 0 && room.players.every((p) => p.is_ready);
  const q = room.current_question;
  const myAns = room.my_answer;

  // Suscripción Supabase Realtime (exclusiva de Modo Multijugador)
  useEffect(() => {
    const refresh = () => {
      getMpState(room.room_id, student.id)
        .then(setRoom)
        .catch(() => {});
    };
    const unsubscribe = subscribeMpRoom(room.room_id, refresh);
    const poll = window.setInterval(refresh, 4000);
    return () => {
      unsubscribe();
      window.clearInterval(poll);
    };
  }, [room.room_id, student.id]);

  useEffect(() => {
    if (room.status === "finished") {
      playVictory();
    }
  }, [room.status]);

  useEffect(() => {
    if (room.status !== "playing" || !q) return;
    startedAtRef.current = Date.now();
    timeoutSentRef.current = false;
    const extra = myAns?.extra_time_sec ?? 0;
    setTimerOrdinal(q.ordinal);
    setTimeLeft(room.time_limit_sec + extra);
    setRoomTimeLeft(room.time_limit_sec);
    setRoomTotalTime(room.time_limit_sec);
    setExtraTimeNotice(null);
    extraTimeUsedSetRef.current = new Set(
      room.players.filter((p) => p.lifelines_used?.extra_time).map((p) => p.student_id)
    );
  }, [room.status, q?.ordinal]);

  // Detectar en tiempo real cuando algún participante usa el comodín +10s en esta pregunta
  useEffect(() => {
    if (room.status !== "playing" || !q) return;
    const newlyUsed = room.players.filter(
      (p) => p.lifelines_used?.extra_time && !extraTimeUsedSetRef.current.has(p.student_id)
    );
    if (newlyUsed.length > 0) {
      newlyUsed.forEach((p) => extraTimeUsedSetRef.current.add(p.student_id));
      const addedSec = newlyUsed.length * 10;
      setRoomTimeLeft((t) => t + addedSec);
      setRoomTotalTime((t) => t + addedSec);
      const names = newlyUsed.map((p) => p.student_name).join(", ");
      setExtraTimeNotice(
        `⏱️ ¡${names} usó el comodín +10s! Espera ${addedSec}s adicionales para la siguiente pregunta.`
      );
      playLifeline();
    }
  }, [room.players, room.status, q?.ordinal]);

  // Temporizador global de la pregunta (para habilitar el avance del anfitrión solo al vencer o contestar todos)
  useEffect(() => {
    if (room.status !== "playing" || !q) return;
    if (roomTimeLeft <= 0) return;
    const timer = window.setTimeout(() => setRoomTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [roomTimeLeft, room.status, q?.ordinal]);

  useEffect(() => {
    if (room.status !== "playing" || !q || myAns?.answered) return;
    if (timerOrdinal !== q.ordinal) return;
    if (timeLeft <= 0) {
      if (!timeoutSentRef.current && Date.now() - startedAtRef.current >= 1500) {
        timeoutSentRef.current = true;
        void handleAnswer(null);
      }
      return;
    }
    if (timeLeft <= 5) {
      playTick(timeLeft <= 3);
    }
    const timer = window.setTimeout(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, timerOrdinal, room.status, q?.ordinal, myAns?.answered]);

  const inviteUrl = `${window.location.origin}/?sala=${room.code}`;

  function copyCode() {
    navigator.clipboard?.writeText(room.code).catch(() => {});
    setCopied("code");
    window.setTimeout(() => setCopied(null), 1800);
  }

  function copyLink() {
    navigator.clipboard?.writeText(inviteUrl).catch(() => {});
    setCopied("link");
    window.setTimeout(() => setCopied(null), 1800);
  }

  async function shareInvite() {
    const text = `¡Únete a mi partida de Buensoft Trivia! Código: ${room.code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Buensoft Trivia", text, url: inviteUrl });
        return;
      } catch {
        // usuario canceló o no soportado
      }
    }
    const waUrl = `https://wa.me/?text=${encodeURIComponent(`${text}\n${inviteUrl}`)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  }

  async function toggleReady() {
    if (!me) return;
    setBusy(true);
    setError(null);
    try {
      setRoom(await setMpReady(room.room_id, student.id, !me.is_ready));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error actualizando estado.");
    } finally {
      setBusy(false);
    }
  }

  async function handleStart() {
    setBusy(true);
    setError(null);
    try {
      setRoom(await startMpRoom(room.room_id, student.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar la sala.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAnswer(option: string | null) {
    if (busy || myAns?.answered || room.status !== "playing") return;
    // Evitar toques fantasma en celular al cambiar de pregunta (<400ms)
    if (option !== null && Date.now() - startedAtRef.current < 400) return;
    setBusy(true);
    setError(null);
    try {
      const elapsed = Date.now() - startedAtRef.current;
      const updated = await answerMpQuestion(room.room_id, student.id, option, elapsed);
      if (updated.my_answer?.is_correct) {
        playCorrect(me?.current_streak ? me.current_streak + 1 : 1);
      } else {
        playWrong();
      }
      setRoom(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar respuesta.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLifeline(key: LifelineKey) {
    if (busy || myAns?.answered || room.status !== "playing") return;
    setBusy(true);
    setError(null);
    try {
      const updated = await useMpLifeline(room.room_id, student.id, key);
      playLifeline();
      if (key === "extra_time") setTimeLeft((t) => t + 10);
      setRoom(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo usar el comodín.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAdvance() {
    setBusy(true);
    setError(null);
    try {
      setRoom(await advanceMpRoom(room.room_id, student.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo avanzar.");
    } finally {
      setBusy(false);
    }
  }

  const displayTime = myAns?.answered ? roomTimeLeft : timeLeft;
  const displayMax = myAns?.answered
    ? Math.max(roomTotalTime, 1)
    : Math.max(room.time_limit_sec + (myAns?.extra_time_sec ?? 0), 1);
  const timerPct = Math.max(0, Math.min(100, Math.round((displayTime / displayMax) * 100)));

  return (
    <div className="page-shell show-stage-bg">
      <header className="topbar">
        <div className="hud-left">
          <span className="round-badge">SALA {room.code}</span>
          {room.status !== "lobby" && q && (
            <span className="muted">
              Ronda {q.round_number}/{room.total_rounds} · Pregunta {q.ordinal}/{room.total_questions}
            </span>
          )}
        </div>
        <div className="topbar-actions">
          <SoundToggle />
          <button type="button" className="btn btn-ghost" onClick={copyLink}>
            {copied === "link" ? <Check size={16} /> : <Link2 size={16} />}
            {copied === "link" ? "Enlace copiado" : "Copiar enlace"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={copyCode}>
            {copied === "code" ? <Check size={16} /> : <Copy size={16} />}
            {copied === "code" ? "Copiado" : `Código: ${room.code}`}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onExit}>
            <LogOut size={16} /> Salir
          </button>
        </div>
      </header>

      <main className="main-container">
        {error && <div className="alert alert-error">{error}</div>}

        {room.status === "lobby" && (
          <div className="main-container narrow" style={{ padding: 0 }}>
            <section className="card stage-card">
              <span className="eyebrow">Sala de espera en vivo</span>
              <h2>Invita a tus amigos</h2>
              <p className="muted">
                {room.total_rounds} rondas · {room.questions_per_round} preguntas/ronda ·{" "}
                {room.time_limit_sec}s por pregunta · Comodines{" "}
                {room.lifelines_enabled ? "activados" : "desactivados"}
              </p>

              <div className="invite-box">
                <div className="invite-row">
                  <div className="invite-info">
                    <span className="muted" style={{ fontSize: "0.78rem" }}>Enlace directo (1 clic para entrar)</span>
                    <code className="invite-url">{inviteUrl}</code>
                  </div>
                  <div className="pill-row">
                    <button type="button" className="btn btn-secondary" onClick={copyLink}>
                      {copied === "link" ? <Check size={16} /> : <Link2 size={16} />}
                      {copied === "link" ? "Copiado" : "Copiar enlace"}
                    </button>
                    <button type="button" className="btn btn-gold" onClick={shareInvite}>
                      <Share2 size={16} /> Compartir / WhatsApp
                    </button>
                  </div>
                </div>
                <div className="invite-code-line">
                  <span className="muted">O diles el código:</span>
                  <strong className="gold-text" style={{ letterSpacing: "0.18em", fontSize: "1.15rem" }}>
                    {room.code}
                  </strong>
                  <button type="button" className="btn btn-ghost" onClick={copyCode}>
                    {copied === "code" ? <Check size={15} /> : <Copy size={15} />}
                    {copied === "code" ? "Copiado" : "Copiar código"}
                  </button>
                </div>
              </div>

              <div className="player-list">
                {room.players.map((p) => (
                  <div key={p.student_id} className="player-row">
                    <div className="player-name">
                      <span className="avatar-sm">{p.student_name.slice(0, 2).toUpperCase()}</span>
                      <strong>{p.student_name}</strong>
                      {p.is_host && (
                        <span className="meta-chip highlight">
                          <Crown size={13} /> Anfitrión
                        </span>
                      )}
                    </div>
                    <span className={`ready-pill ${p.is_ready ? "ready" : ""}`}>
                      {p.is_ready ? "Listo" : "Esperando…"}
                    </span>
                  </div>
                ))}
              </div>

              <div className="action-row">
                <button
                  type="button"
                  className={`btn ${me?.is_ready ? "btn-ghost" : "btn-secondary"}`}
                  disabled={busy}
                  onClick={toggleReady}
                >
                  <CheckCircle2 size={18} /> {me?.is_ready ? "Cancelar listo" : "Estoy listo"}
                </button>
                {isHost && (
                  <button
                    type="button"
                    className="btn btn-gold btn-lg"
                    disabled={busy || !allReady}
                    onClick={handleStart}
                  >
                    <Play size={18} /> Iniciar partida ({room.players.length} jugadores)
                  </button>
                )}
              </div>
            </section>
          </div>
        )}

        {(room.status === "playing" || room.status === "reveal") && q && (
          <div className="mp-play-layout">
            <section key={q.ordinal} className="stage-card stage-enter">
              <div className="stage-top-bar">
                <span className="stage-q-badge">
                  PREGUNTA {q.ordinal} · {q.subject_name}
                </span>
                <span className="stage-pts-badge">
                  {q.base_points} pts × {q.multiplier}
                  {myAns?.double_active ? " ×2" : ""}
                </span>
                <span className="meta-chip">
                  <Users size={14} /> {room.answered_players_count}/{room.players.length}
                </span>
              </div>

              {room.status === "playing" && (
                <div className="stage-timer">
                  <div className="timer-track neon">
                    <div
                      className={`timer-fill ${displayTime <= 4 ? "urgent" : ""}`}
                      style={{ width: `${timerPct}%` }}
                    />
                  </div>
                  <span className={`timer-clock ${displayTime <= 4 ? "urgent" : ""}`}>
                    <Clock size={16} />
                    {`${displayTime}s`}
                  </span>
                </div>
              )}

              {extraTimeNotice && room.status === "playing" && (
                <div className="alert alert-warning" style={{ marginBottom: "0.9rem" }}>
                  <strong>{extraTimeNotice}</strong>
                </div>
              )}

              <div className="stage-question-box">
                <h2 className="stage-question-text">{q.prompt}</h2>
              </div>

              <div className={`arcade-options-grid ${q.qtype === "verdadero_falso" ? "vf-grid" : ""}`}>
                {q.options.map((opt, idx) => {
                  const eliminated = myAns?.eliminated_options?.includes(opt);
                  const isCorrect = q.correct_text === opt;
                  const isWrongPick =
                    Boolean(q.correct_text) &&
                    myAns?.selected_text === opt &&
                    !myAns.is_correct;
                  let cls = `arcade-option opt-color-${idx % 4}`;
                  if (eliminated) cls += " eliminated";
                  if (isCorrect) cls += " correct anim-correct";
                  else if (isWrongPick) cls += " wrong anim-wrong";
                  return (
                    <button
                      key={`${q.ordinal}-${idx}`}
                      type="button"
                      className={cls}
                      disabled={busy || eliminated || Boolean(myAns?.answered) || room.status !== "playing"}
                      onClick={() => handleAnswer(opt)}
                    >
                      <span className={`arcade-letter letter-${idx % 4}`}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="arcade-option-text">{opt}</span>
                    </button>
                  );
                })}
              </div>

              {room.lifelines_enabled && room.status === "playing" && !myAns?.answered && me && (
                <div className="arcade-lifelines">
                  <button
                    type="button"
                    className="lifeline-tile"
                    disabled={busy || me.lifelines_used.fifty_fifty || q.qtype !== "opcion_multiple"}
                    onClick={() => handleLifeline("fifty_fifty")}
                  >
                    <Split size={20} />
                    <span>50:50</span>
                  </button>
                  <button
                    type="button"
                    className="lifeline-tile"
                    disabled={busy || me.lifelines_used.extra_time}
                    onClick={() => handleLifeline("extra_time")}
                  >
                    <Clock size={20} />
                    <span>+10s</span>
                  </button>
                  <button
                    type="button"
                    className="lifeline-tile gold"
                    disabled={busy || me.lifelines_used.double_points}
                    onClick={() => handleLifeline("double_points")}
                  >
                    <Zap size={20} />
                    <span>×2 PTS</span>
                  </button>
                  <button
                    type="button"
                    className="lifeline-tile"
                    disabled={busy || me.lifelines_used.skip}
                    onClick={() => handleLifeline("skip")}
                  >
                    <SkipForward size={20} />
                    <span>SALTAR</span>
                  </button>
                </div>
              )}

              {q.correct_text && (
                <div
                  className={`feedback-panel ${
                    myAns?.is_correct ? "is-correct anim-correct" : "is-wrong anim-wrong"
                  }`}
                >
                  <p className="feedback-answer">
                    <strong>Respuesta correcta:</strong> {q.correct_text}
                    {myAns?.is_correct ? ` (+${myAns.points_earned} pts)` : ""}
                  </p>
                  {q.explanation && (
                    <p className="feedback-explanation">
                      <strong>Explicación:</strong> {q.explanation}
                    </p>
                  )}
                </div>
              )}

              {isHost && (() => {
                const allAnswered =
                  room.players.length > 0 && room.answered_players_count >= room.players.length;
                const canClose = room.status === "playing" && (allAnswered || roomTimeLeft <= 0);
                const canNext = room.status === "reveal";
                return (
                  <div
                    className="feedback-actions"
                    style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}
                  >
                    <div>
                      {room.status === "playing" && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={busy || !canClose}
                          onClick={handleAdvance}
                        >
                          {canClose
                            ? "Cerrar pregunta y revelar"
                            : `Esperando respuestas (${room.answered_players_count}/${room.players.length}) · ${roomTimeLeft}s`}
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn btn-gold btn-lg"
                      disabled={busy || !canNext}
                      onClick={handleAdvance}
                    >
                      {q.ordinal >= room.total_questions
                        ? "Finalizar partida y ver podio"
                        : "Siguiente pregunta"}
                      <ArrowRight size={18} />
                    </button>
                  </div>
                );
              })()}
            </section>

            <aside className="card leaderboard-card">
              <h3>
                <Trophy size={18} className="gold-text" /> Posiciones en vivo
              </h3>
              <div className="leaderboard-list">
                {room.players.map((p, idx) => (
                  <div
                    key={p.student_id}
                    className={`lb-row ${p.student_id === student.id ? "is-me" : ""}`}
                  >
                    <span className={`rank-medal rank-${idx + 1}`}>{idx + 1}</span>
                    <div className="lb-info">
                      <strong>{p.student_name}</strong>
                      <span className="muted" style={{ fontSize: "0.78rem" }}>
                        {p.correct_count} aciertos
                        {p.current_streak >= 2 ? ` · 🔥x${p.current_streak}` : ""}
                      </span>
                    </div>
                    <strong className="lb-score">{p.score.toLocaleString()}</strong>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        )}

        {room.status === "finished" && (
          <section className="card summary-hero stage-card">
            <Trophy size={40} className="gold-text" />
            <h2>¡Partida Multijugador Finalizada!</h2>

            <Podium
              entries={room.players.map((p) => ({
                id: p.student_id,
                name: p.student_name,
                avatar: p.student_name.slice(0, 2).toUpperCase(),
                isHuman: p.student_id === student.id,
                scoreLabel: `${p.score.toLocaleString()} pts`
              }))}
            />

            <div className="leaderboard-list wide">
              {room.players.map((p, idx) => (
                <div
                  key={p.student_id}
                  className={`lb-row podium-row ${p.final_rank === 1 ? "winner" : ""} ${
                    p.student_id === student.id ? "is-me" : ""
                  }`}
                >
                  <span className={`rank-medal rank-${p.final_rank ?? idx + 1}`}>
                    {p.final_rank ?? idx + 1}
                  </span>
                  <div className="lb-info">
                    <strong>
                      {p.student_name}{" "}
                      {p.final_rank === 1 && p.was_behind && (
                        <span className="record-tag">
                          <Flame size={13} /> ¡Remontada!
                        </span>
                      )}
                    </strong>
                    <span className="muted">
                      {p.correct_count} correctas · {p.incorrect_count} incorrectas · Mejor racha:{" "}
                      {p.best_streak}
                    </span>
                  </div>
                  <strong className="lb-score">{p.score.toLocaleString()} pts</strong>
                </div>
              ))}
            </div>
            <div className="action-row">
              <button type="button" className="btn btn-gold btn-lg" onClick={onExit}>
                <Home size={18} /> Volver al menú principal
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
