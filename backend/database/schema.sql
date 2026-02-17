-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Role enum
CREATE TYPE app_role AS ENUM ('admin', 'member');

-- Users table (replaces auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  has_gck BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Project members
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  allowed_tabs TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Suppliers
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT '',
  price_per_contact NUMERIC(10,2) DEFAULT 0,
  is_gck BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, name, tag)
);

-- Supplier numbers
CREATE TABLE supplier_numbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  phone_raw TEXT NOT NULL,
  phone_normalized TEXT NOT NULL,
  is_duplicate_in_project BOOLEAN NOT NULL DEFAULT false,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, supplier_id, phone_normalized)
);

-- Calls
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
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
  supplier_number_id UUID REFERENCES supplier_numbers(id) ON DELETE SET NULL,
  call_attempt_number INT NOT NULL DEFAULT 1,
  is_first_attempt BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, external_call_id)
);

-- Project pricing
CREATE TABLE project_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  price_per_number NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_per_call NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_per_minute NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Import jobs
CREATE TABLE import_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('suppliers', 'calls', 'gck')),
  filename TEXT NOT NULL DEFAULT '',
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  total_rows INT NOT NULL DEFAULT 0,
  inserted_rows INT NOT NULL DEFAULT 0,
  skipped_duplicates INT NOT NULL DEFAULT 0,
  error_rows INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Project status
CREATE TABLE project_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  responsible TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id)
);

-- Reanimation exports
CREATE TABLE reanimation_exports (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  exported_by UUID REFERENCES users(id) ON DELETE SET NULL,
  exported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  phone_count INTEGER NOT NULL DEFAULT 0,
  duration_filter TEXT NOT NULL DEFAULT 'all',
  filename TEXT NOT NULL DEFAULT '',
  date_from TIMESTAMPTZ,
  date_to TIMESTAMPTZ
);

-- Reanimation export numbers
CREATE TABLE reanimation_export_numbers (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  export_id UUID NOT NULL REFERENCES reanimation_exports(id) ON DELETE CASCADE,
  phone_normalized TEXT NOT NULL
);

-- Indexes
CREATE INDEX idx_calls_project ON calls(project_id);
CREATE INDEX idx_calls_phone ON calls(project_id, phone_normalized);
CREATE INDEX idx_calls_call_at ON calls(project_id, call_at);
CREATE INDEX idx_supplier_numbers_phone ON supplier_numbers(project_id, phone_normalized);
CREATE INDEX idx_project_members_user ON project_members(user_id);
CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_reanimation_export_numbers_phone ON reanimation_export_numbers(phone_normalized);
CREATE INDEX idx_reanimation_export_numbers_export ON reanimation_export_numbers(export_id);
CREATE INDEX idx_reanimation_exports_project ON reanimation_exports(project_id);

-- Functions
CREATE OR REPLACE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION is_project_member(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE user_id = _user_id AND project_id = _project_id
  )
$$;

CREATE OR REPLACE FUNCTION delete_project(_project_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM projects WHERE id = _project_id;
END;
$$;
