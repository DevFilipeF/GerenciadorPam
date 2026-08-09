import { useEffect, useRef, useCallback, useState } from "react";
import { PresetConfig, TextFieldConfig } from "./types";
import {
  FONT_RENDER_SCALE,
  NAME_MAX_WIDTH,
  fitNameLayout,
  getCanvasBaselineOffset,
  getNameLineSpacingExtra,
  getNeighborSpacingShift,
} from "@/lib/pdf-positioning";

import { useCustomFonts } from "@/hooks/use-custom-fonts";

interface EditorCanvasProps {
  pdfPage: any;
  pdfDims: { width: number; height: number };
  config: PresetConfig;
  onConfigChange: (config: PresetConfig) => void;
}

type DragField = "nome" | "idade" | "baby" | null;

type FieldBounds = {
  key: Exclude<DragField, null>;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  label: string;
};

// Baby Looney Tunes outline colors (no red)
const OUTLINE_STYLES: Record<string, { outline: string; outlineWidth: number }> = {
  baby: { outline: "#1a6bb5", outlineWidth: 3 },
  nome: { outline: "#2e8b57", outlineWidth: 4 },
  idade: { outline: "#1a6bb5", outlineWidth: 3 },
};

const EditorCanvas = ({ pdfPage, pdfDims, config, onConfigChange }: EditorCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const draggingRef = useRef<DragField>(null);
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const configRef = useRef(config);
  const scaleRef = useRef(1);
  const animFrameRef = useRef<number>(0);
  const fieldBoundsRef = useRef<FieldBounds[]>([]);
  const fieldShiftRef = useRef<Record<string, { x: number; y: number }>>({});
  const [scale, setScale] = useState(1);
  const [fontsVersion, setFontsVersion] = useState(0);
  const fontLoadedRef = useRef(false);

  useCustomFonts(useCallback(() => setFontsVersion((v) => v + 1), []));

  configRef.current = config;

  // Load Porkys font
  useEffect(() => {
    if (fontLoadedRef.current) return;
    const font = new FontFace("Porkys", "url(/fonts/PORKYS.TTF)");
    font.load().then((loaded) => {
      document.fonts.add(loaded);
      fontLoadedRef.current = true;
      drawOverlays();
    }).catch(() => {
      console.warn("Porkys font not loaded");
    });
  }, []);

  // Render PDF to offscreen canvas once
  useEffect(() => {
    if (!pdfPage || !containerRef.current) return;

    const container = containerRef.current;
    const containerWidth = container.clientWidth - 48;
    const newScale = containerWidth / pdfDims.width;
    scaleRef.current = newScale;
    setScale(newScale);

    const offscreen = document.createElement("canvas");
    const viewport = pdfPage.getViewport({ scale: newScale });
    offscreen.width = viewport.width;
    offscreen.height = viewport.height;

    const ctx = offscreen.getContext("2d");
    if (!ctx) return;
    pdfPage.render({ canvasContext: ctx, viewport }).promise.then(() => {
      pdfCanvasRef.current = offscreen;
      drawOverlays();
    });
  }, [pdfPage, pdfDims]);

  const drawOverlays = useCallback(() => {
    const canvas = canvasRef.current;
    const pdfCanvas = pdfCanvasRef.current;
    if (!canvas || !pdfCanvas || !pdfPage) return;

    const s = scaleRef.current;
    const cfg = configRef.current;
    const viewport = pdfPage.getViewport({ scale: 1 });

    canvas.width = pdfCanvas.width;
    canvas.height = pdfCanvas.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(pdfCanvas, 0, 0);

    const isPorkys = cfg.fontFamily === "Porkys";

    const bounds: FieldBounds[] = [];

    // Pré-calcula o layout do nome para espaçar Baby/Idade automaticamente
    const nomeBaseSize = cfg.nome.fontSize * s * FONT_RENDER_SCALE;
    const nomeFitted = fitNameLayout("FILIPE GABRIEL", nomeBaseSize, NAME_MAX_WIDTH * s, (value, size) => {
      ctx.font = `${size}px "${cfg.fontFamily}", sans-serif`;
      return ctx.measureText(value).width;
    });
    const extra = getNameLineSpacingExtra(nomeFitted.lines.length, nomeFitted.fontSize);
    const nomeVisual = (() => {
      const [vx, vy] = viewport.convertToViewportPoint(cfg.nome.x, cfg.nome.y);
      return { x: vx * s, y: vy * s };
    })();
    const shiftFor = (field: TextFieldConfig) => {
      const [vx, vy] = viewport.convertToViewportPoint(field.x, field.y);
      return getNeighborSpacingShift({ x: vx * s, y: vy * s }, nomeVisual, cfg.nome.rotation, extra);
    };

    // Draw each text field (nome gets line wrapping) and keep its real rotated hitbox
    const babyShift = shiftFor(cfg.baby);
    const idadeShift = shiftFor(cfg.idade);
    fieldShiftRef.current = { baby: babyShift, idade: idadeShift, nome: { x: 0, y: 0 } };

    bounds.push(drawTextField(ctx, viewport, cfg.baby, "Baby", "Baby (fixo)", "baby", cfg, s, cfg.baby.fontSize, isPorkys ? OUTLINE_STYLES.baby : null, false, babyShift));
    bounds.push(drawTextField(ctx, viewport, cfg.nome, "FILIPE GABRIEL", "Nome", "nome", cfg, s, cfg.nome.fontSize, isPorkys ? OUTLINE_STYLES.nome : null, true));
    bounds.push(drawTextField(ctx, viewport, cfg.idade, "1 ANO", "Idade", "idade", cfg, s, cfg.idade.fontSize, isPorkys ? OUTLINE_STYLES.idade : null, false, idadeShift));

    fieldBoundsRef.current = bounds;
    bounds.forEach((bound) => drawHandle(ctx, bound, s));
  }, [pdfPage]);


  const drawTextField = (
    ctx: CanvasRenderingContext2D,
    viewport: any,
    field: TextFieldConfig,
    text: string,
    label: string,
    key: Exclude<DragField, null>,
    cfg: PresetConfig,
    s: number,
    fieldFontSize: number,
    outlineStyle: { outline: string; outlineWidth: number } | null,
    enableWrap: boolean = false,
    shift: { x: number; y: number } = { x: 0, y: 0 }
  ): FieldBounds => {
    const [visualX, visualY] = viewport.convertToViewportPoint(field.x, field.y);
    const drawX = visualX * s + shift.x;
    const drawY = visualY * s + shift.y;

    ctx.save();
    ctx.translate(drawX, drawY);
    ctx.rotate((field.rotation * Math.PI) / 180);


    const baseFontSize = fieldFontSize * s * FONT_RENDER_SCALE;
    const measure = (value: string, size: number) => {
      ctx.font = `${size}px "${cfg.fontFamily}", sans-serif`;
      return ctx.measureText(value).width;
    };

    // NAME_MAX_WIDTH already represents PDF units. Only apply the viewport scale
    // here; applying FONT_RENDER_SCALE again made the editor wrap at half the
    // width used by the final PDF and changed the apparent spacing to Baby/Idade.
    const maxWidth = enableWrap ? NAME_MAX_WIDTH * s : Number.POSITIVE_INFINITY;
    const fitted = enableWrap
      ? fitNameLayout(text, baseFontSize, maxWidth, measure)
      : { fontSize: baseFontSize, lines: [text] };
    const fontSize = fitted.fontSize;
    const lines = fitted.lines;

    ctx.font = `${fontSize}px "${cfg.fontFamily}", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    const lineHeight = fontSize * 1.2;
    const maxLineWidth = Math.max(...lines.map((line) => ctx.measureText(line).width), fontSize);

    for (let i = 0; i < lines.length; i++) {
      const yOffset = getCanvasBaselineOffset(fontSize, i, lines.length);

      if (outlineStyle) {
        ctx.strokeStyle = outlineStyle.outline;
        ctx.lineWidth = outlineStyle.outlineWidth * s * FONT_RENDER_SCALE;
        ctx.lineJoin = "round";
        ctx.miterLimit = 2;
        ctx.strokeText(lines[i], 0, yOffset);
      }

      ctx.fillStyle = field.color;
      ctx.fillText(lines[i], 0, yOffset);
    }
    ctx.restore();

    return {
      key,
      centerX: drawX / s,
      centerY: drawY / s,

      width: (maxLineWidth + 18) / s,
      height: (Math.max(lineHeight * lines.length, fontSize) + 14) / s,
      rotation: field.rotation,
      color: field.color,
      label,
    };
  };

  const drawHandle = (ctx: CanvasRenderingContext2D, bounds: FieldBounds, s: number) => {
    const width = bounds.width * s;
    const height = bounds.height * s;

    ctx.save();
    ctx.translate(bounds.centerX * s, bounds.centerY * s);
    ctx.rotate((bounds.rotation * Math.PI) / 180);

    ctx.strokeStyle = bounds.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(-width / 2, -height / 2, width, height);
    ctx.setLineDash([]);

    ctx.fillStyle = bounds.color;
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(bounds.label, -width / 2, -height / 2 - 14);
    ctx.restore();
  };

  // Redraw when config changes
  useEffect(() => {
    if (!draggingRef.current) {
      drawOverlays();
    }
  }, [config, drawOverlays, fontsVersion]);

  const getCanvasPos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const s = scaleRef.current;
    return {
      x: ((e.clientX - rect.left) * scaleX) / s,
      y: ((e.clientY - rect.top) * scaleY) / s,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const position = getCanvasPos(e);
    if (!position) return;
    const { x, y } = position;
    const hit = getHitField(x, y);
    if (hit?.key) {
      draggingRef.current = hit.key;
      dragOffsetRef.current = {
        x: x - hit.centerX,
        y: y - hit.centerY,
      };
      return;
    }
  };

  const getHitField = (x: number, y: number): FieldBounds | null => {
    const padding = 8 / scaleRef.current;
    const hits = fieldBoundsRef.current
      .map((bounds) => {
        const local = toLocalPoint(x - bounds.centerX, y - bounds.centerY, bounds.rotation);
        const isInside = Math.abs(local.x) <= bounds.width / 2 + padding && Math.abs(local.y) <= bounds.height / 2 + padding;
        if (!isInside) return null;
        return {
          bounds,
          distance: Math.hypot(x - bounds.centerX, y - bounds.centerY),
        };
      })
      .filter((value): value is { bounds: FieldBounds; distance: number } => Boolean(value))
      .sort((a, b) => a.distance - b.distance);

    return hits[0]?.bounds ?? null;
  };

  const toLocalPoint = (x: number, y: number, rotation: number) => {
    const radians = (-rotation * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return {
      x: x * cos - y * sin,
      y: x * sin + y * cos,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingRef.current || !pdfPage) return;

    const position = getCanvasPos(e);
    if (!position) return;
    const dragOffset = dragOffsetRef.current || { x: 0, y: 0 };
    const x = position.x - dragOffset.x;
    const y = position.y - dragOffset.y;
    const field = draggingRef.current;
    const viewport = pdfPage.getViewport({ scale: 1 });
    const shift = fieldShiftRef.current[field] || { x: 0, y: 0 };
    const s = scaleRef.current;
    const [rawX, rawY] = viewport.convertToPdfPoint(x - shift.x / s, y - shift.y / s);

    configRef.current = {
      ...configRef.current,
      [field]: { ...configRef.current[field], x: Math.round(rawX), y: Math.round(rawY) },
    };

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(drawOverlays);
  };

  const handleMouseUp = () => {
    if (draggingRef.current) {
      onConfigChange(configRef.current);
      draggingRef.current = null;
      dragOffsetRef.current = null;
    }
  };

  return (
    <div ref={containerRef} className="flex-1 p-6 overflow-auto bg-muted/50">
      <div className="bg-card rounded-lg shadow-lg inline-block">
        <canvas
          ref={canvasRef}
          className="cursor-crosshair"
          style={{ maxWidth: "100%" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>
    </div>
  );
};

export default EditorCanvas;
