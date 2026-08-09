import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CustomFont {
  id: string;
  nome: string;
  arquivo_path: string;
  url: string;
}

export const useCustomFontsQuery = () =>
  useQuery({
    queryKey: ["fontes"],
    queryFn: async (): Promise<CustomFont[]> => {
      const { data, error } = await supabase
        .from("fontes")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []).map((f) => ({
        id: f.id,
        nome: f.nome,
        arquivo_path: f.arquivo_path,
        url: supabase.storage.from("fonts").getPublicUrl(f.arquivo_path).data.publicUrl,
      }));
    },
  });

const loaded = new Set<string>();

/** Registers every uploaded .ttf in the browser so canvas/preview can render it. */
export const useCustomFonts = (onLoaded?: () => void) => {
  const query = useCustomFontsQuery();
  const fonts = query.data;

  useEffect(() => {
    if (!fonts?.length) return;
    let cancelled = false;

    Promise.all(
      fonts.map(async (f) => {
        if (loaded.has(f.nome)) return;
        try {
          const face = new FontFace(f.nome, `url(${f.url})`);
          const face2 = await face.load();
          document.fonts.add(face2);
          loaded.add(f.nome);
        } catch {
          console.warn("Falha ao carregar fonte", f.nome);
        }
      })
    ).then(() => {
      if (!cancelled) onLoaded?.();
    });

    return () => {
      cancelled = true;
    };
  }, [fonts, onLoaded]);

  return query;
};
