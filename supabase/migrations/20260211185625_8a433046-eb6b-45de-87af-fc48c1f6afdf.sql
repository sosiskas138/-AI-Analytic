
-- Batch/pack of exported reanimation numbers
CREATE TABLE public.reanimation_exports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  exported_by UUID,
  exported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  phone_count INTEGER NOT NULL DEFAULT 0,
  duration_filter TEXT NOT NULL DEFAULT 'all',
  filename TEXT NOT NULL DEFAULT ''
);

-- Individual phone numbers in each export
CREATE TABLE public.reanimation_export_numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  export_id UUID NOT NULL REFERENCES public.reanimation_exports(id) ON DELETE CASCADE,
  phone_normalized TEXT NOT NULL
);

CREATE INDEX idx_reanimation_export_numbers_phone ON public.reanimation_export_numbers(phone_normalized);
CREATE INDEX idx_reanimation_export_numbers_export ON public.reanimation_export_numbers(export_id);
CREATE INDEX idx_reanimation_exports_project ON public.reanimation_exports(project_id);

-- RLS
ALTER TABLE public.reanimation_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reanimation_export_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access reanimation_exports"
  ON public.reanimation_exports FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Members read project reanimation_exports"
  ON public.reanimation_exports FOR SELECT
  USING (is_project_member(auth.uid(), project_id));

CREATE POLICY "Members insert project reanimation_exports"
  ON public.reanimation_exports FOR INSERT
  WITH CHECK (is_project_member(auth.uid(), project_id));

CREATE POLICY "Admins full access reanimation_export_numbers"
  ON public.reanimation_export_numbers FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Members read reanimation_export_numbers"
  ON public.reanimation_export_numbers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.reanimation_exports e
    WHERE e.id = export_id AND is_project_member(auth.uid(), e.project_id)
  ));

CREATE POLICY "Members insert reanimation_export_numbers"
  ON public.reanimation_export_numbers FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.reanimation_exports e
    WHERE e.id = export_id AND is_project_member(auth.uid(), e.project_id)
  ));
