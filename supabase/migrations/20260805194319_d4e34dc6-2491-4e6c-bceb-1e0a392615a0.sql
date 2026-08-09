CREATE TABLE public.fontes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  arquivo_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fontes TO anon, authenticated;
GRANT ALL ON public.fontes TO service_role;
ALTER TABLE public.fontes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fontes publicas" ON public.fontes FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Fonts bucket read" ON storage.objects FOR SELECT USING (bucket_id = 'fonts');
CREATE POLICY "Fonts bucket insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'fonts');
CREATE POLICY "Fonts bucket delete" ON storage.objects FOR DELETE USING (bucket_id = 'fonts');