import React, { useState } from "react";
import { ArrowLeft, KeyRound, PlusCircle, Users } from "lucide-react";
import { createMpRoom, joinMpRoom } from "../../services/triviaApi";
import type { Category, DifficultyFilter, MpRoomState, Student } from "../../types/trivia";

interface Props {
  student: Student;
  categories: Category[];
  onEnterRoom: (room: MpRoomState) => void;
  onBack: () => void;
}

export const MpHub: React.FC<Props> = ({ student, categories, onEnterRoom, onBack }) => {
  const [code, setCode] = useState("");
  const [totalRounds, setTotalRounds] = useState<3 | 5 | 6 | 10>(6);
  const [questionsPerRound, setQuestionsPerRound] = useState<5 | 10 | 15>(5);
  const [timeLimitSec, setTimeLimitSec] = useState<5 | 10 | 15 | 20>(15);
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("mixta");
  const [lifelinesEnabled, setLifelinesEnabled] = useState(true);
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleCategory(id: string) {
    setSubjectIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim().length < 4) {
      setError("Ingresa el código de 6 caracteres de la sala.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const room = await joinMpRoom(code, student.id);
      onEnterRoom(room);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo unir a la sala.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      const room = await createMpRoom(student.id, {
        totalRounds,
        questionsPerRound,
        timeLimitSec,
        subjectIds,
        difficulty,
        lifelinesEnabled
      });
      onEnterRoom(room);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la sala.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-shell">
      <header className="topbar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          <ArrowLeft size={18} /> Menú principal
        </button>
        <strong>MODO MULTIJUGADOR</strong>
        <span className="tag-pill">Tiempo real</span>
      </header>

      <main className="main-container narrow">
        {error && <div className="alert alert-error">{error}</div>}

        <section className="card">
          <h3>
            <KeyRound size={20} /> Unirse mediante código
          </h3>
          <p className="muted">Pide el código de 6 caracteres al anfitrión de la partida.</p>
          <form onSubmit={handleJoin} className="inline-form">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ej. A7K9PQ"
              maxLength={8}
              className="code-input"
              disabled={busy}
            />
            <button type="submit" className="btn btn-secondary" disabled={busy}>
              <Users size={18} /> Unirse
            </button>
          </form>
        </section>

        <section className="card">
          <h3>
            <PlusCircle size={20} /> Crear nueva sala multijugador
          </h3>
          <p className="muted">
            Comparte el código con tus amigos, espera a que todos marquen Listo y compitan por
            rondas.
          </p>

          <div className="setup-grid">
            <div className="field-group">
              <label>Rondas</label>
              <div className="pill-row">
                {([3, 5, 6, 10] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`choice-pill ${totalRounds === r ? "active" : ""}`}
                    onClick={() => setTotalRounds(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="field-group">
              <label>Preguntas / ronda</label>
              <div className="pill-row">
                {([5, 10, 15] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    className={`choice-pill ${questionsPerRound === q ? "active" : ""}`}
                    onClick={() => setQuestionsPerRound(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="field-group">
              <label>Tiempo por pregunta</label>
              <div className="pill-row">
                {([5, 10, 15, 20] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`choice-pill ${timeLimitSec === t ? "active" : ""}`}
                    onClick={() => setTimeLimitSec(t)}
                  >
                    {t}s
                  </button>
                ))}
              </div>
            </div>

            <div className="field-group">
              <label>Dificultad</label>
              <div className="pill-row">
                {(
                  [
                    ["mixta", "Mixta"],
                    ["facil", "Fácil"],
                    ["media", "Media"],
                    ["dificil", "Difícil"]
                  ] as Array<[DifficultyFilter, string]>
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    className={`choice-pill ${difficulty === val ? "active" : ""}`}
                    onClick={() => setDifficulty(val)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="toggle-row">
            <div>
              <strong>Comodines habilitados</strong>
              <p className="muted">50/50, +10s, x2 Puntos y Saltar.</p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={lifelinesEnabled}
                onChange={(e) => setLifelinesEnabled(e.target.checked)}
              />
              <span className="slider" />
            </label>
          </div>

          <div className="field-group">
            <label>
              Categorías ({subjectIds.length === 0 ? "Todas" : `${subjectIds.length} seleccionadas`})
            </label>
            <div className="category-grid compact">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`category-chip ${subjectIds.includes(cat.id) ? "active" : ""}`}
                  onClick={() => toggleCategory(cat.id)}
                >
                  <span className="cat-name">{cat.name}</span>
                  <span className="cat-count">{cat.question_count}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={busy}
            onClick={handleCreate}
          >
            <PlusCircle size={20} /> {busy ? "Creando sala…" : "Crear sala y generar código"}
          </button>
        </section>
      </main>
    </div>
  );
};
