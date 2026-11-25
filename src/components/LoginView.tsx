import React, { useEffect, useState } from "react";
import { Brain, LogIn, Sparkles, UserPlus } from "lucide-react";
import { enterStudent, listStudents } from "../services/triviaApi";
import type { Student } from "../types/trivia";

interface Props {
  pendingRoomCode?: string | null;
  onLogin: (student: Student) => void;
}

export const LoginView: React.FC<Props> = ({ pendingRoomCode, onLogin }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listStudents()
      .then(setStudents)
      .catch((err) => setError(err instanceof Error ? err.message : "Error cargando perfiles."))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError("Escribe un nombre de al menos 2 caracteres.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const student = await enterStudent(name);
      onLogin(student);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="brand-badge">
          <Brain size={34} />
          <div>
            <h1>Buensoft Trivia</h1>
            <p className="muted">Banco de preguntas compartido con Buensoft Evalua</p>
          </div>
        </div>

        {pendingRoomCode && (
          <div className="alert alert-success">
            <Sparkles size={18} />
            <span>
              Te invitaron a la sala <strong>{pendingRoomCode}</strong>. Entra con tu cuenta o
              perfil para unirte automáticamente.
            </span>
          </div>
        )}

        <p className="login-lead">
          Entra con tu cuenta de Google desde <strong>Buensoft Workspace</strong> o elige un perfil
          para guardar tus récords, rachas, logros y estadísticas.
        </p>

        <a
          className="btn btn-gold btn-lg"
          href="https://buensoft.com/workspace/?entrada=trivia"
          style={{ textDecoration: "none" }}
        >
          <LogIn size={19} /> Entrar con Google (Buensoft Workspace)
        </a>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="section-block">
          <h3>Perfiles registrados</h3>
          {loading ? (
            <p className="muted">Cargando perfiles de Buensoft Evalua…</p>
          ) : students.length === 0 ? (
            <p className="muted">Aún no hay perfiles registrados.</p>
          ) : (
            <div className="student-grid">
              {students.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="student-pill"
                  onClick={() => onLogin(s)}
                >
                  <span className="avatar-circle">{s.name.slice(0, 2).toUpperCase()}</span>
                  <span>{s.name}</span>
                  <LogIn size={16} />
                </button>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="section-block">
          <h3>O entra con un nombre nuevo</h3>
          <div className="inline-form">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Sofía, Carlos…"
              maxLength={60}
              disabled={submitting}
            />
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              <UserPlus size={18} />
              {submitting ? "Entrando…" : "Entrar"}
            </button>
          </div>
        </form>

        <div className="login-footer muted">
          <Sparkles size={15} />
          <span>Conectado a la base de datos de Buensoft Evalua (tablas separadas trivia_*)</span>
        </div>
      </div>
    </div>
  );
};
