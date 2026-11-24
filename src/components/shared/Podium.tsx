import React from "react";
import { Crown } from "lucide-react";

export interface PodiumEntry {
  id: string;
  name: string;
  avatar: string;
  scoreLabel: string;
  subtitle?: string;
  isHuman?: boolean;
}

interface Props {
  entries: PodiumEntry[];
}

export const Podium: React.FC<Props> = ({ entries }) => {
  const top3 = entries.slice(0, 3);
  if (top3.length === 0) return null;

  // Orden visual clásico de concurso: 2do (izquierda), 1ro (centro), 3ro (derecha)
  const slots: Array<{ rank: 1 | 2 | 3; item: PodiumEntry | undefined }> = [
    { rank: 2, item: top3[1] },
    { rank: 1, item: top3[0] },
    { rank: 3, item: top3[2] }
  ];

  return (
    <div className="podium-stage" aria-label="Podio de ganadores">
      {slots.map(({ rank, item }) => {
        if (!item) return <div key={rank} className="podium-col empty" />;
        return (
          <div key={item.id} className={`podium-col rank-${rank}`}>
            <div className={`podium-avatar-ring rank-${rank} ${item.isHuman ? "is-me" : ""}`}>
              {rank === 1 && <Crown size={20} className="podium-crown" />}
              <span className="podium-avatar">{item.avatar}</span>
            </div>
            <strong className="podium-name">
              {item.name}
              {item.isHuman ? " (Tú)" : ""}
            </strong>
            <span className="podium-score">{item.scoreLabel}</span>
            <div className={`podium-pedestal rank-${rank}`}>
              <span className="podium-number">{rank}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
