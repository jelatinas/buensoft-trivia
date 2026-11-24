export type QuestionType = "opcion_multiple" | "verdadero_falso";
export type Difficulty = "facil" | "media" | "dificil";
export type DifficultyFilter = Difficulty | "mixta";
export type SoloMode = "competitivo" | "practica";
export type LifelineKey = "fifty_fifty" | "extra_time" | "double_points" | "skip";

export interface Student {
  id: string;
  name: string;
  name_key?: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  question_count: number;
  facil_count?: number;
  media_count?: number;
  dificil_count?: number;
}

export interface LifelinesState {
  fifty_fifty: boolean;
  extra_time: boolean;
  double_points: boolean;
  skip: boolean;
}

export interface SoloConfig {
  mode: SoloMode;
  totalRounds: 3 | 5 | 6 | 10;
  questionsPerRound: 5 | 10 | 15;
  timeLimitSec: 5 | 10 | 15 | 20;
  subjectIds: string[]; // vacío = todas
  difficulty: DifficultyFilter;
  lifelinesEnabled: boolean;
  botIds: string[]; // personajes de la PC seleccionados (0 a 5)
}

export interface SoloCurrentQuestion {
  ordinal: number;
  round_number: number;
  question_in_round: number;
  subject_name: string;
  difficulty: Difficulty;
  qtype: QuestionType;
  prompt: string;
  options: string[];
  base_points: number;
  multiplier: number;
  eliminated_options: string[];
  double_active: boolean;
  extra_time_sec: number;
}

export interface SoloReviewQuestion {
  ordinal: number;
  round_number: number;
  question_id: string;
  subject_id: string;
  subject_name: string;
  difficulty: Difficulty;
  qtype: QuestionType;
  prompt: string;
  options: string[];
  selected_text: string | null;
  correct_text: string;
  explanation: string;
  is_correct: boolean;
  is_skipped: boolean;
  points_earned: number;
}

export interface SoloGameState {
  game_id: string;
  mode: SoloMode;
  status: "active" | "finished" | "abandoned";
  total_rounds: number;
  questions_per_round: number;
  time_limit_sec: number;
  lifelines_enabled: boolean;
  lifelines_used: LifelinesState;
  score: number;
  correct_count: number;
  incorrect_count: number;
  current_streak: number;
  best_streak: number;
  personal_best: number;
  total_questions: number;
  answered_count: number;
  current_question: SoloCurrentQuestion | null;
  review_questions: SoloReviewQuestion[];
}

export interface SoloAnswerResult {
  ordinal: number;
  is_correct: boolean;
  correct_text: string;
  explanation: string;
  points_earned: number;
  total_score: number;
  current_streak: number;
  best_streak: number;
  finished: boolean;
  newly_unlocked: Array<{ code: string; title: string }>;
}

export interface SoloLifelineResult {
  lifeline: LifelineKey;
  eliminated_options: string[];
  extra_time_sec: number;
  double_active: boolean;
  skipped: boolean;
  correct_text: string | null;
  explanation: string | null;
}

export interface MpPlayer {
  student_id: string;
  student_name: string;
  is_host: boolean;
  is_ready: boolean;
  score: number;
  correct_count: number;
  incorrect_count: number;
  current_streak: number;
  best_streak: number;
  lifelines_used: LifelinesState;
  was_behind: boolean;
  final_rank: number | null;
}

export interface MpCurrentQuestion {
  ordinal: number;
  round_number: number;
  question_in_round: number;
  subject_name: string;
  difficulty: Difficulty;
  qtype: QuestionType;
  prompt: string;
  options: string[];
  base_points: number;
  multiplier: number;
  correct_text: string | null;
  explanation: string | null;
}

export interface MpMyAnswer {
  selected_text: string | null;
  is_correct: boolean;
  is_skipped: boolean;
  double_active: boolean;
  eliminated_options: string[];
  extra_time_sec: number;
  points_earned: number;
  answered: boolean;
}

export interface MpRoomState {
  room_id: string;
  code: string;
  host_student_id: string;
  status: "lobby" | "playing" | "reveal" | "finished";
  total_rounds: number;
  questions_per_round: number;
  total_questions: number;
  time_limit_sec: number;
  lifelines_enabled: boolean;
  current_ordinal: number;
  question_started_at: string | null;
  answered_players_count: number;
  players: MpPlayer[];
  current_question: MpCurrentQuestion | null;
  my_answer: MpMyAnswer | null;
}

export interface AdminQuestion {
  id: string;
  subject_id: string;
  subject_slug: string;
  subject_name: string;
  external_id: string;
  qtype: QuestionType;
  prompt: string;
  options: string[];
  explanation: string;
  active: boolean;
  difficulty: Difficulty;
  tags: string[];
  extra_metadata: Record<string, unknown>;
}

export interface PlayerStats {
  solo: {
    games_played: number;
    competitive_games: number;
    practice_games: number;
    best_score: number;
    avg_score: number;
    total_correct: number;
    total_incorrect: number;
    accuracy_pct: number;
    best_streak: number;
  };
  multiplayer: {
    games_played: number;
    wins: number;
    win_rate_pct: number;
    avg_score: number;
    best_score: number;
    comebacks: number;
    podiums: number;
    avg_rank: number;
    total_correct: number;
    total_incorrect: number;
  };
  categories: Array<{
    subject_id: string;
    subject_name: string;
    answered: number;
    correct: number;
    accuracy_pct: number;
    best_points: number;
  }>;
  achievements: Array<{
    code: string;
    title: string;
    description: string;
    unlocked_at: string;
  }>;
  recent_solo: Array<{
    id: string;
    mode: SoloMode;
    score: number;
    correct_count: number;
    incorrect_count: number;
    best_streak: number;
    finished_at: string;
  }>;
}
