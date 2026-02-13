ALTER TABLE public.reanimation_exports
  ADD COLUMN date_from timestamp with time zone,
  ADD COLUMN date_to timestamp with time zone;