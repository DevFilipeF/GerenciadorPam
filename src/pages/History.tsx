import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Download, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

const HistoryPage = () => {
  const { data: geracoes, isLoading } = useQuery({
    queryKey: ["geracoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("geracoes")
        .select("*, templates(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Histórico de Gerações</h1>
        <p className="text-muted-foreground mt-1">Todas as gerações de PDF realizadas</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="capricha-card p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3 mb-2" />
              <div className="h-3 bg-muted rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : geracoes?.length === 0 ? (
        <div className="text-center py-20">
          <Calendar className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium mb-1">Nenhuma geração</h3>
          <p className="text-muted-foreground text-sm">As gerações de PDF aparecerão aqui</p>
        </div>
      ) : (
        <div className="space-y-3">
          {geracoes?.map((g) => {
            const dados = g.dados_entrada as unknown as Array<{ nome: string; idade: number; quantidade: number }>;
            const totalPages = Array.isArray(dados)
              ? dados.reduce((s, i) => s + (i.quantidade || 1), 0)
              : 0;

            return (
              <div key={g.id} className="capricha-card p-5 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{(g as any).templates?.nome || "Template"}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {new Date(g.created_at).toLocaleString("pt-BR")} —{" "}
                    {Array.isArray(dados) ? dados.length : 0} itens, {totalPages} páginas
                  </p>
                </div>
                {g.arquivo_saida && (
                  <Button variant="outline" size="sm" className="gap-1.5" asChild>
                    <a
                      href={supabase.storage.from("outputs").getPublicUrl(g.arquivo_saida).data.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="w-3.5 h-3.5" /> Baixar
                    </a>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
