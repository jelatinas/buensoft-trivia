import React, { useState } from "react";
import { LogIn, Sparkles, UserPlus, X } from "lucide-react";
import { APP_VERSION } from "../config/version";
import { enterStudent } from "../services/triviaApi";
import type { Student } from "../types/trivia";

export const DEVICE_PROFILES_KEY = "buensoft-trivia-device-profiles";

export function loadDeviceProfiles(): Student[] {
  try {
    const raw = localStorage.getItem(DEVICE_PROFILES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.id === "string" && typeof item.name === "string");
  } catch {
    return [];
  }
}

export function saveDeviceProfile(student: Student): Student[] {
  const current = loadDeviceProfiles().filter((s) => s.id !== student.id);
  const next = [{ id: student.id, name: student.name }, ...current].slice(0, 12);
  try {
    localStorage.setItem(DEVICE_PROFILES_KEY, JSON.stringify(next));
  } catch {
    // ignorar
  }
  return next;
}

function removeDeviceProfile(id: string): Student[] {
  const next = loadDeviceProfiles().filter((s) => s.id !== id);
  try {
    localStorage.setItem(DEVICE_PROFILES_KEY, JSON.stringify(next));
  } catch {
    // ignorar
  }
  return next;
}

interface Props {
  pendingRoomCode?: string | null;
  onLogin: (student: Student) => void;
}

export const LoginView: React.FC<Props> = ({ pendingRoomCode, onLogin }) => {
  const [profiles, setProfiles] = useState<Student[]>(() => loadDeviceProfiles());
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setProfiles(saveDeviceProfile(student));
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
          <img src="/icon.png" alt="Buensoft Trivia" style={{ width: 52, height: 52, borderRadius: 12 }} />
          <div>
            <h1 style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              Buensoft Trivia <span className="tag-pill">ver. {APP_VERSION}</span>
            </h1>
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
          Entra con tu cuenta de Google desde <strong>Buensoft Workspace</strong> o usa un perfil
          guardado en este dispositivo.
        </p>

        <a
          className="btn btn-gold btn-lg"
          href="https://buensoft.com/workspace/?entrada=trivia"
          style={{ textDecoration: "none" }}
        >
          <LogIn size={19} /> Entrar con Google (Buensoft Workspace)
        </a>

        {error && <div className="alert alert-error">{error}</div>}

        {profiles.length > 0 && (
          <div className="section-block">
            <h3>Perfiles en este dispositivo</h3>
            <div className="student-grid">
              {profiles.map((s) => (
                <div key={s.id} className="student-pill" style={{ paddingRight: "0.45rem" }}>
                  <button
                    type="button"
                    onClick={() => onLogin(s)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      flex: 1,
                      textAlign: "left",
                      padding: 0
                    }}
                  >
                    <span className="avatar-circle">{s.name.slice(0, 2).toUpperCase()}</span>
                    <span>{s.name}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-icon"
                    title="Quitar perfil de este dispositivo"
                    aria-label={`Quitar ${s.name}`}
                    style={{ padding: "0.25rem", borderRadius: 8 }}
                    onClick={() => setProfiles(removeDeviceProfile(s.id))}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="section-block">
          <h3>Crear o entrar con nombre</h3>
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
