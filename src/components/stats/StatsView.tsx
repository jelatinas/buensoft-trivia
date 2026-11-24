import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Award,
  Flame,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users
} from "lucide-react";
import { getPlayerStats } from "../../services/triviaApi";
import type { PlayerStats, Student } from "../../types/trivia";

interface Props {
  student: Student;
  onBack: () => void;
}

export const StatsView: React.FC<Props> = ({ student, onBack }) => {
  const [tab, setTab] = useState<"combined" | "solo" | "mp">("combined");
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPlayerStats(student.id)
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar las estadísticas."))
      .finally(() => setLoading(false));
  }, [student.id]);

  const totalGames = (stats?.solo.games_played ?? 0) + (stats?.multiplayer.games_played ?? 0);
  const totalCorrect = (stats?.solo.total_correct ?? 0) + (stats?.multiplayer.total_correct ?? 0);
  const totalIncorrect =
    (stats?.solo.total_incorrect ?? 0) + (stats?.multiplayer.total_incorrect ?? 0);
  const combinedAcc =
    totalCorrect + totalIncorrect > 0
      ? Math.round((totalCorrect / (totalCorrect + totalIncorrect)) * 1000) / 10
      : 0;

  const strengths = (stats?.categories ?? []).filter((c) => c.accuracy_pct >= 75);
  const needsWork = (stats?.categories ?? []).filter((c) => c.accuracy_pct < 60);

  return (
    <div className="page-shell">
      <header className="topbar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          <ArrowLeft size={18} /> Menú principal
        </button>
        <strong>Estadísticas de {student.name}</strong>
        <div className="tab-pills">
          <button
            type="button"
            className={`choice-pill ${tab === "combined" ? "active" : ""}`}
            onClick={() => setTab("combined")}
          >
            General
          </button>
          <button
            type="button"
            className={`choice-pill ${tab === "solo" ? "active" : ""}`}
            onClick={() => setTab("solo")}
          >
            MODO SOLO
          </button>
          <button
            type="button"
            className={`choice-pill ${tab === "mp" ? "active" : ""}`}
            onClick={() => setTab("mp")}
          >
            MULTIJUGADOR
          </button>
        </div>
      </header>

      <main className="main-container narrow">
        {loading && <div className="card">Cargando estadísticas…</div>}
        {error && <div className="alert alert-error">{error}</div>}

        {stats && tab === "combined" && (
          <div className="stack-lg">
            <section className="card">
              <h3>Resumen general combinado</h3>
              <div className="stats-4grid">
                <div className="stat-box">
                  <Trophy size={20} />
                  <strong>{totalGames}</strong>
                  <span>Partidas totales</span>
                </div>
                <div className="stat-box good">
                  <strong>{combinedAcc}%</strong>
                  <span>Precisión global</span>
                </div>
                <div className="stat-box fire">
                  <Flame size={20} />
                  <strong>{stats.solo.best_streak}</strong>
                  <span>Mejor racha SOLO</span>
                </div>
                <div className="stat-box">
                  <Award size={20} />
                  <strong>{stats.achievements.length}</strong>
                  <span>Logros</span>
                </div>
              </div>
            </section>

            <section className="card">
              <h3>Logros desbloqueados ({stats.achievements.length})</h3>
              {stats.achievements.length === 0 ? (
                <p className="muted">
                  Aún no tienes logros. Completa tu primera partida SOLO o Multijugador para
                  desbloquearlos.
                </p>
              ) : (
                <div className="achievement-grid">
                  {stats.achievements.map((a) => (
                    <div key={a.code} className="achievement-card">
                      <Award size={22} className="accent-icon" />
                      <div>
                        <strong>{a.title}</strong>
                        <p className="muted">{a.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {stats && tab === "solo" && (
          <div className="stack-lg">
            <section className="card">
              <h3>Estadísticas de MODO SOLO</h3>
              <div className="stats-4grid">
                <div className="stat-box">
                  <strong>{stats.solo.games_played}</strong>
                  <span>Partidas SOLO</span>
                </div>
                <div className="stat-box good">
                  <strong>{stats.solo.best_score.toLocaleString()}</strong>
                  <span>Récord personal</span>
                </div>
                <div className="stat-box">
                  <strong>{stats.solo.accuracy_pct}%</strong>
                  <span>Promedio de aciertos</span>
                </div>
                <div className="stat-box fire">
                  <strong>{stats.solo.best_streak}</strong>
                  <span>Mejor racha</span>
                </div>
              </div>
            </section>

            <div className="two-col-grid">
              <section className="card">
                <h4>
                  <TrendingUp size={18} className="good-text" /> Conocimientos fuertes
                </h4>
                {strengths.length === 0 ? (
                  <p className="muted">Juega partidas SOLO para detectar tus fortalezas (≥75%).</p>
                ) : (
                  <ul className="simple-list">
                    {strengths.map((c) => (
                      <li key={c.subject_id}>
                        <span>{c.subject_name}</span>
                        <strong className="good-text">{c.accuracy_pct}%</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="card">
                <h4>
                  <TrendingDown size={18} className="danger-text" /> Categorías para mejorar
                </h4>
                {needsWork.length === 0 ? (
                  <p className="muted">No hay categorías por debajo del 60% de aciertos.</p>
                ) : (
                  <ul className="simple-list">
                    {needsWork.map((c) => (
                      <li key={c.subject_id}>
                        <span>{c.subject_name}</span>
                        <strong className="danger-text">{c.accuracy_pct}%</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {stats.categories.length > 0 && (
              <section className="card">
                <h3>Progreso y récords por categoría</h3>
                <div className="cat-result-list">
                  {stats.categories.map((c) => (
                    <div key={c.subject_id} className="cat-result-item">
                      <div className="cat-result-head">
                        <strong>{c.subject_name}</strong>
                        <span>
                          {c.correct}/{c.answered} ({c.accuracy_pct}%) ·{" "}
                          {c.best_points.toLocaleString()} pts
                        </span>
                      </div>
                      <div className="mini-bar-track">
                        <div
                          className={`mini-bar-fill ${
                            c.accuracy_pct >= 75 ? "strong" : c.accuracy_pct < 60 ? "weak" : ""
                          }`}
                          style={{ width: `${c.accuracy_pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {stats && tab === "mp" && (
          <section className="card">
            <h3>
              <Users size={20} /> Estadísticas de MODO MULTIJUGADOR
            </h3>
            <div className="stats-4grid">
              <div className="stat-box">
                <strong>{stats.multiplayer.games_played}</strong>
                <span>Partidas jugadas</span>
              </div>
              <div className="stat-box good">
                <strong>{stats.multiplayer.wins}</strong>
                <span>Victorias ({stats.multiplayer.win_rate_pct}%)</span>
              </div>
              <div className="stat-box">
                <strong>{stats.multiplayer.avg_score.toLocaleString()}</strong>
                <span>Puntuación promedio</span>
              </div>
              <div className="stat-box fire">
                <strong>{stats.multiplayer.comebacks}</strong>
                <span>Remontadas ganadas</span>
              </div>
            </div>
            <div className="stats-4grid" style={{ marginTop: "1rem" }}>
              <div className="stat-box">
                <strong>{stats.multiplayer.best_score.toLocaleString()}</strong>
                <span>Máxima puntuación</span>
              </div>
              <div className="stat-box">
                <strong>#{stats.multiplayer.avg_rank || "-"}</strong>
                <span>Posición promedio</span>
              </div>
              <div className="stat-box">
                <strong>{stats.multiplayer.podiums}</strong>
                <span>Podios (Top 3)</span>
              </div>
              <div className="stat-box">
                <strong>{stats.multiplayer.total_correct}</strong>
                <span>Respuestas correctas</span>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
