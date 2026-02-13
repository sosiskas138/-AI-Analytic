
-- 1) Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'member');

-- 2) Projects (needed before project_members)
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 3) Project members (needed before is_project_member function)
CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- 4) Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5) User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 6) Security definer: has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 7) Security definer: is_project_member
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE user_id = _user_id AND project_id = _project_id
  )
$$;

-- 8) Suppliers
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, name, tag)
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- 9) Supplier numbers
CREATE TABLE public.supplier_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  phone_raw TEXT NOT NULL,
  phone_normalized TEXT NOT NULL,
  is_duplicate_in_project BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, supplier_id, phone_normalized)
);
ALTER TABLE public.supplier_numbers ENABLE ROW LEVEL SECURITY;

-- 10) Calls
CREATE TABLE public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  external_call_id TEXT NOT NULL,
  phone_raw TEXT NOT NULL,
  phone_normalized TEXT NOT NULL,
  call_list TEXT DEFAULT '',
  skill_base TEXT DEFAULT '',
  call_at TIMESTAMPTZ NOT NULL,
  duration_seconds INT NOT NULL DEFAULT 0,
  billed_minutes INT NOT NULL GENERATED ALWAYS AS (CEIL(duration_seconds::NUMERIC / 60)::INT) STORED,
  status TEXT NOT NULL DEFAULT '',
  end_reason TEXT DEFAULT '',
  is_lead BOOLEAN NOT NULL DEFAULT false,
  supplier_number_id UUID REFERENCES public.supplier_numbers(id),
  call_attempt_number INT NOT NULL DEFAULT 1,
  is_first_attempt BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, external_call_id)
);
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- 11) Project pricing
CREATE TABLE public.project_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  price_per_number NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_per_call NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_per_minute NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_pricing ENABLE ROW LEVEL SECURITY;

-- 12) Import jobs
CREATE TABLE public.import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('suppliers', 'calls')),
  filename TEXT NOT NULL DEFAULT '',
  uploaded_by UUID REFERENCES auth.users(id),
  total_rows INT NOT NULL DEFAULT 0,
  inserted_rows INT NOT NULL DEFAULT 0,
  skipped_duplicates INT NOT NULL DEFAULT 0,
  error_rows INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

-- 13) Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 14) Indexes
CREATE INDEX idx_calls_project ON public.calls(project_id);
CREATE INDEX idx_calls_phone ON public.calls(project_id, phone_normalized);
CREATE INDEX idx_calls_call_at ON public.calls(project_id, call_at);
CREATE INDEX idx_supplier_numbers_phone ON public.supplier_numbers(project_id, phone_normalized);
CREATE INDEX idx_project_members_user ON public.project_members(user_id);
CREATE INDEX idx_project_members_project ON public.project_members(project_id);

-- ========== RLS POLICIES ==========

-- Profiles
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins read all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- User roles
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Projects
CREATE POLICY "Admins full access projects" ON public.projects FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Members read assigned projects" ON public.projects FOR SELECT USING (public.is_project_member(auth.uid(), id));

-- Project members
CREATE POLICY "Admins manage members" ON public.project_members FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Members read own membership" ON public.project_members FOR SELECT USING (auth.uid() = user_id);

-- Suppliers
CREATE POLICY "Admins full access suppliers" ON public.suppliers FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Members read project suppliers" ON public.suppliers FOR SELECT USING (public.is_project_member(auth.uid(), project_id));

-- Supplier numbers
CREATE POLICY "Admins full access supplier_numbers" ON public.supplier_numbers FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Members read project supplier_numbers" ON public.supplier_numbers FOR SELECT USING (public.is_project_member(auth.uid(), project_id));

-- Calls
CREATE POLICY "Admins full access calls" ON public.calls FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Members read project calls" ON public.calls FOR SELECT USING (public.is_project_member(auth.uid(), project_id));

-- Project pricing
CREATE POLICY "Admins manage pricing" ON public.project_pricing FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Members read project pricing" ON public.project_pricing FOR SELECT USING (public.is_project_member(auth.uid(), project_id));

-- Import jobs
CREATE POLICY "Admins full access imports" ON public.import_jobs FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Members read project imports" ON public.import_jobs FOR SELECT USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Members insert project imports" ON public.import_jobs FOR INSERT WITH CHECK (public.is_project_member(auth.uid(), project_id));
