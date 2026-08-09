import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Upload, Pencil, Trash2, ChevronDown, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Group templates by theme keywords
function groupByTheme(templates: any[]) {
  const themes: Record<string, any[]> = {};
  const ungrouped: any[] = [];

  const THEME_KEYWORDS: Record<string, string[]> = {
    "Baby Looney Tunes": ["baby looney", "looney tunes", "looney", "pernalonga", "patolino", "taz", "frajola", "piu-piu", "lola"],
  };

  for (const t of templates) {
    const nome = t.nome.toLowerCase();
    let matched = false;
    for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
      if (keywords.some((k) => nome.includes(k))) {
        if (!themes[theme]) themes[theme] = [];
        themes[theme].push(t);
        matched = true;
        break;
      }
    }
    if (!matched) ungrouped.push(t);
  }

  return { themes, ungrouped };
}

const TemplatesPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [openThemes, setOpenThemes] = useState<Record<string, boolean>>({});

  const { data: templates, isLoading } = useQuery({
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

  const grouped = useMemo(() => {
    if (!templates) return { themes: {}, ungrouped: [] };
    return groupByTheme(templates);
  }, [templates]);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file || !templateName) throw new Error("Preencha todos os campos");
      const fileName = `${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("templates").upload(fileName, file);
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from("templates").insert({ nome: templateName, arquivo_path: fileName });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setUploadOpen(false);
      setTemplateName("");
      setFile(null);
      toast.success("Template enviado com sucesso!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (template: { id: string; arquivo_path: string }) => {
      await supabase.storage.from("templates").remove([template.arquivo_path]);
      const { error } = await supabase.from("templates").delete().eq("id", template.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Template removido");
    },
  });

  const toggleTheme = (theme: string) => {
    setOpenThemes((prev) => ({ ...prev, [theme]: !prev[theme] }));
  };

  const TemplateRow = ({ template }: { template: any }) => (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/60 transition-colors group">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <FileTextIcon className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{template.nome}</p>
          <p className="text-[11px] text-muted-foreground">
            {new Date(template.created_at).toLocaleDateString("pt-BR")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => navigate(`/editor/${template.id}`)}
        >
          <Pencil className="w-3.5 h-3.5" /> Editar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-destructive hover:text-destructive"
          onClick={() => deleteMutation.mutate({ id: template.id, arquivo_path: template.arquivo_path })}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Templates</h1>
          <p className="text-muted-foreground mt-1">Gerencie seus templates de PDF por tema</p>
        </div>

        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Novo Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enviar Template PDF</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Nome do Template</label>
                <Input
                  placeholder="Ex: Baby Looney Tunes - Pernalonga"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Arquivo PDF</label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <input
                    type="file"
                    accept=".pdf"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    style={{ position: "relative" }}
                  />
                  <p className="text-sm text-muted-foreground">
                    {file ? file.name : "Clique para selecionar um PDF"}
                  </p>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => uploadMutation.mutate()}
                disabled={uploadMutation.isPending || !file || !templateName}
              >
                {uploadMutation.isPending ? "Enviando..." : "Enviar Template"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : templates?.length === 0 ? (
        <div className="text-center py-20">
          <FileIcon className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium mb-1">Nenhum template</h3>
          <p className="text-muted-foreground text-sm">Envie seu primeiro template PDF para começar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Themed groups */}
          {Object.entries(grouped.themes).map(([theme, items]) => (
            <Collapsible
              key={theme}
              open={openThemes[theme] ?? false}
              onOpenChange={() => toggleTheme(theme)}
            >
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all">
                  <div className="w-9 h-9 rounded-lg capricha-gradient flex items-center justify-center shadow-sm">
                    <FolderOpen className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <span className="font-semibold text-sm">{theme}</span>
                    <span className="text-[11px] text-muted-foreground ml-2">
                      {items.length} {items.length === 1 ? "faca" : "facas"}
                    </span>
                  </div>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-muted-foreground transition-transform duration-200",
                      openThemes[theme] && "rotate-180"
                    )}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-6 mt-1 border-l-2 border-primary/20 pl-4 space-y-0.5 py-1">
                  {items.map((t) => (
                    <TemplateRow key={t.id} template={t} />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}

          {/* Ungrouped templates */}
          {grouped.ungrouped.length > 0 && (
            <div className="space-y-0.5">
              {Object.keys(grouped.themes).length > 0 && (
                <p className="text-xs font-semibold uppercase text-muted-foreground px-4 pt-3 pb-1">Outros</p>
              )}
              {grouped.ungrouped.map((t) => (
                <TemplateRow key={t.id} template={t} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const FileIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14,2 14,8 20,8" />
  </svg>
);

const FileTextIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14,2 14,8 20,8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10,9 9,9 8,9" />
  </svg>
);

export default TemplatesPage;
