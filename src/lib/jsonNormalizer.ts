import type { Difficulty, QuestionType } from "../types/trivia";

export interface NormalizedQuestion {
  external_id: string;
  qtype: QuestionType;
  prompt: string;
  /** Siempre garantiza que options[0] es la respuesta correcta (estándar Buensoft Evalua) */
  options: string[];
  explanation: string;
  difficulty: Difficulty;
  tags: string[];
  extra_metadata: Record<string, unknown>;
  sourceFile: string;
  subjectSlug: string;
  subjectName: string;
}

export interface RejectedQuestion {
  sourceFile: string;
  index: number;
  externalId?: string;
  promptPreview: string;
  reasons: string[];
  kind: "format" | "duplicate" | "invalid_answer" | "missing_fields";
}

export interface NormalizedSubjectBatch {
  slug: string;
  name: string;
  description: string;
  sourceFiles: string[];
  questions: NormalizedQuestion[];
}

export interface ImportAnalysisResult {
  subjects: NormalizedSubjectBatch[];
  validCount: number;
  rejected: RejectedQuestion[];
  fileErrors: Array<{ fileName: string; error: string }>;
}

const KNOWN_QUESTION_KEYS = new Set([
  "id",
  "external_id",
  "tipo",
  "type",
  "qtype",
  "pregunta",
  "question",
  "enunciado",
  "prompt",
  "opciones",
  "options",
  "respuestas",
  "choices",
  "explicacion",
  "explanation",
  "retroalimentacion",
  "respuesta_correcta",
  "correct_answer",
  "correcta",
  "answer",
  "correct_index",
  "indice_correcto",
  "dificultad",
  "difficulty",
  "categoria",
  "category",
  "materia",
  "subject",
  "tags",
  "etiquetas"
]);

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

export function normalizePrompt(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function firstText(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string" && val.trim().length > 0) {
      return val.trim();
    }
  }
  return "";
}

function normalizeDifficulty(raw: unknown, fallback: Difficulty = "media"): Difficulty {
  if (typeof raw !== "string") return fallback;
  const v = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  if (["facil", "easy", "basico", "basica", "1", "low"].includes(v)) return "facil";
  if (["dificil", "hard", "avanzado", "avanzada", "3", "high"].includes(v)) return "dificil";
  if (["media", "medio", "medium", "intermedio", "intermedia", "2"].includes(v)) return "media";
  return fallback;
}

/**
 * Parsea texto JSON o Markdown con bloque JSON (compatible con Buensoft Evalua).
 */
export function parseJsonOrMarkdown(rawText: string): unknown {
  let text = rawText.replace(/^\uFEFF/, "").trim();
  if (text.startsWith("```")) {
    const lines = text.split(/\r?\n/);
    lines.shift();
    if (lines.length && lines[lines.length - 1].trim().startsWith("```")) {
      lines.pop();
    }
    text = lines.join("\n").trim();
  }

  const candidates = [text];
  if (text.includes("\\[") || text.includes("\\]")) {
    candidates.push(text.replace(/\\\[/g, "[").replace(/\\\]/g, "]"));
  }

  let lastError = "El archivo no contiene un JSON válido.";
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (err) {
      lastError = err instanceof Error ? err.message : lastError;
    }

    // Intentar extraer objeto o arreglo principal si hay texto rodeando el JSON
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
      } catch {
        // continuar
      }
    }
  }
  throw new Error(`Error de formato JSON: ${lastError}`);
}

