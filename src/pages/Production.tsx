import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Download, FileText, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { PDFDocument, rgb, degrees, StandardFonts, PDFPage, PDFFont } from "pdf-lib";
import { PresetConfig, defaultConfig, TextFieldConfig } from "@/components/editor/types";
import fontkit from "@pdf-lib/fontkit";
import {
  FONT_RENDER_SCALE,
  NAME_MAX_WIDTH,
  PageRotation,
  getCanvasBaselineOffset,
  normalizeConfigToPdf,
  normalizePageRotation,
  rawToVisualPoint,
  rotateVector,
  visualToRawPoint,
  fitNameLayout,
  getNameLineSpacingExtra,
  getNeighborSpacingShift,
} from "@/lib/pdf-positioning";

interface TemplateEntry {
  templateId: string;
  templateName: string;
  items: { nome: string; idade: number; quantidade: number }[];
}

const STANDARD_FONT_MAP: Record<string, string> = {
  "Arial": StandardFonts.Helvetica,
  "Calibri": StandardFonts.Helvetica,
  "Cambria": StandardFonts.TimesRoman,
  "Georgia": StandardFonts.TimesRoman,
  "Times New Roman": StandardFonts.TimesRoman,
  "Verdana": StandardFonts.Helvetica,
  "Trebuchet MS": StandardFonts.Helvetica,
  "Comic Sans MS": StandardFonts.Helvetica,
  "Impact": StandardFonts.HelveticaBold,
  "Courier New": StandardFonts.Courier,
};

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
}

// Outline colors for Porkys font (no red)
const PORKYS_OUTLINES = {
  baby: { r: 0x1a / 255, g: 0x6b / 255, b: 0xb5 / 255 },
  nome: { r: 0x2e / 255, g: 0x8b / 255, b: 0x57 / 255 },
  idade: { r: 0x1a / 255, g: 0x6b / 255, b: 0xb5 / 255 },
};

function drawTextWithOutline(
  page: PDFPage,
  text: string,
  field: TextFieldConfig,
  baseFontSize: number,
  font: PDFFont,
  isPorkys: boolean,
  outlineColor?: { r: number; g: number; b: number },
  maxWidth?: number,
  pageRotation: PageRotation = 0,
  visualShift: { x: number; y: number } = { x: 0, y: 0 },
) {
  const fitted = maxWidth
    ? fitNameLayout(text, baseFontSize, maxWidth, (value, size) => font.widthOfTextAtSize(value, size))
    : { fontSize: baseFontSize, lines: [text] };
  const fontSize = fitted.fontSize;
  const lines = fitted.lines;
  const rotationDeg = pageRotation - field.rotation;
  const drawRotation = degrees(rotationDeg);
  const anchorRaw = rawToVisualPoint({ x: field.x, y: field.y }, page.getWidth(), page.getHeight(), pageRotation);
  const anchorVisual = { x: anchorRaw.x + visualShift.x, y: anchorRaw.y + visualShift.y };

  const getRawLineOrigin = (localX: number, localY: number) => {
    const visualOffset = rotateVector(localX, localY, field.rotation);
    return visualToRawPoint(
      { x: anchorVisual.x + visualOffset.x, y: anchorVisual.y + visualOffset.y },
      page.getWidth(),
      page.getHeight(),
      pageRotation,
    );
  };

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineText = lines[lineIdx];
    const lineWidth = font.widthOfTextAtSize(lineText, fontSize);
    const localX = -lineWidth / 2;
    const localY = getCanvasBaselineOffset(fontSize, lineIdx, lines.length);
    const rawOrigin = getRawLineOrigin(localX, localY);
    const x = rawOrigin.x;
    const y = rawOrigin.y;

    if (isPorkys && outlineColor) {
      const offsets = [
        [-2, 0], [2, 0], [0, -2], [0, 2],
        [-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5],
      ];
      for (const [dx, dy] of offsets) {
        const outlineOrigin = getRawLineOrigin(localX + dx, localY + dy);
        page.drawText(lineText, {
          x: outlineOrigin.x,
          y: outlineOrigin.y,
          size: fontSize,
          font,
          color: rgb(outlineColor.r, outlineColor.g, outlineColor.b),
          rotate: drawRotation,
        });
      }
    }

    page.drawText(lineText, {
      x,
      y,
      size: fontSize,
      font,
      color: hexToRgb(field.color),
      rotate: drawRotation,
    });
  }
}

