import type { Difficulty, SoloCurrentQuestion, SoloMode } from "../types/trivia";

export interface BotProfile {
  id: string;
  name: string;
  tierLabel: "Nivel Bajo" | "Básico" | "Intermedio" | "Avanzado" | "Experto";
  level: 1 | 2 | 3 | 4 | 5;
  avatar: string;
  accent: string;
  baseAccuracy: number;
  minDelayMs: number;
  maxDelayMs: number;
  tagline: string;
}

export interface BotTurnResult {
  isCorrect: boolean;
  pointsEarned: number;
  responseSec: number;
}

export interface BotMatchState {
  profile: BotProfile;
  score: number;
  correctCount: number;
  incorrectCount: number;
  currentStreak: number;
  bestStreak: number;
  status: "thinking" | "answered";
  lastResult: BotTurnResult | null;
}

export const AI_OPPONENTS: BotProfile[] = [
  {
    id: "tito",
    name: "Tito el Curioso",
    tierLabel: "Nivel Bajo",
    level: 1,
    avatar: "🐣",
    accent: "#22c55e",
    baseAccuracy: 0.45,
    minDelayMs: 4200,
    maxDelayMs: 11000,
    tagline: "Apenas comienza; responde sin prisa y se equivoca con frecuencia."
  },
  {
    id: "lina",
    name: "Lina la Exploradora",
    tierLabel: "Básico",
    level: 2,
    avatar: "🧭",
    accent: "#38bdf8",
    baseAccuracy: 0.6,
    minDelayMs: 3200,
    maxDelayMs: 9000,
    tagline: "Buena base de cultura general y ritmo constante ronda tras ronda."
  },
  {
    id: "mateo",
    name: "Mateo el Estratega",
    tierLabel: "Intermedio",
    level: 3,
    avatar: "🦊",
    accent: "#f59e0b",
    baseAccuracy: 0.73,
    minDelayMs: 2400,
    maxDelayMs: 7000,
    tagline: "Equilibrado, ágil y peligroso cuando encadena rachas seguidas."
  },
  {
    id: "valeria",
    name: "Valeria la Erudita",
    tierLabel: "Avanzado",
    level: 4,
    avatar: "🦉",
    accent: "#a855f7",
    baseAccuracy: 0.84,
    minDelayMs: 1600,
    maxDelayMs: 5200,
    tagline: "Rápida y muy precisa; rara vez falla en preguntas clásicas."
  },
  {
    id: "kronos",
    name: "Dr. Kronos (IA)",
    tierLabel: "Experto",
    level: 5,
    avatar: "🤖",
    accent: "#ef4444",
    baseAccuracy: 0.93,
    minDelayMs: 1100,
    maxDelayMs: 3600,
    tagline: "Rival experto de precisión casi perfecta y reflejos relámpago."
  }
];

export const DEFAULT_BOT_IDS = ["tito", "mateo", "valeria"];

export function createInitialBotStates(botIds: string[]): BotMatchState[] {
  const selected = AI_OPPONENTS.filter((b) => botIds.includes(b.id));
  return selected.map((profile) => ({
    profile,
    score: 0,
    correctCount: 0,
    incorrectCount: 0,
    currentStreak: 0,
    bestStreak: 0,
    status: "thinking",
    lastResult: null
  }));
}

function difficultyAdjustment(difficulty: Difficulty): number {
  if (difficulty === "facil") return 0.06;
  if (difficulty === "dificil") return -0.07;
  return 0;
}

export interface PlannedBotAnswer {
  botId: string;
  delayMs: number;
  isCorrect: boolean;
  pointsEarned: number;
  nextStreak: number;
  nextBestStreak: number;
}

export function planBotTurn(
  bot: BotMatchState,
  question: SoloCurrentQuestion,
  mode: SoloMode,
  timeLimitSec: number
): PlannedBotAnswer {
  const { profile } = bot;
  const vfBonus = question.qtype === "verdadero_falso" ? 0.05 : 0;
  const prob = Math.max(
    0.2,
    Math.min(0.97, profile.baseAccuracy + difficultyAdjustment(question.difficulty) + vfBonus)
  );
  const isCorrect = Math.random() < prob;

  const capMs = mode === "practica" ? 6500 : Math.max(1200, (timeLimitSec - 0.6) * 1000);
  const minMs = Math.min(profile.minDelayMs, capMs * 0.55);
  const maxMs = Math.min(profile.maxDelayMs, capMs);
  const delayMs = Math.round(minMs + Math.random() * Math.max(300, maxMs - minMs));

  const nextStreak = isCorrect ? bot.currentStreak + 1 : 0;
  const nextBestStreak = Math.max(bot.bestStreak, nextStreak);

  let pointsEarned = 0;
  if (isCorrect && mode === "competitivo") {
    pointsEarned = Math.round(question.base_points * question.multiplier);
    if (nextStreak >= 3) {
      pointsEarned += Math.min(nextStreak * 25, 250);
    }
  }

  return {
    botId: profile.id,
    delayMs,
    isCorrect,
    pointsEarned,
    nextStreak,
    nextBestStreak
  };
}
