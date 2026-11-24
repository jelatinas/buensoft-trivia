import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { analyzeQuestionFiles } from "./jsonNormalizer";

describe("jsonNormalizer — Compatibilidad con archivos reales y validación", () => {
  it("importa y normaliza los 5 archivos reales cultura_general_parte_1..5.json sin errores", () => {
    const root = process.cwd();
    const files = [1, 2, 3, 4, 5].map((n) => {
      const name = `cultura_general_parte_${n}.json`;
      const content = fs.readFileSync(path.join(root, name), "utf-8");
      return { name, content };
    });

    const result = analyzeQuestionFiles(files);
    expect(result.fileErrors).toHaveLength(0);
    expect(result.rejected).toHaveLength(0);
    expect(result.validCount).toBe(500);
    expect(result.subjects).toHaveLength(5);

    // Verificar preservación de opciones[0] como respuesta correcta en VF y OM
    const parte1 = result.subjects.find((s) => s.slug === "cultura_general_parte_1");
    expect(parte1).toBeDefined();
    expect(parte1!.questions).toHaveLength(100);
    const vf02 = parte1!.questions.find((q) => q.external_id === "VF02");
    expect(vf02?.qtype).toBe("verdadero_falso");
    expect(vf02?.options[0]).toBe("Falso");
  });

  it("adapta formato con respuesta_correcta explícita, inglés, dificultad y preserva metadatos extra", () => {
    const custom = JSON.stringify({
      class_name: "Ciencia Avanzada",
      questions: [
        {
          id: "C01",
          question: "¿Cuál es la fórmula del agua?",
          options: ["CO2", "H2O", "O2", "NaCl"],
          correct_answer: "H2O",
          difficulty: "fácil",
          source_book: "Química 101"
        }
      ]
    });

    const res = analyzeQuestionFiles([{ name: "ciencia.json", content: custom }]);
    expect(res.validCount).toBe(1);
    const q = res.subjects[0].questions[0];
    // H2O debe quedar en options[0]
    expect(q.options[0]).toBe("H2O");
    expect(q.difficulty).toBe("facil");
    expect(q.extra_metadata).toEqual({ source_book: "Química 101" });
  });

  it("detecta duplicados, respuestas correctas inexistentes y errores de formato", () => {
    const badJson = JSON.stringify({
      titulo_libro: "Pruebas de Validación",
      preguntas: [
        {
          id: "P1",
          tipo: "opcion_multiple",
          pregunta: "¿Capital de Francia?",
          opciones: ["París", "Roma", "Madrid", "Berlín"]
        },
        {
          id: "P2",
          tipo: "opcion_multiple",
          pregunta: "¿Capital de Francia?",
          opciones: ["París", "Roma", "Madrid", "Berlín"]
        },
        {
          id: "P3",
          tipo: "opcion_multiple",
          pregunta: "¿Capital de Italia?",
          opciones: ["Roma", "Milán", "Venecia", "Nápoles"],
          respuesta_correcta: "Lisboa"
        },
        {
          id: "P4",
          tipo: "opcion_multiple",
          pregunta: "",
          opciones: ["A"]
        }
      ]
    });

    const res = analyzeQuestionFiles([{ name: "bad.json", content: badJson }]);
    expect(res.validCount).toBe(1);
    expect(res.rejected).toHaveLength(3);
    expect(res.rejected[0].kind).toBe("duplicate");
    expect(res.rejected[1].kind).toBe("invalid_answer");
    expect(res.rejected[2].kind).toBe("missing_fields");
  });
});
