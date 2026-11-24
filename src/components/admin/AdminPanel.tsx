import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Edit3,
  FileJson,
  Search,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { analyzeQuestionFiles, type ImportAnalysisResult } from "../../lib/jsonNormalizer";
import {
  deleteAdminQuestion,
  exportAdminQuestions,
  importQuestionBatches,
  listAdminQuestions,
  updateAdminQuestion
} from "../../services/triviaApi";
import type { AdminQuestion, Category, Difficulty } from "../../types/trivia";

interface Props {
  categories: Category[];
  schemaReady: boolean;
  onRefreshCategories: () => Promise<void>;
  onBack: () => void;
}

export const AdminPanel: React.FC<Props> = ({
  categories,
  schemaReady,
  onRefreshCategories,
  onBack
}) => {
  const [tab, setTab] = useState<"import" | "manage">("import");

  // Estado de importación JSON
  const [defaultDifficulty, setDefaultDifficulty] = useState<Difficulty>("media");
  const [analysis, setAnalysis] = useState<ImportAnalysisResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Estado de administración
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("");
  const [searchText, setSearchText] = useState<string>("");
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [totalQuestions, setTotalQuestions] = useState<number>(0);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Edición de pregunta
  const [editing, setEditing] = useState<AdminQuestion | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [editExplanation, setEditExplanation] = useState("");
  const [editDifficulty, setEditDifficulty] = useState<Difficulty>("media");
  const [savingEdit, setSavingEdit] = useState(false);

  async function loadQuestions() {
    if (!schemaReady) return;
    setLoadingList(true);
    setListError(null);
    try {
      const res = await listAdminQuestions({
        subjectId: filterCategory || null,
        difficulty: filterDifficulty || null,
        search: searchText || null,
        limit: 100,
        offset: 0
      });
      setQuestions(res.items);
      setTotalQuestions(res.total);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Error cargando preguntas.");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    if (tab === "manage") {
      void loadQuestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, filterCategory, filterDifficulty]);

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setImportMessage(null);
    setImportError(null);

    const filesData: Array<{ name: string; content: string }> = [];
    for (const file of Array.from(fileList)) {
      const content = await file.text();
      filesData.push({ name: file.name, content });
    }
    e.target.value = "";

    const result = analyzeQuestionFiles(filesData, { defaultDifficulty });
    setAnalysis(result);
  }

  async function handleConfirmImport() {
    if (!analysis || analysis.subjects.length === 0) return;
    setImporting(true);
    setImportError(null);
    setImportMessage(null);
    try {
      const outcome = await importQuestionBatches(analysis.subjects);
      setImportMessage(
        `Importación completada: ${outcome.imported} preguntas guardadas en Supabase (${outcome.skipped_duplicates} duplicadas omitidas).`
      );
      setAnalysis(null);
      await onRefreshCategories();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "No se pudo guardar en Supabase.");
    } finally {
      setImporting(false);
    }
  }

  function openEditModal(q: AdminQuestion) {
    setEditing(q);
    setEditPrompt(q.prompt);
    setEditOptions([...q.options]);
    setEditExplanation(q.explanation || "");
    setEditDifficulty(q.difficulty || "media");
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const cleanedOpts = editOptions.map((o) => o.trim()).filter(Boolean);
    if (cleanedOpts.length < 2) {
      setListError("Debe haber al menos 2 opciones válidas.");
      return;
    }
    setSavingEdit(true);
    try {
      await updateAdminQuestion({
        questionId: editing.id,
        prompt: editPrompt,
        options: cleanedOpts,
        explanation: editExplanation,
        difficulty: editDifficulty,
        qtype: editing.qtype
      });
      setEditing(null);
      await loadQuestions();
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Error al actualizar pregunta.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(q: AdminQuestion) {
    if (!window.confirm(`¿Eliminar la pregunta "${q.prompt.slice(0, 70)}…"?`)) return;
    try {
      await deleteAdminQuestion(q.id);
      await loadQuestions();
      await onRefreshCategories();
    } catch (err) {
      setListError(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  }

  async function handleExportJson() {
    try {
      const data = await exportAdminQuestions(filterCategory || null);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filterCategory ? `buensoft_trivia_categoria.json` : `buensoft_trivia_banco_completo.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "No se pudo exportar a JSON.");
    }
  }

  return (
    <div className="page-shell">
      <header className="topbar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          <ArrowLeft size={18} /> Menú principal
        </button>
        <strong>Panel Administrativo — Banco de Preguntas JSON</strong>
        <div className="tab-pills">
          <button
            type="button"
            className={`choice-pill ${tab === "import" ? "active" : ""}`}
            onClick={() => setTab("import")}
          >
            <Upload size={15} /> Importar JSON
          </button>
          <button
            type="button"
            className={`choice-pill ${tab === "manage" ? "active" : ""}`}
            onClick={() => setTab("manage")}
          >
            <FileJson size={15} /> Administrar banco
          </button>
        </div>
      </header>

      <main className="main-container">
        {tab === "import" && (
          <div className="stack-lg">
            <section className="card">
              <h3>Importar uno o varios archivos JSON / Markdown</h3>
              <p className="muted">
                Compatible automáticamente con el formato de <strong>Buensoft Evalua</strong>{" "}
                (<code>titulo_libro</code>, <code>preguntas</code>, <code>opciones[0]</code> como
                correcta), formato inglés (<code>class_name</code>/<code>questions</code>),
                agrupados y archivos con <code>respuesta_correcta</code> / <code>dificultad</code>.
              </p>

              <div className="import-controls">
                <div className="field-group">
                  <label>Dificultad por defecto (si el JSON no la especifica)</label>
                  <div className="pill-row">
                    {(["facil", "media", "dificil"] as Difficulty[]).map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={`choice-pill ${defaultDifficulty === d ? "active" : ""}`}
                        onClick={() => setDefaultDifficulty(d)}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="upload-dropzone">
                  <Upload size={28} />
                  <strong>Seleccionar uno o varios archivos .json / .md</strong>
                  <span className="muted">
                    Los archivos originales nunca se modifican; primero verás un resumen de
                    validación.
                  </span>
                  <input
                    type="file"
                    accept=".json,.md,.markdown"
                    multiple
                    onChange={handleFilesSelected}
                  />
                </label>
              </div>

              {importMessage && (
                <div className="alert alert-success">
                  <CheckCircle2 size={18} /> {importMessage}
                </div>
              )}
              {importError && (
                <div className="alert alert-error">
                  <AlertCircle size={18} /> {importError}
                </div>
              )}
            </section>

            {analysis && (
              <section className="card">
                <div className="card-header-row">
                  <div>
                    <h3>Resumen del análisis</h3>
                    <p className="muted">
                      Revisa las preguntas válidas y rechazadas antes de confirmar el guardado en
                      Supabase.
                    </p>
                  </div>
                  <div className="action-row">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setAnalysis(null)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={importing || analysis.validCount === 0 || !schemaReady}
                      onClick={handleConfirmImport}
                    >
                      <CheckCircle2 size={18} />
                      {importing
                        ? "Guardando en Supabase…"
                        : `Confirmar importación (${analysis.validCount} válidas)`}
                    </button>
                  </div>
                </div>

                <div className="stats-4grid">
                  <div className="stat-box good">
                    <strong>{analysis.validCount}</strong>
                    <span>Válidas</span>
                  </div>
                  <div className="stat-box bad">
                    <strong>{analysis.rejected.length}</strong>
                    <span>Rechazadas</span>
                  </div>
                  <div className="stat-box">
                    <strong>{analysis.subjects.length}</strong>
                    <span>Categorías detectadas</span>
                  </div>
                  <div className="stat-box">
                    <strong>{analysis.fileErrors.length}</strong>
                    <span>Archivos con error</span>
                  </div>
                </div>

                {analysis.fileErrors.length > 0 && (
                  <div className="alert alert-error">
                    <div>
                      <strong>Archivos que no se pudieron leer:</strong>
                      <ul>
                        {analysis.fileErrors.map((fe, idx) => (
                          <li key={idx}>
                            <code>{fe.fileName}</code>: {fe.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {analysis.subjects.length > 0 && (
                  <div className="section-block">
                    <h4>Categorías listas para importar</h4>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Categoría / Materia</th>
                            <th>Slug</th>
                            <th>Preguntas válidas</th>
                            <th>Archivos origen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysis.subjects.map((sub) => (
                            <tr key={sub.slug}>
                              <td>
                                <strong>{sub.name}</strong>
                              </td>
                              <td>
                                <code>{sub.slug}</code>
                              </td>
                              <td>{sub.questions.length}</td>
                              <td className="muted">{sub.sourceFiles.join(", ")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {analysis.rejected.length > 0 && (
                  <div className="section-block">
                    <h4>Preguntas rechazadas ({analysis.rejected.length})</h4>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Archivo</th>
                            <th># / ID</th>
                            <th>Enunciado</th>
                            <th>Motivo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysis.rejected.slice(0, 50).map((rej, idx) => (
                            <tr key={idx}>
                              <td>{rej.sourceFile}</td>
                              <td>
                                #{rej.index} {rej.externalId ? `(${rej.externalId})` : ""}
                              </td>
                              <td>{rej.promptPreview}</td>
                              <td className="danger-text">{rej.reasons.join(" ")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {tab === "manage" && (
          <section className="card">
            <div className="card-header-row">
              <div>
                <h3>Preguntas en el banco compartido ({totalQuestions})</h3>
                <p className="muted">
                  Las ediciones se sincronizan con Supabase (opción 1 = respuesta correcta).
                </p>
              </div>
              <button type="button" className="btn btn-secondary" onClick={handleExportJson}>
                <Download size={16} /> Exportar a JSON
              </button>
            </div>

            <div className="filter-bar">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.question_count})
                  </option>
                ))}
              </select>

              <select
                value={filterDifficulty}
                onChange={(e) => setFilterDifficulty(e.target.value)}
              >
                <option value="">Todas las dificultades</option>
                <option value="facil">Fácil</option>
                <option value="media">Media</option>
                <option value="dificil">Difícil</option>
              </select>

              <div className="search-input">
                <Search size={16} />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void loadQuestions()}
                  placeholder="Buscar por texto o ID…"
                />
                <button type="button" className="btn btn-ghost" onClick={() => void loadQuestions()}>
                  Buscar
                </button>
              </div>
            </div>

            {listError && <div className="alert alert-error">{listError}</div>}

            {loadingList ? (
              <p className="muted">Cargando preguntas…</p>
            ) : questions.length === 0 ? (
              <p className="muted">No se encontraron preguntas con esos filtros.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Categoría</th>
                      <th>ID</th>
                      <th>Pregunta</th>
                      <th>Respuesta correcta</th>
                      <th>Dificultad</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {questions.map((q) => (
                      <tr key={q.id}>
                        <td>{q.subject_name}</td>
                        <td>
                          <code>{q.external_id}</code>
                        </td>
                        <td>{q.prompt}</td>
                        <td className="good-text">{q.options[0]}</td>
                        <td>
                          <span className="meta-chip">{q.difficulty}</span>
                        </td>
                        <td>
                          <div className="icon-actions">
                            <button
                              type="button"
                              className="btn btn-icon"
                              onClick={() => openEditModal(q)}
                              title="Editar"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-icon danger"
                              onClick={() => void handleDelete(q)}
                              title="Eliminar"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {editing && (
          <div className="modal-backdrop">
            <form className="modal-card" onSubmit={handleSaveEdit}>
              <div className="card-header-row">
                <h3>Editar pregunta ({editing.external_id})</h3>
                <button
                  type="button"
                  className="btn btn-icon"
                  onClick={() => setEditing(null)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="field-group">
                <label>Enunciado</label>
                <textarea
                  rows={3}
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  required
                />
              </div>

              <div className="field-group">
                <label>Opciones (la opción #1 es siempre la respuesta correcta)</label>
                {editOptions.map((opt, idx) => (
                  <input
                    key={idx}
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const next = [...editOptions];
                      next[idx] = e.target.value;
                      setEditOptions(next);
                    }}
                    placeholder={idx === 0 ? "Respuesta correcta" : `Distractor ${idx}`}
                    required
                  />
                ))}
              </div>

              <div className="field-group">
                <label>Explicación educativa</label>
                <textarea
                  rows={3}
                  value={editExplanation}
                  onChange={(e) => setEditExplanation(e.target.value)}
                />
              </div>

              <div className="field-group">
                <label>Dificultad</label>
                <select
                  value={editDifficulty}
                  onChange={(e) => setEditDifficulty(e.target.value as Difficulty)}
                >
                  <option value="facil">Fácil</option>
                  <option value="media">Media</option>
                  <option value="dificil">Difícil</option>
                </select>
              </div>

              <div className="action-row">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setEditing(null)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                  {savingEdit ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};
