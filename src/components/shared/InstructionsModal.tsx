import React from "react";
import { BookOpen, Flame, HelpCircle, Sparkles, Trophy, Users, X } from "lucide-react";

interface Props {
  onClose: () => void;
}

export const InstructionsModal: React.FC<Props> = ({ onClose }) => {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="inst-title">
      <div className="modal-card" style={{ maxWidth: 680 }}>
        <div className="card-header-row" style={{ marginBottom: "0.25rem" }}>
          <h3 id="inst-title" style={{ margin: 0 }}>
            <HelpCircle size={20} className="accent-icon" /> Instrucciones — Buensoft Trivia
          </h3>
          <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="stack-lg" style={{ gap: "0.9rem" }}>
          <section className="missed-item">
            <h4 style={{ margin: "0 0 0.4rem" }}>
              <Trophy size={16} className="gold-text" /> MODO SOLO (vs PC y Práctica)
            </h4>
            <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
              Juega inmediatamente contra <strong>1 a 5 personajes de la PC</strong> (desde{" "}
              <em>Tito el Curioso</em> en Nivel Bajo hasta <em>Dr. Kronos IA</em> en Experto) con
              marcador y podio en vivo, o activa el <strong>Modo Práctica</strong> para estudiar sin
              límite de tiempo ni presión de puntaje.
            </p>
          </section>

          <section className="missed-item">
            <h4 style={{ margin: "0 0 0.4rem" }}>
              <Users size={16} className="accent-icon" /> MODO MULTIJUGADOR
            </h4>
            <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
              Crea una sala e invita a tus amigos con el <strong>enlace directo</strong>, por{" "}
              <strong>WhatsApp</strong> o con el <strong>código de 6 letras</strong>. Cuando todos
              marquen <em>Estoy listo</em>, el anfitrión inicia la partida. El botón de avanzar solo
              se habilita cuando <strong>todos contestan</strong> o termina el reloj.
            </p>
          </section>

          <section className="missed-item">
            <h4 style={{ margin: "0 0 0.4rem" }}>
              <Flame size={16} style={{ color: "#fbbf24" }} /> Puntuación progresiva y rachas
            </h4>
            <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
              Cada ronda vale más puntos base (<strong>100, 200, 300, 400, 500, 1,000+</strong>) y
              aplica su multiplicador de ronda (×1.0 hasta ×3.0). Encadenar{" "}
              <strong>3 o más aciertos seguidos</strong> suma un bono extra de racha. Todas las
              respuestas se validan en el servidor.
            </p>
          </section>

          <section className="missed-item">
            <h4 style={{ margin: "0 0 0.4rem" }}>
              <Sparkles size={16} className="gold-text" /> Comodines (1 uso por partida)
            </h4>
            <ul className="mode-features" style={{ margin: 0 }}>
              <li>
                <strong>50:50</strong>: elimina 2 opciones incorrectas (en opción múltiple).
              </li>
              <li>
                <strong>+10s</strong>: agrega 10 segundos al reloj de la pregunta actual.
              </li>
              <li>
                <strong>×2 PTS</strong>: duplica los puntos si aciertas esa pregunta.
              </li>
              <li>
                <strong>SALTAR</strong>: protege tu racha sin contar error y te muestra la respuesta
                correcta con su explicación.
              </li>
            </ul>
          </section>

          <section className="missed-item">
            <h4 style={{ margin: "0 0 0.4rem" }}>
              <BookOpen size={16} className="good-text" /> Aprendizaje y Estadísticas
            </h4>
            <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
              Después de cada pregunta verás la <strong>explicación educativa</strong>. Al terminar
              en Modo SOLO puedes repasar únicamente tus preguntas incorrectas y consultar tus
              récords, fortalezas y logros en la sección <strong>Estadísticas</strong>.
            </p>
          </section>
        </div>

        <div className="action-row" style={{ justifyContent: "flex-end", marginTop: "0.25rem" }}>
          <button type="button" className="btn btn-gold" onClick={onClose}>
            ¡Entendido!
          </button>
        </div>
      </div>
    </div>
  );
};
