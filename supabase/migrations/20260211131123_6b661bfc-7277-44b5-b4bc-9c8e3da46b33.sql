
CREATE OR REPLACE FUNCTION public.delete_project(_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can delete
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can delete projects';
  END IF;

  -- Delete all related data
  DELETE FROM public.calls WHERE project_id = _project_id;
  DELETE FROM public.import_jobs WHERE project_id = _project_id;
  DELETE FROM public.supplier_numbers WHERE supplier_id IN (
    SELECT id FROM public.suppliers WHERE project_id = _project_id
  );
  DELETE FROM public.suppliers WHERE project_id = _project_id;
  DELETE FROM public.project_pricing WHERE project_id = _project_id;
  DELETE FROM public.project_status WHERE project_id = _project_id;
  DELETE FROM public.project_members WHERE project_id = _project_id;
  DELETE FROM public.projects WHERE id = _project_id;
END;
$$;
