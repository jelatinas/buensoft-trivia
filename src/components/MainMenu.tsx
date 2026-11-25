import React, { useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Database,
  HelpCircle,
  LogOut,
  Play,
  Trophy,
  Users,
  Zap
} from "lucide-react";
import type { Category, Student } from "../types/trivia";
import { InstructionsModal } from "./shared/InstructionsModal";
import { SoundToggle } from "./shared/SoundToggle";
import { ThemePicker } from "./shared/ThemePicker";

interface Props {
  student: Student;
  categories: Category[];
  schemaReady: boolean;
  onSelectSolo: () => void;
  onSelectMultiplayer: () => void;
  onOpenStats: () => void;
  onOpenAdmin: () => void;
  onLogout: () => void;
}

export const MainMenu: React.FC<Props> = ({
  student,
  categories,
  schemaReady,
  onSelectSolo,
  onSelectMultiplayer,
  onOpenStats,
  onOpenAdmin,
  onLogout
}) => {
  const [showInstructions, setShowInstructions] = useState(false);
  const totalQuestions = categories.reduce((acc, c) => acc + (c.question_count || 0), 0);

  return (
    <div className="page-shell">
      <header className="topbar">
        <div className="brand-inline">
          <img src="/icon.png" alt="Buensoft Trivia" style={{ width: 38, height: 38, borderRadius: 10 }} />
          <div>
            <strong>Buensoft Trivia</strong>
            <span className="tag-pill">Evalua Banco Compartido</span>
          </div>
        </div>
        <div className="topbar-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setShowInstructions(true)}>
            <HelpCircle size={18} /> Instrucciones
          </button>
          <button type="button" className="btn btn-ghost" onClick={onOpenStats}>
            <BarChart3 size={18} /> Estadísticas
          </button>
          <button type="button" className="btn btn-ghost" onClick={onOpenAdmin}>
            <Database size={18} /> Banco JSON
          </button>
          <SoundToggle />
          <div className="user-chip">
            <span className="avatar-sm">{student.name.slice(0, 2).toUpperCase()}</span>
            <span>{student.name}</span>
          </div>
          <button type="button" className="btn btn-icon" onClick={onLogout} title="Cambiar perfil">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="main-container">
        {!schemaReady && (
          <div className="alert alert-warning">
            <AlertTriangle size={20} />
            <div>
              <strong>Falta inicializar las tablas de Trivia en Supabase.</strong>
              <p>
                Ejecuta una sola vez el archivo <code>supabase/001_trivia_schema.sql</code> en el
                SQL Editor de tu proyecto Supabase para activar el Modo SOLO, Multijugador, Admin
                JSON y Estadísticas. (Ya se detectaron {categories.length} materias y{" "}
                {totalQuestions} preguntas de Buensoft Evalua).
              </p>
            </div>
          </div>
        )}

        <section className="hero-banner">
          <div>
            <span className="eyebrow">Hola, {student.name}</span>
            <h2>Elige tu modalidad de juego</h2>
            <p className="muted">
              Banco centralizado activo con <strong>{categories.length} categorías</strong> y{" "}
              <strong>{totalQuestions.toLocaleString()} preguntas</strong> compartidas con Buensoft
              Evalua.
            </p>
          </div>
          <div className="hero-badges">
            <ThemePicker />
            <div className="mini-stat">
              <BookOpen size={18} />
              <span>{categories.length} materias</span>
            </div>
            <div className="mini-stat">
              <Zap size={18} />
              <span>{totalQuestions.toLocaleString()} preguntas</span>
            </div>
          </div>
        </section>

        <section className="mode-grid">
          <article className="mode-card mode-solo">
            <div className="mode-icon">
              <Trophy size={32} />
            </div>
            <div className="mode-header">
              <span className="mode-tag">Contra la PC · 5 niveles</span>
              <h3>MODO SOLO (vs PC)</h3>
            </div>
            <p className="mode-desc">
              Compite contra personajes ficticios de la PC (de nivel bajo a experto) simulando una
              partida multijugador en vivo, o practica a tu propio ritmo.
            </p>
            <ul className="mode-features">
              <li>Elige hasta 5 rivales de la PC (desde Tito el Curioso hasta Dr. Kronos IA)</li>
              <li>Marcador en vivo por ronda, multiplicadores, rachas y comodines</li>
              <li>Explicación educativa tras cada pregunta y repaso de fallos</li>
              <li>Incluye Modo Práctica sin límite de tiempo</li>
            </ul>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={onSelectSolo}
              disabled={!schemaReady}
            >
              <Play size={20} /> Jugar MODO SOLO
            </button>
          </article>

          <article className="mode-card mode-mp">
            <div className="mode-icon">
              <Users size={32} />
            </div>
            <div className="mode-header">
              <span className="mode-tag">En tiempo real · Salas por código</span>
              <h3>MODO MULTIJUGADOR</h3>
            </div>
            <p className="mode-desc">
              Desafía a tus amigos y compite en tiempo real con rondas sincronizadas y remontadas.
            </p>
            <ul className="mode-features">
              <li>Crea una partida o únete mediante código de 6 caracteres</li>
              <li>Sala de espera con confirmación de jugadores listos</li>
              <li>Compite por rondas usando multiplicadores y comodines</li>
              <li>Marcador en vivo, podio final y registro de remontadas</li>
            </ul>
            <button
              type="button"
              className="btn btn-secondary btn-lg"
              onClick={onSelectMultiplayer}
              disabled={!schemaReady}
            >
              <Users size={20} /> Ir a MULTIJUGADOR
            </button>
          </article>
        </section>
      </main>
      {showInstructions && <InstructionsModal onClose={() => setShowInstructions(false)} />}
    </div>
  );
};
