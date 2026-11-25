export type TriviaTheme = "dark" | "light" | "neon" | "sunset" | "forest" | "sky";

const THEME_KEY = "buensoft-trivia-theme";
const RANDOM_POOL: TriviaTheme[] = ["neon", "sunset", "forest", "sky"];

export function getStoredTheme(): TriviaTheme {
  try {
    const saved = localStorage.getItem(THEME_KEY) as TriviaTheme | null;
    if (saved && ["dark", "light", "neon", "sunset", "forest", "sky"].includes(saved)) {
      return saved;
    }
  } catch {
    // ignorar
  }
  return "dark";
}

export function applyTheme(theme: TriviaTheme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignorar
  }
}

export function initTheme(): TriviaTheme {
  const theme = getStoredTheme();
  applyTheme(theme);
  return theme;
}

export function pickRandomTheme(current: TriviaTheme): TriviaTheme {
  const options = RANDOM_POOL.filter((t) => t !== current);
  return options[Math.floor(Math.random() * options.length)] || "neon";
}
