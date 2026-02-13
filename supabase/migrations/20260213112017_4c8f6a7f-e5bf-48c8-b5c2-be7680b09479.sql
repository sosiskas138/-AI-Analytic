
-- Add is_gck flag to suppliers to distinguish GCK bases from regular ones
ALTER TABLE public.suppliers ADD COLUMN is_gck boolean NOT NULL DEFAULT false;
