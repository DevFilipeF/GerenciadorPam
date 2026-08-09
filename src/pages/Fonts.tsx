import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Type, Upload, Trash2, Lock } from "lucide-react";
import { toast } from "sonner";
import { useCustomFonts } from "@/hooks/use-custom-fonts";

const BUILTIN_FONT = {
  id: "builtin-porkys",
  nome: "Porkys",
  label: "Baby Looney Tunes (Porkys)",
  url: "/fonts/PORKYS.TTF",
};

const FontsPage = () => {
  const queryClient = useQueryClient();
  const { data: fonts, isLoading } = useCustomFonts();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sample, setSample] = useState("Baby Looney Tunes");

  // Ensure the built-in font is registered for preview
  useEffect(() => {
    const face = new FontFace(BUILTIN_FONT.nome, `url(${BUILTIN_FONT.url})`);
    face
      .load()
      .then((f) => document.fonts.add(f))
      .catch(() => console.warn("Porkys font not loaded"));
  }, []);

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione um arquivo .ttf");
      const fontName = (nome || file.name.replace(/\.(ttf|otf)$/i, "")).trim();
      if (!fontName) throw new Error("Informe um nome para a fonte");

      const path = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
      const { error: upErr } = await supabase.storage.from("fonts").upload(path, file, {
        contentType: "font/ttf",
        upsert: false,
      });
      if (upErr) throw upErr;

      const { error } = await supabase.from("fontes").insert({ nome: fontName, arquivo_path: path });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fonte enviada com sucesso");
      queryClient.invalidateQueries({ queryKey: ["fontes"] });
      setOpen(false);
      setNome("");
      setFile(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao enviar fonte"),
  });

  const remove = useMutation({
    mutationFn: async (font: { id: string; arquivo_path: string }) => {
      await supabase.storage.from("fonts").remove([font.arquivo_path]);
      const { error } = await supabase.from("fontes").delete().eq("id", font.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fonte removida");
      queryClient.invalidateQueries({ queryKey: ["fontes"] });
    },
    onError: () => toast.error("Erro ao remover fonte"),
  });

  const items = [
    { ...BUILTIN_FONT, builtin: true as const, arquivo_path: "" },
    ...(fonts || []).map((f) => ({ ...f, label: f.nome, builtin: false as const })),
  ];

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Fontes</h1>
          <p className="text-sm text-muted-foreground">Envie arquivos .ttf para usar no editor e nos PDFs</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Upload className="w-4 h-4" /> Subir fonte
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova fonte (.ttf)</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Arquivo</Label>
                <Input
                  type="file"
                  accept=".ttf,.otf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Nome da fonte</Label>
                <Input
                  value={nome}
                  placeholder="Ex.: Porkys"
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                disabled={upload.isPending || !file}
                onClick={() => upload.mutate()}
              >
                {upload.isPending ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2 mb-6">
        <Label>Texto de exemplo (prévia em tempo real)</Label>
        <Input value={sample} onChange={(e) => setSample(e.target.value)} placeholder="Baby Looney Tunes" />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <ul className="space-y-3">
          {items.map((f) => (
            <li key={f.id} className="border border-border rounded-xl bg-card px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm flex items-center gap-2">
                    {f.label}
                    {f.builtin && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Lock className="w-3 h-3" /> fonte do sistema
                      </span>
                    )}
                  </p>

                  <div className="mt-3 space-y-2" style={{ fontFamily: `"${f.nome}"` }}>
                    <p className="text-3xl leading-tight break-words">{sample || "Baby Looney Tunes"}</p>
                    <p className="text-2xl leading-tight break-words">Baby</p>
                    <p className="text-2xl leading-tight break-words">FILIPE GABRIEL</p>
                    <p className="text-xl leading-tight break-words">1 ANO — 2 ANOS — 10 ANOS</p>
                    <p className="text-base leading-tight break-words">
                      ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789
                    </p>
                  </div>
                </div>

                {!f.builtin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove.mutate({ id: f.id, arquivo_path: f.arquivo_path })}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!isLoading && !fonts?.length && (
        <div className="mt-4 border border-dashed border-border rounded-xl p-6 text-center">
          <Type className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhuma fonte extra enviada ainda — a fonte do sistema (Porkys) já está disponível.
          </p>
        </div>
      )}
    </div>
  );
};

export default FontsPage;