const ProductionPage = () => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<TemplateEntry[]>([]);
  const [generating, setGenerating] = useState(false);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: presets } = useQuery({
    queryKey: ["all-presets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("presets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (templates && templates.length > 0 && entries.length === 0) {
      setEntries(
        templates.map((t) => ({
          templateId: t.id,
          templateName: t.nome,
          items: [{ nome: "", idade: 1, quantidade: 1 }],
        }))
      );
    }
  }, [templates]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const updateItem = (tIdx: number, iIdx: number, field: string, value: string | number) => {
    setEntries((prev) => {
      const next = [...prev];
      next[tIdx] = {
        ...next[tIdx],
        items: next[tIdx].items.map((item, i) =>
          i === iIdx ? { ...item, [field]: value } : item
        ),
      };
      return next;
    });
  };

  const addItem = (tIdx: number) => {
    setEntries((prev) => {
      const next = [...prev];
      next[tIdx] = {
        ...next[tIdx],
        items: [...next[tIdx].items, { nome: "", idade: 1, quantidade: 1 }],
      };
      return next;
    });
  };

  const removeItem = (tIdx: number, iIdx: number) => {
    setEntries((prev) => {
      const next = [...prev];
      if (next[tIdx].items.length <= 1) return prev;
      next[tIdx] = {
        ...next[tIdx],
        items: next[tIdx].items.filter((_, i) => i !== iIdx),
      };
      return next;
    });
  };

  const getPresetForTemplate = (templateId: string): PresetConfig => {
    const preset = presets?.find((p) => p.template_id === templateId);
    if (!preset) return defaultConfig;
    const saved = preset.config_json as unknown as Partial<PresetConfig>;
    return {
      ...defaultConfig,
      ...saved,
      nome: { ...defaultConfig.nome, ...(saved.nome || {}) },
      idade: { ...defaultConfig.idade, ...(saved.idade || {}) },
      baby: { ...defaultConfig.baby, ...(saved.baby || {}) },
    };
  };

  const generatePdf = async () => {
    const validEntries = entries.filter((e) => e.items.some((i) => i.nome.trim()));
    if (validEntries.length === 0) {
      toast.error("Preencha pelo menos um nome");
      return;
    }

    setGenerating(true);

    try {
      const outputPdf = await PDFDocument.create();

      let customFontBytes: ArrayBuffer | null = null;
      try {
        const resp = await fetch("/fonts/PORKYS.TTF");
        if (resp.ok) customFontBytes = await resp.arrayBuffer();
      } catch { /* fallback */ }

      // Uploaded .ttf fonts (Fontes page)
      const { data: uploadedFonts } = await supabase.from("fontes").select("*");
      const uploadedBytesCache = new Map<string, ArrayBuffer>();
      const getUploadedBytes = async (fontFamily: string) => {
        const match = uploadedFonts?.find((f) => f.nome === fontFamily);
        if (!match) return null;
        if (uploadedBytesCache.has(fontFamily)) return uploadedBytesCache.get(fontFamily)!;
        const { data: fontUrl } = supabase.storage.from("fonts").getPublicUrl(match.arquivo_path);
        const bytes = await fetch(fontUrl.publicUrl).then((r) => r.arrayBuffer());
        uploadedBytesCache.set(fontFamily, bytes);
        return bytes;
      };

      for (const entry of validEntries) {
        const template = templates?.find((t) => t.id === entry.templateId);
        if (!template) continue;

        const config = getPresetForTemplate(entry.templateId);

        const { data: urlData } = supabase.storage.from("templates").getPublicUrl(template.arquivo_path);
        const templateBytes = await fetch(urlData.publicUrl).then((r) => r.arrayBuffer());

        let pdfFont: PDFFont;
        let isPorkys = false;
        const uploadedBytes = await getUploadedBytes(config.fontFamily);

        if (uploadedBytes) {
          outputPdf.registerFontkit(fontkit);
          pdfFont = await outputPdf.embedFont(uploadedBytes);
          isPorkys = config.fontFamily === "Porkys";
        } else if (config.fontFamily === "Porkys" && customFontBytes) {
          outputPdf.registerFontkit(fontkit);
          pdfFont = await outputPdf.embedFont(customFontBytes);
          isPorkys = true;
        } else {
          const fontName = STANDARD_FONT_MAP[config.fontFamily] || StandardFonts.Helvetica;
          pdfFont = await outputPdf.embedFont(fontName);
        }

        for (const item of entry.items) {
          if (!item.nome.trim()) continue;

          for (let q = 0; q < item.quantidade; q++) {
            const templateDoc = await PDFDocument.load(templateBytes);
            const [page] = await outputPdf.copyPages(templateDoc, [0]);
            const baseFontSize = (config.fontSize || 48) * FONT_RENDER_SCALE;
            const pageRotation = normalizePageRotation(page.getRotation().angle);
            const normalizedConfig = normalizeConfigToPdf(config, page.getWidth(), page.getHeight(), pageRotation);

            // Nome - with line wrapping (max width ~200 PDF units)
            const nomeText = item.nome.toUpperCase();
            const nomeSize = (normalizedConfig.nome.fontSize || baseFontSize * 2) * FONT_RENDER_SCALE;

            // Espaçamento automático de Baby/Idade quando o nome quebra em 2 linhas
            const nomeFitted = fitNameLayout(nomeText, nomeSize, NAME_MAX_WIDTH, (value, size) =>
              pdfFont.widthOfTextAtSize(value, size),
            );
            const extra = getNameLineSpacingExtra(nomeFitted.lines.length, nomeFitted.fontSize);
            const nomeVisual = rawToVisualPoint(
              { x: normalizedConfig.nome.x, y: normalizedConfig.nome.y },
              page.getWidth(),
              page.getHeight(),
              pageRotation,
            );
            const shiftFor = (field: TextFieldConfig) =>
              getNeighborSpacingShift(
                rawToVisualPoint({ x: field.x, y: field.y }, page.getWidth(), page.getHeight(), pageRotation),
                nomeVisual,
                normalizedConfig.nome.rotation,
                extra,
              );

            // "Baby" text
            const babyText = "Baby";
            const babySize = (normalizedConfig.baby.fontSize || baseFontSize * 0.6 * 2) * FONT_RENDER_SCALE;
            drawTextWithOutline(page, babyText, normalizedConfig.baby, babySize, pdfFont, isPorkys, PORKYS_OUTLINES.baby, undefined, pageRotation, shiftFor(normalizedConfig.baby));

            drawTextWithOutline(page, nomeText, normalizedConfig.nome, nomeSize, pdfFont, isPorkys, PORKYS_OUTLINES.nome, NAME_MAX_WIDTH, pageRotation);

            // Idade
            const idadeText = item.idade === 1 ? "1 ANO" : `${item.idade} ANOS`;
            const idadeSize = (normalizedConfig.idade.fontSize || baseFontSize * 0.7 * 2) * FONT_RENDER_SCALE;
            drawTextWithOutline(page, idadeText, normalizedConfig.idade, idadeSize, pdfFont, isPorkys, PORKYS_OUTLINES.idade, undefined, pageRotation, shiftFor(normalizedConfig.idade));


            outputPdf.addPage(page);
          }
        }
      }

      const pdfBytes = await outputPdf.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const localPreviewUrl = URL.createObjectURL(blob);
      setPreviewUrl((currentPreviewUrl) => {
        if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);
        return localPreviewUrl;
      });

      const fileName = `output_${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage.from("outputs").upload(fileName, blob);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("outputs").getPublicUrl(fileName);
      setOutputUrl(publicUrlData.publicUrl);

      const allItems = validEntries.flatMap((e) => e.items.filter((i) => i.nome.trim()));
      await supabase.from("geracoes").insert([{
        template_id: validEntries[0].templateId,
        dados_entrada: JSON.parse(JSON.stringify(allItems)),
        arquivo_saida: fileName,
      }]);

      const totalPages = allItems.reduce((sum, i) => sum + i.quantidade, 0);
      toast.success(`PDF gerado com ${totalPages} páginas!`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao gerar PDF");
    } finally {
      setGenerating(false);
    }
  };

  const totalItems = entries.reduce((s, e) => s + e.items.filter((i) => i.nome.trim()).length, 0);
  const totalPages = entries.reduce(
    (s, e) => s + e.items.filter((i) => i.nome.trim()).reduce((ss, i) => ss + i.quantidade, 0),
    0
  );

  if (templatesLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Modo Produção</h1>
            <p className="text-muted-foreground text-sm">Preencha todos os templates e gere um PDF único</p>
          </div>
        </div>

        {totalItems > 0 && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {totalItems} itens • {totalPages} páginas
            </span>
            <Button onClick={generatePdf} disabled={generating} className="gap-2">
              {generating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
              ) : (
                <><FileText className="w-4 h-4" /> Gerar PDF</>
              )}
            </Button>
          </div>
        )}
      </div>

      {(!templates || templates.length === 0) ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground">Nenhum template encontrado. Adicione templates primeiro.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {entries.map((entry, tIdx) => (
            <div key={entry.templateId} className="capricha-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">{entry.templateName}</h3>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_80px_80px_40px] gap-3 text-xs font-medium text-muted-foreground uppercase">
                  <span>Nome</span>
                  <span>Idade</span>
                  <span>Qtd</span>
                  <span></span>
                </div>

                {entry.items.map((item, iIdx) => (
                  <div key={iIdx} className="grid grid-cols-[1fr_80px_80px_40px] gap-3 items-center">
                    <Input
                      placeholder="Nome da criança"
                      value={item.nome}
                      onChange={(e) => updateItem(tIdx, iIdx, "nome", e.target.value)}
                    />
                    <Input
                      type="number"
                      min={0}
                      value={item.idade}
                      onChange={(e) => updateItem(tIdx, iIdx, "idade", parseInt(e.target.value) || 0)}
                    />
                    <Input
                      type="number"
                      min={1}
                      value={item.quantidade}
                      onChange={(e) => updateItem(tIdx, iIdx, "quantidade", parseInt(e.target.value) || 1)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-destructive"
                      onClick={() => removeItem(tIdx, iIdx)}
                      disabled={entry.items.length <= 1}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                  </div>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 mt-2"
                  onClick={() => addItem(tIdx)}
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar item
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {outputUrl && previewUrl && (
        <div className="capricha-card p-6 border-accent bg-accent/10 mt-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-semibold text-primary">✅ PDF Gerado com Sucesso</h3>
            <Button asChild variant="outline" className="gap-2">
              <a href={outputUrl} target="_blank" rel="noopener noreferrer">
                <Download className="w-4 h-4" /> Baixar PDF
              </a>
            </Button>
          </div>
          <div className="h-[680px] overflow-hidden rounded-lg border border-border bg-background">
            <iframe
              src={`${previewUrl}#toolbar=0&navpanes=0&view=FitH`}
              title="Prévia do PDF final"
              className="h-full w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionPage;
