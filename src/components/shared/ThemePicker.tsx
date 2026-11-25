import React, { useState } from "react";
import { applyTheme, getStoredTheme, pickRandomTheme, type TriviaTheme } from "../../lib/theme";

export const ThemePicker: React.FC = () => {
  const [theme, setTheme] = useState<TriviaTheme>(() => getStoredTheme());
  const isRandom = theme !== "dark" && theme !== "light";

  function choose(next: "dark" | "light" | "random") {
    const resolved = next === "random" ? pickRandomTheme(theme) : next;
    setTheme(resolved);
    applyTheme(resolved);
  }

  return (
    <div className="theme-picker-row" role="group" aria-label="Color de pantalla">
      <button
        type="button"
        className={`choice-pill ${theme === "dark" ? "active" : ""}`}
        onClick={() => choose("dark")}
      >
        🌙 Oscuro
      </button>
      <button
        type="button"
        className={`choice-pill ${theme === "light" ? "active" : ""}`}
        onClick={() => choose("light")}
      >
        ☀️ Claro
      </button>
      <button
        type="button"
        className={`choice-pill ${isRandom ? "active" : ""}`}
        onClick={() => choose("random")}
      >
        🎲 Al azar
      </button>
    </div>
  );
};
