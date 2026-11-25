import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from "../config/supabase";
import type {
  AdminQuestion,
  Category,
  Difficulty,
  LifelineKey,
  MpRoomState,
  PlayerStats,
  SoloAnswerResult,
  SoloConfig,
  SoloGameState,
  SoloLifelineResult,
  Student
} from "../types/trivia";
import type { NormalizedSubjectBatch } from "../lib/jsonNormalizer";

async function callRpc<T>(fn: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, params ?? {});
  if (error) {
    throw new Error(error.message || `Error en ${fn}`);
  }
  return data as T;
}

// ---------------- Jugadores (reutiliza public.students de Buensoft Evalua) ----------------
export async function listStudents(): Promise<Student[]> {
  const { data, error } = await supabase
    .from("students")
    .select("id, name, name_key")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as Student[];
}

export async function enterStudent(name: string): Promise<Student> {
  return callRpc<Student>("enter_student", { p_name: name.trim() });
}

export async function redeemWorkspaceCode(code: string): Promise<Student> {
  const response = await fetch("https://buensoft.com/workspace/api/evalua.php", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ action: "redeem", code })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.name) {
    throw new Error(payload.error || "No se pudo entrar con la cuenta del workspace.");
  }
  return enterStudent(payload.name);
}

// ---------------- Catálogo compartido ----------------
export async function listCategories(): Promise<Category[]> {
  try {
    return await callRpc<Category[]>("trivia_list_categories");
  } catch {
    // Fallback de lectura básica si aún no se ha ejecutado 001_trivia_schema.sql
    const { data, error } = await supabase
      .from("subject_catalog")
      .select("id, slug, name, description, question_count")
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as Category[];
  }
}

export async function checkTriviaSchemaInstalled(): Promise<boolean> {
  const { error } = await supabase.rpc("trivia_list_categories");
  return !error;
}

// ---------------- MODO SOLO (sin Realtime) ----------------
export async function startSoloGame(
  studentId: string,
  config: SoloConfig,
  customQuestionIds?: string[]
): Promise<SoloGameState> {
  return callRpc<SoloGameState>("trivia_solo_start", {
    p_student_id: studentId,
    p_mode: config.mode,
    p_total_rounds: config.totalRounds,
    p_questions_per_round: config.questionsPerRound,
    p_time_limit_sec: config.mode === "practica" ? 0 : config.timeLimitSec,
    p_subject_ids: config.subjectIds.length ? config.subjectIds : null,
    p_difficulty: config.difficulty,
    p_lifelines_enabled: config.lifelinesEnabled,
    p_question_ids: customQuestionIds && customQuestionIds.length ? customQuestionIds : null
  });
}

export async function getSoloState(gameId: string, studentId: string): Promise<SoloGameState> {
  return callRpc<SoloGameState>("trivia_solo_get_state", {
    p_game_id: gameId,
    p_student_id: studentId
  });
}

export async function useSoloLifeline(
  gameId: string,
  studentId: string,
  ordinal: number,
  lifeline: LifelineKey
): Promise<SoloLifelineResult> {
  return callRpc<SoloLifelineResult>("trivia_solo_use_lifeline", {
    p_game_id: gameId,
    p_student_id: studentId,
    p_ordinal: ordinal,
    p_lifeline: lifeline
  });
}

export async function answerSoloQuestion(
  gameId: string,
  studentId: string,
  ordinal: number,
  selectedText: string | null,
  timeMs: number
): Promise<SoloAnswerResult> {
  return callRpc<SoloAnswerResult>("trivia_solo_answer", {
    p_game_id: gameId,
    p_student_id: studentId,
    p_ordinal: ordinal,
    p_selected_text: selectedText,
    p_time_ms: Math.max(0, Math.round(timeMs))
  });
}

export async function finishSoloGame(gameId: string, studentId: string): Promise<SoloGameState> {
  return callRpc<SoloGameState>("trivia_solo_finish", {
    p_game_id: gameId,
    p_student_id: studentId
  });
}

// ---------------- MODO MULTIJUGADOR (con Realtime únicamente aquí) ----------------
export async function createMpRoom(
  studentId: string,
  config: Omit<SoloConfig, "mode" | "botIds">
): Promise<MpRoomState> {
  return callRpc<MpRoomState>("trivia_mp_create_room", {
    p_student_id: studentId,
    p_total_rounds: config.totalRounds,
    p_questions_per_round: config.questionsPerRound,
    p_time_limit_sec: config.timeLimitSec,
    p_subject_ids: config.subjectIds.length ? config.subjectIds : null,
    p_difficulty: config.difficulty,
    p_lifelines_enabled: config.lifelinesEnabled
  });
}

export async function joinMpRoom(code: string, studentId: string): Promise<MpRoomState> {
  return callRpc<MpRoomState>("trivia_mp_join_room", {
    p_code: code.trim().toUpperCase(),
    p_student_id: studentId
  });
}

