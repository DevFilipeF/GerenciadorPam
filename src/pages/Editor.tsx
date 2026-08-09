import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import EditorCanvas from "@/components/editor/EditorCanvas";
import EditorSidebar from "@/components/editor/EditorSidebar";
import { PresetConfig, defaultConfig } from "@/components/editor/types";
import { normalizeConfigToPdf, normalizePageRotation } from "@/lib/pdf-positioning";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

const EditorPage = () => {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [config, setConfig] = useState<PresetConfig>(defaultConfig);
  const [pdfPage, setPdfPage] = useState<any>(null);
  const [pdfDims, setPdfDims] = useState({ width: 0, height: 0 });

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const { data: template } = useQuery({
    queryKey: ["template", templateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("templates")
        .select("*")
        .eq("id", templateId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!templateId,
  });

  const { data: preset } = useQuery({
    queryKey: ["preset", templateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("presets")
        .select("*")
        .eq("template_id", templateId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!templateId,
  });

  useEffect(() => {
    if (!pdfPage) return;

    const saved = preset?.config_json as unknown as Partial<PresetConfig> | undefined;
    const mergedConfig: PresetConfig = {
      ...defaultConfig,
      ...saved,
      nome: { ...defaultConfig.nome, ...(saved?.nome || {}) },
      idade: { ...defaultConfig.idade, ...(saved?.idade || {}) },
      baby: { ...defaultConfig.baby, ...(saved?.baby || {}) },
    };

    const [x1, y1, x2, y2] = pdfPage.view;
    const rawWidth = x2 - x1;
    const rawHeight = y2 - y1;
    const rotation = normalizePageRotation(pdfPage.getViewport({ scale: 1 }).rotation);

    setConfig(normalizeConfigToPdf(mergedConfig, rawWidth, rawHeight, rotation));
  }, [preset, pdfPage]);

  // Load PDF
  useEffect(() => {
    if (!template) return;

    const loadPdf = async () => {
      const { data } = supabase.storage.from("templates").getPublicUrl(template.arquivo_path);
      const pdf = await pdfjsLib.getDocument(data.publicUrl).promise;
      const page = await pdf.getPage(1);
      setPdfPage(page);

      const viewport = page.getViewport({ scale: 1 });
      setPdfDims({ width: viewport.width, height: viewport.height });
    };

    loadPdf();
  }, [template]);

  // Auto-save with debounce
  const autoSave = useCallback(
    (newConfig: PresetConfig) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      saveTimeoutRef.current = setTimeout(async () => {
        if (!templateId) return;

        const configJson = JSON.parse(JSON.stringify(newConfig));

        if (preset) {
          await supabase
            .from("presets")
            .update({ config_json: configJson })
            .eq("id", preset.id);
        } else {
          await supabase
            .from("presets")
            .insert([{ template_id: templateId, config_json: configJson }]);
        }

        queryClient.invalidateQueries({ queryKey: ["preset", templateId] });
      }, 800);
    },
    [templateId, preset, queryClient]
  );

  const handleConfigChange = useCallback(
    (newConfig: PresetConfig) => {
      setConfig(newConfig);
      autoSave(newConfig);
    },
    [autoSave]
  );

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-border bg-card">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <h2 className="font-semibold text-foreground">{template?.nome || "Editor"}</h2>
          <span className="capricha-badge bg-accent text-accent-foreground ml-auto">
            <Save className="w-3 h-3" /> Salvo automaticamente
          </span>
        </div>

        {pdfPage && pdfDims.width > 0 && (
          <EditorCanvas
            pdfPage={pdfPage}
            pdfDims={pdfDims}
            config={config}
            onConfigChange={handleConfigChange}
          />
        )}
      </div>

      <EditorSidebar config={config} onConfigChange={handleConfigChange} />
    </div>
  );
};

export default EditorPage;
