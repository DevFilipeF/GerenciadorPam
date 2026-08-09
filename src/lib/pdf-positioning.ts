import { PresetConfig, TextFieldConfig } from "@/components/editor/types";

export const FONT_RENDER_SCALE = 0.5;
export const NAME_MAX_WIDTH = 200;

const LINE_HEIGHT_MULTIPLIER = 1.2;
const BASELINE_CENTER_CORRECTION = 0.35;

export type PageRotation = 0 | 90 | 180 | 270;

type Point = { x: number; y: number };

export function normalizePageRotation(angle: number): PageRotation {
  const normalized = ((Math.round(angle / 90) * 90) % 360 + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized;
  }
  return 0;
}

export function wrapTextToWidth(
  text: string,
  maxWidth: number,
  measure: (value: string) => number,
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [""];
  if (!Number.isFinite(maxWidth)) return [trimmed];

  const words = trimmed.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  const pushWord = (word: string) => {
    if (!currentLine) {
      currentLine = word;
      return;
    }

    const testLine = `${currentLine} ${word}`;
    if (measure(testLine) <= maxWidth) {
      currentLine = testLine;
      return;
    }

    lines.push(currentLine);
    currentLine = word;
  };

  const breakLongWord = (word: string) => {
    let chunk = "";
    for (const char of word) {
      const testChunk = `${chunk}${char}`;
      if (chunk && measure(testChunk) > maxWidth) {
        pushWord(chunk);
        chunk = char;
      } else {
        chunk = testChunk;
      }
    }
    if (chunk) pushWord(chunk);
  };

  for (const word of words) {
    if (measure(word) > maxWidth) {
      breakLongWord(word);
    } else {
      pushWord(word);
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}

export function getCanvasBaselineOffset(fontSize: number, lineIndex: number, lineCount: number) {
  const lineHeight = fontSize * LINE_HEIGHT_MULTIPLIER;
  const totalHeight = (lineCount - 1) * lineHeight;
  const visualCenterOffset = lineIndex * lineHeight - totalHeight / 2;
  return visualCenterOffset + fontSize * BASELINE_CENTER_CORRECTION;
}

export function getPdfBaselineOffset(fontSize: number, lineIndex: number, lineCount: number) {
  const lineHeight = fontSize * LINE_HEIGHT_MULTIPLIER;
  const totalHeight = (lineCount - 1) * lineHeight;
  const visualCenterOffset = lineIndex * lineHeight - totalHeight / 2;
  return -visualCenterOffset - fontSize * BASELINE_CENTER_CORRECTION;
}

export function rotateVector(x: number, y: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  };
}

export function rawToVisualPoint(point: Point, rawWidth: number, rawHeight: number, rotation: PageRotation): Point {
  switch (rotation) {
    case 90:
      return { x: point.y, y: point.x };
    case 180:
      return { x: rawWidth - point.x, y: point.y };
    case 270:
      return { x: rawHeight - point.y, y: rawWidth - point.x };
    default:
      return { x: point.x, y: rawHeight - point.y };
  }
}

export function visualToRawPoint(point: Point, rawWidth: number, rawHeight: number, rotation: PageRotation): Point {
  switch (rotation) {
    case 90:
      return { x: point.y, y: point.x };
    case 180:
      return { x: rawWidth - point.x, y: point.y };
    case 270:
      return { x: rawWidth - point.y, y: rawHeight - point.x };
    default:
      return { x: point.x, y: rawHeight - point.y };
  }
}

function normalizeFieldToPdf(
  field: TextFieldConfig,
  rawWidth: number,
  rawHeight: number,
  rotation: PageRotation,
  coordinateSpace?: PresetConfig["coordinateSpace"],
): TextFieldConfig {
  if (coordinateSpace === "pdf") return field;
  const point = visualToRawPoint(field, rawWidth, rawHeight, rotation);
  return {
    ...field,
    x: Math.round(point.x),
    y: Math.round(point.y),
  };
}

export function normalizeConfigToPdf(
  config: PresetConfig,
  rawWidth: number,
  rawHeight: number,
  rotation: PageRotation,
): PresetConfig {
  if (config.coordinateSpace === "pdf") {
    return {
      ...config,
      coordinateSpace: "pdf",
    };
  }

  return {
    ...config,
    coordinateSpace: "pdf",
    nome: normalizeFieldToPdf(config.nome, rawWidth, rawHeight, rotation, config.coordinateSpace),
    idade: normalizeFieldToPdf(config.idade, rawWidth, rawHeight, rotation, config.coordinateSpace),
    baby: normalizeFieldToPdf(config.baby, rawWidth, rawHeight, rotation, config.coordinateSpace),
  };
}
export const NAME_MIN_FONT_SCALE = 0.55;

/**
 * Keeps the "Nome" field anchored exactly where the user positioned it.
 * Nomes compostos sempre quebram na segunda palavra (ex.: "Maria Clara" ->
 * "Maria" / "Clara"); o tamanho da fonte só é reduzido se alguma linha
 * ainda não couber em NAME_MAX_WIDTH. Usado no editor e na geração do PDF.
 */
export function fitNameLayout(
  text: string,
  baseFontSize: number,
  maxWidth: number,
  measure: (value: string, fontSize: number) => number,
): { fontSize: number; lines: string[] } {
  const trimmed = text.trim();
  if (!trimmed) return { fontSize: baseFontSize, lines: [""] };

  const words = trimmed.split(/\s+/);

  if (words.length === 1 || !Number.isFinite(maxWidth) || maxWidth <= 0) {
    const lines = words.length > 1 ? [words[0], words.slice(1).join(" ")] : [trimmed];
    if (!Number.isFinite(maxWidth) || maxWidth <= 0) return { fontSize: baseFontSize, lines };
    const single = measure(lines[0], baseFontSize);
    if (single <= maxWidth) return { fontSize: baseFontSize, lines };
    const minSingle = baseFontSize * NAME_MIN_FONT_SCALE;
    return { fontSize: Math.max(minSingle, (baseFontSize * maxWidth) / single), lines };
  }

  // Primeira palavra sempre sozinha; o restante quebra em quantas linhas
  // precisar, sempre por palavra inteira (nunca corta uma palavra no meio).
  const rest: string[] = [];
  for (const word of words.slice(1)) {
    const current = rest[rest.length - 1];
    if (current && measure(`${current} ${word}`, baseFontSize) <= maxWidth) {
      rest[rest.length - 1] = `${current} ${word}`;
    } else {
      rest.push(word);
    }
  }
  const lines = [words[0], ...rest];

  const widest = Math.max(...lines.map((line) => measure(line, baseFontSize)));
  if (widest <= maxWidth) return { fontSize: baseFontSize, lines };

  const minFontSize = baseFontSize * NAME_MIN_FONT_SCALE;
  const scaled = Math.max(minFontSize, (baseFontSize * maxWidth) / widest);
  return { fontSize: scaled, lines };
}



/**
 * Espaçamento automático de Baby/Idade quando o nome quebra em mais linhas.
 * Retorna quantos pontos o campo vizinho deve se afastar do centro do nome.
 */
export function getNameLineSpacingExtra(nameLineCount: number, nameFontSize: number) {
  if (nameLineCount <= 1) return 0;
  return ((nameLineCount - 1) * nameFontSize * LINE_HEIGHT_MULTIPLIER) / 2;
}

/**
 * Deslocamento (em coordenadas visuais, Y para baixo) que mantém Baby/Idade
 * na mesma posição relativa ao nome, apenas afastando-os quando o nome cresce.
 */
export function getNeighborSpacingShift(
  fieldVisual: Point,
  nomeVisual: Point,
  nomeRotation: number,
  extra: number,
): Point {
  if (!extra) return { x: 0, y: 0 };
  const up = rotateVector(0, -1, nomeRotation);
  const dx = fieldVisual.x - nomeVisual.x;
  const dy = fieldVisual.y - nomeVisual.y;
  const dot = dx * up.x + dy * up.y;
  // Campos perpendiculares ao eixo vertical do nome não precisam de afastamento
  if (Math.abs(dot) < 1e-6) return { x: 0, y: 0 };
  const sign = dot > 0 ? 1 : -1;
  return { x: up.x * extra * sign, y: up.y * extra * sign };
}