function extractRawQuestions(root: unknown): {
  items: unknown[];
  subjectName: string;
  subjectSlug: string;
  description: string;
} {
  if (Array.isArray(root)) {
    return { items: root, subjectName: "", subjectSlug: "", description: "" };
  }
  if (!root || typeof root !== "object") {
    throw new Error("La raíz del archivo debe ser un objeto JSON o un arreglo de preguntas.");
  }

  const data = root as Record<string, unknown>;
  const subjectName = firstText(data, [
    "titulo_libro",
    "class_name",
    "categoria",
    "category",
    "libro",
    "nombre",
    "title",
    "name"
  ]);
  const explicitId = firstText(data, ["class_id", "id_materia", "slug"]);
  const subjectSlug = slugify(explicitId || subjectName);
  const description = firstText(data, ["descripcion", "description"]);

  if (Array.isArray(data.preguntas)) {
    return { items: data.preguntas, subjectName, subjectSlug, description };
  }
  if (Array.isArray(data.questions)) {
    return { items: data.questions, subjectName, subjectSlug, description };
  }

  // Formato agrupado (opcion_multiple / verdadero_falso)
  const groupKeys: Array<[string, QuestionType]> = [
    ["opcion_multiple", "opcion_multiple"],
    ["verdadero_falso", "verdadero_falso"],
    ["multiple_choice", "opcion_multiple"],
    ["true_false", "verdadero_falso"]
  ];
  const grouped: unknown[] = [];
  let foundGroup = false;
  for (const [key, qtype] of groupKeys) {
    if (Array.isArray(data[key])) {
      foundGroup = true;
      for (const item of data[key] as unknown[]) {
        if (item && typeof item === "object") {
          grouped.push({ tipo: qtype, ...(item as Record<string, unknown>) });
        } else {
          grouped.push(item);
        }
      }
    }
  }
  if (foundGroup) {
    return { items: grouped, subjectName, subjectSlug, description };
  }

  throw new Error(
    "No se encontró la lista de preguntas. Se esperaba 'preguntas', 'questions', un arreglo raíz o grupos 'opcion_multiple'/'verdadero_falso'."
  );
}

function inferQuestionType(rawType: string, options: string[]): QuestionType | null {
  const t = rawType
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  if (["verdadero_falso", "true_false", "vf", "tf", "boolean", "booleano"].includes(t)) {
    return "verdadero_falso";
  }
  if (["opcion_multiple", "multiple_choice", "om", "mc", "seleccion_multiple"].includes(t)) {
    return "opcion_multiple";
  }
  if (options.length === 2) {
    const lowered = options.map((o) => o.toLowerCase());
    if (
      (lowered.includes("verdadero") && lowered.includes("falso")) ||
      (lowered.includes("true") && lowered.includes("false"))
    ) {
      return "verdadero_falso";
    }
  }
  if (options.length >= 2) return "opcion_multiple";
  return null;
}

/**
 * Resuelve la respuesta correcta y la ubica en options[0] (estándar Buensoft Evalua).
 * Si el archivo especifica respuesta_correcta/correct_answer/correct_index, valida que exista.
 * Si no la especifica (formato nativo Buensoft), usa options[0] como correcta.
 */
function resolveCorrectOption(
  item: Record<string, unknown>,
  options: string[]
): { ordered: string[]; error?: string } {
  const explicitIndex = item.correct_index ?? item.indice_correcto;
  if (explicitIndex !== undefined && explicitIndex !== null && explicitIndex !== "") {
    const idx = Number(explicitIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) {
      return {
        ordered: options,
        error: `El índice de respuesta correcta (${String(explicitIndex)}) no existe en las opciones.`
      };
    }
    const copy = [...options];
    const [correct] = copy.splice(idx, 1);
    return { ordered: [correct, ...copy] };
  }

  const explicitAnswer =
    item.respuesta_correcta ?? item.correct_answer ?? item.correcta ?? item.answer;

  if (explicitAnswer !== undefined && explicitAnswer !== null && explicitAnswer !== "") {
    if (typeof explicitAnswer === "boolean") {
      const target = explicitAnswer ? "verdadero" : "falso";
      const idx = options.findIndex((o) => o.toLowerCase() === target || o.toLowerCase() === String(explicitAnswer));
      if (idx < 0) {
        return { ordered: options, error: `Respuesta booleana '${String(explicitAnswer)}' no coincide con las opciones.` };
      }
      const copy = [...options];
      const [correct] = copy.splice(idx, 1);
      return { ordered: [correct, ...copy] };
    }

    const answerStr = String(explicitAnswer).trim();
    const exactIdx = options.findIndex((o) => o.toLowerCase() === answerStr.toLowerCase());
    if (exactIdx >= 0) {
      const copy = [...options];
      const [correct] = copy.splice(exactIdx, 1);
      return { ordered: [correct, ...copy] };
    }

    // Permitir letras A/B/C/D cuando corresponda
    if (/^[A-D]$/i.test(answerStr)) {
      const letterIdx = answerStr.toUpperCase().charCodeAt(0) - 65;
      if (letterIdx >= 0 && letterIdx < options.length) {
        const copy = [...options];
        const [correct] = copy.splice(letterIdx, 1);
        return { ordered: [correct, ...copy] };
      }
    }

    return {
      ordered: options,
      error: `La respuesta correcta '${answerStr}' no existe dentro de las opciones proporcionadas.`
    };
  }

  // Formato nativo Buensoft: opciones[0] es siempre la respuesta correcta
  return { ordered: options };
}

