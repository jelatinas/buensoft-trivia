import React, { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isSoundEnabled, playTick, setSoundEnabled } from "../../lib/soundEffects";

export const SoundToggle: React.FC = () => {
  const [enabled, setEnabled] = useState<boolean>(() => isSoundEnabled());

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    setSoundEnabled(next);
    if (next) playTick(false);
  }

  return (
    <button
      type="button"
      className={`btn btn-icon sound-toggle ${enabled ? "on" : ""}`}
      onClick={toggle}
      title={enabled ? "Silenciar sonidos" : "Activar sonidos"}
      aria-label={enabled ? "Silenciar sonidos" : "Activar sonidos"}
    >
      {enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
    </button>
  );
};
