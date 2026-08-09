import { describe, expect, it } from "vitest";
import {
  NAME_MAX_WIDTH,
  PageRotation,
  fitNameLayout,
  getNameLineSpacingExtra,
  getNeighborSpacingShift,
  rawToVisualPoint,
  visualToRawPoint,
} from "@/lib/pdf-positioning";
import { defaultConfig } from "@/components/editor/types";

// Medida sintética estável (mesma função no "editor" e no "PDF"),
// escalada apenas pelo fator de escala de tela no lado do editor.
const measureAt = (scale: number) => (value: string, size: number) =>
  value.length * size * 0.55 * scale;

const PAGE = { width: 420, height: 595 };
const ROTATIONS: PageRotation[] = [0, 90, 180, 270];

const nomeCfg = { ...defaultConfig.nome, x: 210, y: 300, fontSize: 96 };
const babyCfg = { ...defaultConfig.baby, x: 210, y: 360 };
const idadeCfg = { ...defaultConfig.idade, x: 210, y: 240 };

function shift(field: typeof babyCfg, extra: number, rotation: PageRotation) {
  return getNeighborSpacingShift(
    rawToVisualPoint({ x: field.x, y: field.y }, PAGE.width, PAGE.height, rotation),
    rawToVisualPoint({ x: nomeCfg.x, y: nomeCfg.y }, PAGE.width, PAGE.height, rotation),
    nomeCfg.rotation,
    extra,
  );
}

describe("quebra de nome", () => {
  it("nome simples fica em 1 linha (sem espaçamento extra)", () => {
    const fit = fitNameLayout("ANA", 48, NAME_MAX_WIDTH, measureAt(1));
    expect(fit.lines).toEqual(["ANA"]);
    expect(getNameLineSpacingExtra(fit.lines.length, fit.fontSize)).toBe(0);
  });

  it("nome composto quebra na segunda palavra (2 linhas)", () => {
    const fit = fitNameLayout("MARIA CLARA", 48, NAME_MAX_WIDTH, measureAt(1));
    expect(fit.lines).toEqual(["MARIA", "CLARA"]);
    expect(getNameLineSpacingExtra(fit.lines.length, fit.fontSize)).toBeGreaterThan(0);
  });

  it("nome muito longo pode usar 3 linhas", () => {
    const fit = fitNameLayout("MARIA CLARA FERNANDES", 48, NAME_MAX_WIDTH, measureAt(1));
    expect(fit.lines.length).toBe(3);
    expect(fit.lines[0]).toBe("MARIA");
    const extra3 = getNameLineSpacingExtra(fit.lines.length, fit.fontSize);
    const extra2 = getNameLineSpacingExtra(2, fit.fontSize);
    expect(extra3).toBeCloseTo(extra2 * 2, 6);
  });
});

describe("espaçamento automático de Baby/Idade", () => {
  it("empurra Baby e Idade para lados opostos, simetricamente", () => {
    const fit = fitNameLayout("MARIA CLARA", 48, NAME_MAX_WIDTH, measureAt(1));
    const extra = getNameLineSpacingExtra(fit.lines.length, fit.fontSize);
    const baby = shift(babyCfg, extra, 0);
    const idade = shift(idadeCfg, extra, 0);
    expect(baby.y).toBeCloseTo(-idade.y, 6);
    expect(Math.abs(baby.y)).toBeCloseTo(extra, 6);
  });

  it("mantém posição quando o nome cabe em 1 linha", () => {
    const extra = getNameLineSpacingExtra(1, 48);
    expect(shift(babyCfg, extra, 0)).toEqual({ x: 0, y: 0 });
    expect(shift(idadeCfg, extra, 0)).toEqual({ x: 0, y: 0 });
  });

  it("funciona em todas as rotações de página (modelos diferentes)", () => {
    const fit = fitNameLayout("MARIA CLARA", 48, NAME_MAX_WIDTH, measureAt(1));
    const extra = getNameLineSpacingExtra(fit.lines.length, fit.fontSize);
    for (const rotation of ROTATIONS) {
      // Baby acima e Idade abaixo do nome no que o usuário vê, em cada modelo
      const nomeVisual = rawToVisualPoint({ x: nomeCfg.x, y: nomeCfg.y }, PAGE.width, PAGE.height, rotation);
      const babyRaw = visualToRawPoint({ x: nomeVisual.x, y: nomeVisual.y - 60 }, PAGE.width, PAGE.height, rotation);
      const idadeRaw = visualToRawPoint({ x: nomeVisual.x, y: nomeVisual.y + 60 }, PAGE.width, PAGE.height, rotation);
      const baby = shift({ ...babyCfg, ...babyRaw }, extra, rotation);
      const idade = shift({ ...idadeCfg, ...idadeRaw }, extra, rotation);
      expect(Math.hypot(baby.x, baby.y)).toBeCloseTo(extra, 6);
      expect(Math.hypot(idade.x, idade.y)).toBeCloseTo(extra, 6);
      expect(baby.x).toBeCloseTo(-idade.x, 6);
      expect(baby.y).toBeCloseTo(-idade.y, 6);
    }
  });

  it("acompanha a rotação do campo Nome", () => {
    const fit = fitNameLayout("MARIA CLARA", 48, NAME_MAX_WIDTH, measureAt(1));
    const extra = getNameLineSpacingExtra(fit.lines.length, fit.fontSize);
    const rotated = getNeighborSpacingShift(
      { x: 110, y: 300 },
      { x: 210, y: 300 },
      90,
      extra,
    );
    expect(Math.abs(rotated.x)).toBeCloseTo(extra, 6);
    expect(Math.abs(rotated.y)).toBeCloseTo(0, 6);
  });
});

describe("paridade preview x PDF final", () => {
  it("editor (px de tela) e PDF (unidades) produzem o mesmo deslocamento relativo", () => {
    for (const nome of ["ANA", "MARIA CLARA", "MARIA CLARA FERNANDES"]) {
      for (const s of [0.5, 1, 1.75]) {
        // PDF: unidades do documento
        const pdfFit = fitNameLayout(nome, nomeCfg.fontSize * 0.5, NAME_MAX_WIDTH, measureAt(1));
        const pdfExtra = getNameLineSpacingExtra(pdfFit.lines.length, pdfFit.fontSize);

        // Editor: mesma matemática com escala de tela aplicada
        // No editor o texto é medido no canvas já em px de tela (sem escala extra)
        const editorFit = fitNameLayout(nome, nomeCfg.fontSize * 0.5 * s, NAME_MAX_WIDTH * s, measureAt(1));
        const editorExtra = getNameLineSpacingExtra(editorFit.lines.length, editorFit.fontSize);

        expect(editorFit.lines).toEqual(pdfFit.lines);
        expect(editorExtra / s).toBeCloseTo(pdfExtra, 6);
      }
    }
  });
});
