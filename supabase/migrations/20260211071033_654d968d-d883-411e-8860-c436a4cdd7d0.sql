
ALTER TABLE public.supplier_numbers
ADD COLUMN received_at timestamp with time zone NOT NULL DEFAULT now();

-- Backfill existing rows
UPDATE public.supplier_numbers SET received_at = created_at WHERE received_at = now();
