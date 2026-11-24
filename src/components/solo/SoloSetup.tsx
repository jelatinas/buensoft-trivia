import React, { useState } from "react";
import {
  ArrowLeft,
  BookOpenCheck,
  Bot,
  Flame,
  Play,
  ShieldCheck,
  Sparkles,
  Timer
} from "lucide-react";
import { AI_OPPONENTS, DEFAULT_BOT_IDS } from "../../lib/aiOpponents";
import type { Category, DifficultyFilter, SoloConfig, SoloMode } from "../../types/trivia";

interface Props {
  categories: Category[];
  initialConfig?: SoloConfig;
  loading: boolean;
  error: string | null;
  onStart: (config: SoloConfig) => void;
  onBack: () => void;
}

const DEFAULT_CONFIG: SoloConfig = {
  mode: "competitivo",
  totalRounds: 6,
  questionsPerRound: 5,
  timeLimitSec: 15,
  subjectIds: [],
  difficulty: "mixta",
  lifelinesEnabled: true,
  botIds: DEFAULT_BOT_IDS
};

export const SoloSetup: React.FC<Props> = ({
  categories,
  initialConfig,
  loading,
  error,
  onStart,
  onBack
}) => {
  const [config, setConfig] = useState<SoloConfig>(
    initialConfig
      ? { ...DEFAULT_CONFIG, ...initialConfig }
      : DEFAULT_CONFIG
  );
  const [allCategories, setAllCategories] = useState<boolean>(
    !initialConfig || initialConfig.subjectIds.length === 0
  );

  const availableQuestions = (allCategories
    ? categories
    : categories.filter((c) => config.subjectIds.includes(c.id))
  ).reduce((sum, c) => sum + (c.question_count || 0), 0);

  const requestedTotal = config.totalRounds * config.questionsPerRound;

  function toggleCategory(id: string) {
    setAllCategories(false);
    setConfig((prev) => {
      const exists = prev.subjectIds.includes(id);
      const nextIds = exists
        ? prev.subjectIds.filter((item) => item !== id)
        : [...prev.subjectIds, id];
      return { ...prev, subjectIds: nextIds };
    });
  }

  function selectAllCategories() {
    setAllCategories(true);
    setConfig((prev) => ({ ...prev, subjectIds: [] }));
  }

  function handleMode(mode: SoloMode) {
    setConfig((prev) => ({ ...prev, mode }));
  }

  function toggleBot(id: string) {
    setConfig((prev) => {
      const exists = prev.botIds.includes(id);
      const next = exists
        ? prev.botIds.filter((item) => item !== id)
        : [...prev.botIds, id];
      return { ...prev, botIds: next };
    });
  }

  return (
    <div className="page-shell">
      <header className="topbar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          <ArrowLeft size={18} /> Menú principal
        </button>
        <strong>Configurar MODO SOLO (vs PC)</strong>
        <span className="tag-pill">{Math.min(requestedTotal, availableQuestions)} preguntas</span>
      </header>

      <main className="main-container narrow">
        {error && <div className="alert alert-error">{error}</div>}

        <section className="card">
          <h3>Tipo de experiencia</h3>
          <div className="segment-grid">
            <button
              type="button"
              className={`segment-card ${config.mode === "competitivo" ? "active" : ""}`}
              onClick={() => handleMode("competitivo")}
            >
              <Flame size={22} />
              <div>
                <strong>Competitivo vs PC (Multijugador simulado)</strong>
                <p className="muted">
                  Puntaje progresivo (100 a 1,000+ pts), marcador en vivo contra la PC, rachas y
                  récord personal.
                </p>
              </div>
            </button>
            <button
              type="button"
              className={`segment-card ${config.mode === "practica" ? "active" : ""}`}
              onClick={() => handleMode("practica")}
            >
              <BookOpenCheck size={22} />
              <div>
                <strong>Modo Práctica</strong>
                <p className="muted">
                  Sin límite de tiempo y sin presión de puntuación. Ideal para estudiar y repasar.
                </p>
              </div>
            </button>
          </div>
        </section>

        <section className="card">
          <div className="card-header-row">
            <div>
              <h3>
                <Bot size={20} /> Rivales de la PC ({config.botIds.length} seleccionados)
              </h3>
              <p className="muted">
                Elige uno o varios personajes ficticios (de nivel bajo a experto) para simular una
                partida multijugador en tiempo real.
              </p>
            </div>
            <div className="pill-row">
              <button
                type="button"
                className="choice-pill"
                onClick={() =>
                  setConfig((p) => ({ ...p, botIds: AI_OPPONENTS.map((b) => b.id) }))
                }
              >
                Todos (5)
              </button>
              <button
                type="button"
                className="choice-pill"
                onClick={() => setConfig((p) => ({ ...p, botIds: [] }))}
              >
                Sin rivales
              </button>
            </div>
          </div>

          <div className="bot-grid">
            {AI_OPPONENTS.map((bot) => {
              const selected = config.botIds.includes(bot.id);
              return (
                <button
                  key={bot.id}
                  type="button"
                  className={`bot-card ${selected ? "active" : ""}`}
                  style={{ ["--bot-accent" as string]: bot.accent }}
                  onClick={() => toggleBot(bot.id)}
                >
                  <div className="bot-card-top">
                    <span className="bot-avatar">{bot.avatar}</span>
                    <div className="bot-title">
                      <strong>{bot.name}</strong>
                      <span className="bot-tier" style={{ color: bot.accent }}>
                        {bot.tierLabel} · ~{Math.round(bot.baseAccuracy * 100)}% aciertos
                      </span>
                    </div>
                    <span className={`bot-check ${selected ? "on" : ""}`}>
                      {selected ? "✓" : "+"}
                    </span>
                  </div>
                  <p className="bot-tagline muted">{bot.tagline}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="card">
          <h3>Estructura de rondas</h3>
          <div className="setup-grid">
            <div className="field-group">
              <label>Número de rondas</label>
              <div className="pill-row">
                {([3, 5, 6, 10] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`choice-pill ${config.totalRounds === r ? "active" : ""}`}
                    onClick={() => setConfig((p) => ({ ...p, totalRounds: r }))}
                  >
                    {r} rondas
                  </button>
                ))}
              </div>
            </div>

            <div className="field-group">
              <label>Preguntas por ronda</label>
              <div className="pill-row">
                {([5, 10, 15] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    className={`choice-pill ${config.questionsPerRound === q ? "active" : ""}`}
                    onClick={() => setConfig((p) => ({ ...p, questionsPerRound: q }))}
                  >
                    {q} / ronda
                  </button>
                ))}
              </div>
            </div>

            <div className="field-group">
              <label>
                <Timer size={15} /> Tiempo por pregunta
              </label>
              {config.mode === "practica" ? (
                <p className="muted">Desactivado en Modo Práctica (sin límite de tiempo).</p>
              ) : (
                <div className="pill-row">
                  {([5, 10, 15, 20] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`choice-pill ${config.timeLimitSec === t ? "active" : ""}`}
                      onClick={() => setConfig((p) => ({ ...p, timeLimitSec: t }))}
                    >
                      {t}s
                    </button>
                  ))}
                </div>
              )}
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
                    className={`choice-pill ${config.difficulty === val ? "active" : ""}`}
                    onClick={() => setConfig((p) => ({ ...p, difficulty: val }))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="toggle-row">
            <div>
              <strong>
                <Sparkles size={16} /> Comodines (50/50, +10s, x2 Puntos, Saltar)
              </strong>
              <p className="muted">Un uso de cada comodín durante toda la partida.</p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={config.lifelinesEnabled}
                onChange={(e) =>
                  setConfig((p) => ({ ...p, lifelinesEnabled: e.target.checked }))
                }
              />
              <span className="slider" />
            </label>
          </div>
        </section>

        <section className="card">
          <div className="card-header-row">
            <div>
              <h3>Categorías del banco compartido</h3>
              <p className="muted">
                {allCategories
                  ? `Todas las categorías (${availableQuestions} preguntas)`
                  : `${config.subjectIds.length} seleccionadas (${availableQuestions} preguntas)`}
              </p>
            </div>
            <button
              type="button"
              className={`choice-pill ${allCategories ? "active" : ""}`}
              onClick={selectAllCategories}
            >
              Todas
            </button>
          </div>

          <div className="category-grid">
            {categories.map((cat) => {
              const selected = !allCategories && config.subjectIds.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`category-chip ${selected ? "active" : ""}`}
                  onClick={() => toggleCategory(cat.id)}
                >
                  <span className="cat-name">{cat.name}</span>
                  <span className="cat-count">{cat.question_count} preg.</span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="setup-footer">
          <div className="muted">
            <ShieldCheck size={16} /> Respuestas validadas en servidor ·{" "}
            {config.botIds.length > 0
              ? `Simulando partida contra ${config.botIds.length} rival(es) de la PC`
              : "Partida individual sin rivales"}
          </div>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={loading || (!allCategories && config.subjectIds.length === 0)}
            onClick={() =>
              onStart({
                ...config,
                subjectIds: allCategories ? [] : config.subjectIds
              })
            }
          >
            <Play size={20} />
            {loading
              ? "Preparando partida…"
              : `Comenzar (${Math.min(requestedTotal, availableQuestions)} preguntas)`}
          </button>
        </div>
      </main>
    </div>
  );
};