export async function setMpReady(
  roomId: string,
  studentId: string,
  ready: boolean
): Promise<MpRoomState> {
  return callRpc<MpRoomState>("trivia_mp_set_ready", {
    p_room_id: roomId,
    p_student_id: studentId,
    p_ready: ready
  });
}

export async function startMpRoom(roomId: string, studentId: string): Promise<MpRoomState> {
  return callRpc<MpRoomState>("trivia_mp_start_room", {
    p_room_id: roomId,
    p_student_id: studentId
  });
}

export async function useMpLifeline(
  roomId: string,
  studentId: string,
  lifeline: LifelineKey
): Promise<MpRoomState> {
  return callRpc<MpRoomState>("trivia_mp_use_lifeline", {
    p_room_id: roomId,
    p_student_id: studentId,
    p_lifeline: lifeline
  });
}

export async function answerMpQuestion(
  roomId: string,
  studentId: string,
  selectedText: string | null,
  timeMs: number
): Promise<MpRoomState> {
  return callRpc<MpRoomState>("trivia_mp_answer", {
    p_room_id: roomId,
    p_student_id: studentId,
    p_selected_text: selectedText,
    p_time_ms: Math.max(0, Math.round(timeMs))
  });
}

export async function advanceMpRoom(roomId: string, studentId: string): Promise<MpRoomState> {
  return callRpc<MpRoomState>("trivia_mp_advance", {
    p_room_id: roomId,
    p_student_id: studentId
  });
}

export async function getMpState(roomId: string, studentId: string): Promise<MpRoomState> {
  return callRpc<MpRoomState>("trivia_mp_get_state", {
    p_room_id: roomId,
    p_student_id: studentId
  });
}

export async function closeMpRoom(roomId: string, studentId: string): Promise<void> {
  try {
    await callRpc("trivia_mp_leave_room", {
      p_room_id: roomId,
      p_student_id: studentId
    });
  } catch {
    // Si aún no se ejecutó 003_room_expiration_and_close.sql, no bloquear la salida
  }
}

export async function heartbeatMpRoom(roomId: string, studentId: string): Promise<MpRoomState | null> {
  try {
    return await callRpc<MpRoomState>("trivia_mp_heartbeat", {
      p_room_id: roomId,
      p_student_id: studentId
    });
  } catch {
    return null;
  }
}

export function leaveMpRoomBeacon(roomId: string, studentId: string): void {
  try {
    void fetch(`${SUPABASE_URL}/rest/v1/rpc/trivia_mp_leave_room`, {
      method: "POST",
      keepalive: true,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        p_room_id: roomId,
        p_student_id: studentId
      })
    });
  } catch {
    // ignorar
  }
}

export function subscribeMpRoom(roomId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`trivia-room-${roomId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "trivia_rooms", filter: `id=eq.${roomId}` },
      onChange
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "trivia_room_players", filter: `room_id=eq.${roomId}` },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ---------------- Administración JSON ----------------
export async function importQuestionBatches(
  batches: NormalizedSubjectBatch[]
): Promise<{ imported: number; updated: number; skipped_duplicates: number }> {
  const payload = batches.map((b) => ({
    slug: b.slug,
    name: b.name,
    description: b.description,
    questions: b.questions.map((q) => ({
      external_id: q.external_id,
      qtype: q.qtype,
      prompt: q.prompt,
      options: q.options,
      explanation: q.explanation,
      difficulty: q.difficulty,
      tags: q.tags,
      extra_metadata: q.extra_metadata
    }))
  }));
  return callRpc("trivia_admin_import_batch", { p_subjects: payload });
}

export async function listAdminQuestions(params: {
  subjectId?: string | null;
  difficulty?: string | null;
  search?: string | null;
  limit?: number;
  offset?: number;
}): Promise<{ total: number; items: AdminQuestion[] }> {
  return callRpc("trivia_admin_list_questions", {
    p_subject_id: params.subjectId || null,
    p_difficulty: params.difficulty || null,
    p_search: params.search || null,
    p_limit: params.limit ?? 100,
    p_offset: params.offset ?? 0
  });
}

export async function updateAdminQuestion(params: {
  questionId: string;
  prompt: string;
  options: string[];
  explanation: string;
  difficulty: Difficulty;
  qtype: string;
}): Promise<void> {
  await callRpc("trivia_admin_update_question", {
    p_question_id: params.questionId,
    p_prompt: params.prompt,
    p_options: params.options,
    p_explanation: params.explanation,
    p_difficulty: params.difficulty,
    p_qtype: params.qtype
  });
}

export async function deleteAdminQuestion(questionId: string): Promise<void> {
  await callRpc("trivia_admin_delete_question", { p_question_id: questionId });
}

export async function exportAdminQuestions(subjectId?: string | null): Promise<unknown[]> {
  return callRpc<unknown[]>("trivia_admin_export_questions", {
    p_subject_id: subjectId || null
  });
}

// ---------------- Estadísticas ----------------
export async function getPlayerStats(studentId: string): Promise<PlayerStats> {
  return callRpc<PlayerStats>("trivia_player_stats", { p_student_id: studentId });
}
