
CREATE TABLE public.project_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  analysis_link TEXT DEFAULT '',
  company_name TEXT DEFAULT '',
  company_activity TEXT DEFAULT '',
  responsible TEXT DEFAULT '',
  materials_requested BOOLEAN DEFAULT false,
  materials_sent BOOLEAN DEFAULT false,
  skillbase_ready BOOLEAN DEFAULT false,
  test_launched BOOLEAN DEFAULT false,
  report_day_1 BOOLEAN DEFAULT false,
  report_day_2 BOOLEAN DEFAULT false,
  report_day_3 BOOLEAN DEFAULT false,
  report_day_4 BOOLEAN DEFAULT false,
  report_day_5 BOOLEAN DEFAULT false,
  report_day_6 BOOLEAN DEFAULT false,
  report_day_7 BOOLEAN DEFAULT false,
  weekly_report BOOLEAN DEFAULT false,
  comment TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id)
);

ALTER TABLE public.project_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access project_status"
ON public.project_status FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Members read project status"
ON public.project_status FOR SELECT
USING (is_project_member(auth.uid(), project_id));

CREATE POLICY "Members update project status"
ON public.project_status FOR UPDATE
USING (is_project_member(auth.uid(), project_id));

CREATE POLICY "Members insert project status"
ON public.project_status FOR INSERT
WITH CHECK (is_project_member(auth.uid(), project_id));