export interface AnalyzeOptions {
  defaultDifficulty?: Difficulty;
  fallbackSubjectName?: string;
  existingPrompts?: Set<string>;
}

/**
 * Analiza y normaliza uno o varios archivos JSON/MD sin modificar los originales.
 */
export function analyzeQuestionFiles(
  files: Array<{ name: string; content: string }>,
  opts: AnalyzeOptions = {}
): ImportAnalysisResult {
  const defaultDifficulty = opts.defaultDifficulty ?? "media";
  const existingPrompts = opts.existingPrompts ?? new Set<string>();
  const seenPrompts = new Set<string>(existingPrompts);
  const seenSubjectExternalIds = new Set<string>();

  const subjectMap = new Map<string, NormalizedSubjectBatch>();
  const rejected: RejectedQuestion[] = [];
  const fileErrors: Array<{ fileName: string; error: string }> = [];
  let validCount = 0;

  for (const file of files) {
    let parsed: unknown;
    try {
      parsed = parseJsonOrMarkdown(file.content);
    } catch (err) {
      fileErrors.push({
        fileName: file.name,
        error: err instanceof Error ? err.message : "No se pudo leer el JSON."
      });
      continue;
    }

    let extracted: ReturnType<typeof extractRawQuestions>;
    try {
      extracted = extractRawQuestions(parsed);
    } catch (err) {
      fileErrors.push({
        fileName: file.name,
        error: err instanceof Error ? err.message : "Estructura no reconocida."
      });
      continue;
    }

    const baseFileName = file.name.replace(/\.(json|md|markdown)$/i, "").replace(/[_-]+/g, " ").trim();
    const fileSubjectName = extracted.subjectName || opts.fallbackSubjectName || baseFileName || "General";

    extracted.items.forEach((rawItem, idx) => {
      const index = idx + 1;
      if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) {
        rejected.push({
          sourceFile: file.name,
          index,
          promptPreview: "(Elemento inválido)",
          reasons: ["Cada pregunta debe ser un objeto JSON."],
          kind: "format"
        });
        return;
      }

      const item = rawItem as Record<string, unknown>;
      const prompt = firstText(item, ["pregunta", "question", "enunciado", "prompt"]);
      const rawId = firstText(item, ["id", "external_id"]) || `Q${String(index).padStart(3, "0")}`;
      const rawOptions = item.opciones ?? item.options ?? item.respuestas ?? item.choices;

      const reasons: string[] = [];
      let kind: RejectedQuestion["kind"] = "missing_fields";

      if (!prompt) {
        reasons.push("Falta el enunciado de la pregunta ('pregunta' o 'question').");
      }

      let options: string[] = [];
      if (Array.isArray(rawOptions)) {
        options = rawOptions
          .map((o) => (typeof o === "string" || typeof o === "number" ? String(o).trim() : ""))
          .filter((o) => o.length > 0);
      } else if (
        typeof (item.respuesta_correcta ?? item.correct_answer) === "boolean"
      ) {
        options = ["Verdadero", "Falso"];
      } else {
        reasons.push("Falta la lista de opciones ('opciones' u 'options').");
      }

      if (options.length < 2) {
        reasons.push("Debe tener al menos 2 opciones de respuesta válidas.");
      }

      // Verificar opciones duplicadas dentro de la misma pregunta
      const uniqueOptSet = new Set(options.map((o) => o.toLowerCase()));
      if (options.length >= 2 && uniqueOptSet.size < options.length) {
        reasons.push("Contiene opciones de respuesta duplicadas.");
        kind = "format";
      }

      const rawType = firstText(item, ["tipo", "type", "qtype"]);
      const qtype = inferQuestionType(rawType, options);
      if (!qtype) {
        reasons.push("No se pudo determinar el tipo de pregunta ('opcion_multiple' o 'verdadero_falso').");
        kind = "format";
      } else if (qtype === "verdadero_falso" && options.length !== 2) {
        reasons.push("Las preguntas de verdadero/falso deben tener exactamente 2 opciones.");
        kind = "format";
      }

      const resolved = options.length >= 2 ? resolveCorrectOption(item, options) : { ordered: options };
      if (resolved.error) {
        reasons.push(resolved.error);
        kind = "invalid_answer";
      }

      // Categoría / materia (por pregunta si trae, o por archivo)
      const qSubjectName = firstText(item, ["categoria", "category", "materia", "subject"]) || fileSubjectName;
      const qSubjectSlug = slugify(
        (qSubjectName === fileSubjectName ? extracted.subjectSlug : "") || qSubjectName
      ) || "general";

      const normKey = prompt ? normalizePrompt(prompt) : "";
      if (normKey && seenPrompts.has(normKey)) {
        reasons.push("Pregunta duplicada (el enunciado ya existe en este lote o en el banco).");
        kind = "duplicate";
      }

      const idKey = `${qSubjectSlug}::${rawId}`;
      if (seenSubjectExternalIds.has(idKey)) {
        reasons.push(`Identificador '${rawId}' duplicado dentro de la categoría '${qSubjectName}'.`);
        kind = "duplicate";
      }

      if (reasons.length > 0) {
        rejected.push({
          sourceFile: file.name,
          index,
          externalId: rawId,
          promptPreview: prompt ? prompt.slice(0, 90) : "(Sin enunciado)",
          reasons,
          kind
        });
        return;
      }

      seenPrompts.add(normKey);
      seenSubjectExternalIds.add(idKey);

      const explanation = firstText(item, ["explicacion", "explanation", "retroalimentacion"]);
      const difficulty = normalizeDifficulty(item.dificultad ?? item.difficulty, defaultDifficulty);

      const rawTags = item.tags ?? item.etiquetas;
      const tags = Array.isArray(rawTags)
        ? rawTags.map((t) => String(t).trim()).filter(Boolean)
        : [];

      // Preservar cualquier campo adicional útil para el futuro
      const extra_metadata: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(item)) {
        if (!KNOWN_QUESTION_KEYS.has(k) && v !== undefined) {
          extra_metadata[k] = v;
        }
      }

      let batch = subjectMap.get(qSubjectSlug);
      if (!batch) {
        batch = {
          slug: qSubjectSlug,
          name: qSubjectName,
          description: qSubjectName === fileSubjectName ? extracted.description : "",
          sourceFiles: [],
          questions: []
        };
        subjectMap.set(qSubjectSlug, batch);
      }
      if (!batch.sourceFiles.includes(file.name)) {
        batch.sourceFiles.push(file.name);
      }

      batch.questions.push({
        external_id: rawId,
        qtype: qtype!,
        prompt,
        options: resolved.ordered,
        explanation,
        difficulty,
        tags,
        extra_metadata,
        sourceFile: file.name,
        subjectSlug: qSubjectSlug,
        subjectName: qSubjectName
      });
      validCount++;
    });
  }

  return {
    subjects: Array.from(subjectMap.values()),
    validCount,
    rejected,
    fileErrors
  };
}
