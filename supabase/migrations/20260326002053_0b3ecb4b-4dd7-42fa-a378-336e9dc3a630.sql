
-- Create templates table
CREATE TABLE public.templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  arquivo_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create presets table
CREATE TABLE public.presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  config_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create geracoes table
CREATE TABLE public.geracoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  dados_entrada JSONB NOT NULL DEFAULT '[]',
  arquivo_saida TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create itens_gerados table
CREATE TABLE public.itens_gerados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  geracao_id UUID NOT NULL REFERENCES public.geracoes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  idade INTEGER NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1
);

-- Enable RLS
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_gerados ENABLE ROW LEVEL SECURITY;

-- Public access policies (internal system, no auth needed)
CREATE POLICY "Allow all access to templates" ON public.templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to presets" ON public.presets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to geracoes" ON public.geracoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to itens_gerados" ON public.itens_gerados FOR ALL USING (true) WITH CHECK (true);

-- Storage bucket for templates PDFs and outputs
INSERT INTO storage.buckets (id, name, public) VALUES ('templates', 'templates', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('outputs', 'outputs', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('fonts', 'fonts', true);

-- Storage policies
CREATE POLICY "Public read templates" ON storage.objects FOR SELECT USING (bucket_id = 'templates');
CREATE POLICY "Allow upload templates" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'templates');
CREATE POLICY "Allow delete templates" ON storage.objects FOR DELETE USING (bucket_id = 'templates');

CREATE POLICY "Public read outputs" ON storage.objects FOR SELECT USING (bucket_id = 'outputs');
CREATE POLICY "Allow upload outputs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'outputs');
CREATE POLICY "Allow delete outputs" ON storage.objects FOR DELETE USING (bucket_id = 'outputs');

CREATE POLICY "Public read fonts" ON storage.objects FOR SELECT USING (bucket_id = 'fonts');
CREATE POLICY "Allow upload fonts" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'fonts');

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON public.templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_presets_updated_at BEFORE UPDATE ON public.presets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
