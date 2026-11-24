import React, { useEffect } from "react";
import {
  Award,
  BookOpen,
  CheckCircle2,
  Flame,
  Home,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  XCircle
} from "lucide-react";
import type { BotMatchState } from "../../lib/aiOpponents";
import { playVictory } from "../../lib/soundEffects";
import type { SoloGameState, Student } from "../../types/trivia";
import { Podium } from "../shared/Podium";
import { SoundToggle } from "../shared/SoundToggle";

interface Props {
  student: Student;
  state: SoloGameState;
  bots: BotMatchState[];
  newlyUnlocked: Array<{ code: string; title: string }>;
  onPlayAgain: () => void;
  onPracticeMissed: (questionIds: string[]) => void;
  onChangeCategory: () => void;
  onMainMenu: () => void;
}

export const SoloSummary: React.FC<Props> = ({
  student,
  state,
  bots,
  newlyUnlocked,
  onPlayAgain,
  onPracticeMissed,
  onChangeCategory,
  onMainMenu
}) => {
  const total = state.correct_count + state.incorrect_count;
  const accuracy = total > 0 ? Math.round((state.correct_count / total) * 1000) / 10 : 0;
  const isPractice = state.mode === "practica";
  const newRecord = !isPractice && state.score > state.personal_best;

  useEffect(() => {
    playVictory();
  }, []);

  const finalStandings = [
    {
      id: student.id,
      name: student.name,
      avatar: student.name.slice(0, 2).toUpperCase(),
      tierLabel: "Tú",
      isHuman: true,
      score: state.score,
      correctCount: state.correct_count,
      bestStreak: state.best_streak
    },
    ...bots.map((b) => ({
      id: b.profile.id,
      name: b.profile.name,
      avatar: b.profile.avatar,
      tierLabel: b.profile.tierLabel,
      isHuman: false,
      score: b.score,
      correctCount: b.correctCount,
      bestStreak: b.bestStreak
    }))
  ].sort((a, b) => b.score - a.score || b.correctCount - a.correctCount);

  const myRank = finalStandings.findIndex((p) => p.isHuman) + 1;
  const hasBots = bots.length > 0;
  const celebrate = newRecord || (hasBots && myRank === 1) || accuracy >= 80;

  const byCategoryMap = new Map<
    string,
    { name: string; correct: number; total: number; points: number }
  >();
  for (const q of state.review_questions) {
    const cur = byCategoryMap.get(q.subject_id) ?? {
      name: q.subject_name,
      correct: 0,
      total: 0,
      points: 0
    };
    cur.total += 1;
    if (q.is_correct) cur.correct += 1;
    cur.points += q.points_earned;
    byCategoryMap.set(q.subject_id, cur);
  }
  const categoryBreakdown = Array.from(byCategoryMap.values()).sort(
    (a, b) => b.correct / Math.max(b.total, 1) - a.correct / Math.max(a.total, 1)
  );

  const missedQuestions = state.review_questions.filter((q) => !q.is_correct);
  const missedIds = missedQuestions.map((q) => q.question_id);

  return (
    <div className="page-shell show-stage-bg">
      {celebrate && (
        <div className="confetti-layer" aria-hidden="true">
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className={`confetti-piece c-${i % 4}`}
              style={{
                left: `${(i * 5.7) % 100}%`,
                animationDelay: `${(i % 6) * 0.18}s`
              }}
            />
          ))}
        </div>
      )}

      <header className="topbar">
        <strong>Resultados — MODO SOLO {hasBots ? "(vs PC)" : ""}</strong>
        <div className="topbar-actions">
          <span className="tag-pill">{isPractice ? "Modo Práctica" : "Modo Competitivo"}</span>
          <SoundToggle />
        </div>
      </header>

      <main className="main-container narrow">
        <section className="card summary-hero stage-card">
          {newRecord && (
            <div className="record-banner">
              <Sparkles size={18} /> ¡NUEVO RÉCORD PERSONAL!
            </div>
          )}
          <h2>
            {hasBots
              ? myRank === 1
                ? "🏆 ¡1er Lugar! Venciste a la PC"
                : `Terminaste en #${myRank} de ${finalStandings.length} jugadores`
              : accuracy >= 80
              ? "¡Excelente desempeño!"
              : accuracy >= 50
              ? "¡Buen trabajo!"
              : "¡Sigue practicando!"}
          </h2>

          {hasBots && (
            <Podium
              entries={finalStandings.map((p) => ({
                id: p.id,
                name: p.name,
                avatar: p.avatar,
                isHuman: p.isHuman,
                scoreLabel: isPractice ? `${p.correctCount} aciertos` : `${p.score.toLocaleString()} pts`
              }))}
            />
          )}

          {!isPractice && <div className="big-score">{state.score.toLocaleString()} pts</div>}
          {!isPractice && (
            <p className="muted">
              Récord anterior: <strong>{state.personal_best.toLocaleString()} pts</strong>
              {newRecord
                ? ` (+${(state.score - state.personal_best).toLocaleString()} pts)`
                : state.personal_best > state.score
                ? ` (a ${(state.personal_best - state.score).toLocaleString()} pts de superarlo)`
                : ""}
            </p>
          )}

          <div className="stats-4grid">
            <div className="stat-box">
              <Trophy size={20} className="gold-text" />
              <strong>{accuracy}%</strong>
              <span>Aciertos</span>
            </div>
            <div className="stat-box good">
              <CheckCircle2 size={20} />
              <strong>{state.correct_count}</strong>
              <span>Correctas</span>
            </div>
            <div className="stat-box bad">
              <XCircle size={20} />
              <strong>{state.incorrect_count}</strong>
              <span>Incorrectas</span>
            </div>
            <div className="stat-box fire">
              <Flame size={20} />
              <strong>{state.best_streak}</strong>
              <span>Mejor racha</span>
            </div>
          </div>

          {newlyUnlocked.length > 0 && (
            <div className="unlocked-strip">
              <Award size={18} />
              <span>
                <strong>Logros desbloqueados:</strong>{" "}
                {newlyUnlocked.map((a) => a.title).join(" · ")}
              </span>
            </div>
          )}

          <div className="action-row">
            <button type="button" className="btn btn-gold btn-lg" onClick={onPlayAgain}>
              <RotateCcw size={18} /> Volver a jugar
            </button>
            {missedIds.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onPracticeMissed(missedIds)}
              >
                <BookOpen size={18} /> Practicar incorrectas ({missedIds.length})
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={onChangeCategory}>
              <SlidersHorizontal size={18} /> Cambiar categoría / rivales
            </button>
            <button type="button" className="btn btn-ghost" onClick={onMainMenu}>
              <Home size={18} /> Menú principal
            </button>
          </div>
        </section>

        {hasBots && finalStandings.length > 3 && (
          <section className="card">
            <h3>Tabla completa de posiciones</h3>
            <div className="leaderboard-list">
              {finalStandings.map((p, idx) => (
                <div
                  key={p.id}
                  className={`lb-row ${idx === 0 ? "winner" : ""} ${p.isHuman ? "is-me" : ""}`}
                >
                  <span className={`rank-medal rank-${idx + 1}`}>{idx + 1}</span>
                  <span className="bot-lb-avatar">{p.avatar}</span>
                  <div className="lb-info">
                    <strong>
                      {p.name} {p.isHuman && <span className="tag-pill">Tú</span>}
                    </strong>
                    <span className="muted">
                      {p.tierLabel} · {p.correctCount} aciertos · Mejor racha: {p.bestStreak}
                    </span>
                  </div>
                  <strong className="lb-score">
                    {isPractice ? `${p.correctCount}✓` : `${p.score.toLocaleString()} pts`}
                  </strong>
                </div>
              ))}
            </div>
          </section>
        )}

        {categoryBreakdown.length > 0 && (
          <section className="card">
            <h3>Resultado por categoría</h3>
            <div className="cat-result-list">
              {categoryBreakdown.map((cat) => {
                const pct = Math.round((cat.correct / Math.max(cat.total, 1)) * 100);
                return (
                  <div key={cat.name} className="cat-result-item">
                    <div className="cat-result-head">
                      <strong>{cat.name}</strong>
                      <span>
                        {cat.correct}/{cat.total} ({pct}%)
                      </span>
                    </div>
                    <div className="mini-bar-track">
                      <div
                        className={`mini-bar-fill ${pct >= 75 ? "strong" : pct < 50 ? "weak" : ""}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {missedQuestions.length > 0 && (
          <section className="card">
            <h3>Preguntas incorrectas y explicaciones ({missedQuestions.length})</h3>
            <div className="missed-list">
              {missedQuestions.map((q) => (
                <article key={q.ordinal} className="missed-item">
                  <div className="missed-meta">
                    <span className="meta-chip">{q.subject_name}</span>
                    <span className="muted">Ronda {q.round_number}</span>
                  </div>
                  <p className="missed-prompt">{q.prompt}</p>
                  <p className="missed-yours">
                    <strong>Tu respuesta:</strong>{" "}
                    {q.is_skipped
                      ? "(Saltada con comodín)"
                      : q.selected_text || "(Sin respuesta / Tiempo agotado)"}
                  </p>
                  <p className="missed-correct">
                    <strong>Respuesta correcta:</strong> {q.correct_text}
                  </p>
                  {q.explanation && (
                    <p className="missed-exp">
                      <strong>Explicación:</strong> {q.explanation}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
