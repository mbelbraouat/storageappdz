-- =====================================================
-- SYSTÈME DE STÉRILISATION COMPLET
-- =====================================================

-- Enum pour les statuts de stérilisation
CREATE TYPE sterilization_status AS ENUM ('dirty', 'cleaning', 'ready_for_sterilization', 'sterilizing', 'sterile', 'in_use');

-- Table des boîtes d'instruments
CREATE TABLE public.instrument_boxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    box_code TEXT UNIQUE NOT NULL,
    description TEXT,
    status sterilization_status NOT NULL DEFAULT 'dirty',
    last_sterilized_at TIMESTAMP WITH TIME ZONE,
    next_sterilization_due TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des instruments (outils)
CREATE TABLE public.instruments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    instrument_code TEXT UNIQUE NOT NULL,
    description TEXT,
    box_id UUID REFERENCES public.instrument_boxes(id) ON DELETE SET NULL,
    status sterilization_status NOT NULL DEFAULT 'dirty',
    condition TEXT DEFAULT 'good',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des cycles de stérilisation
CREATE TABLE public.sterilization_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_number INTEGER NOT NULL,
    machine_id TEXT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    temperature DECIMAL(5,2),
    pressure DECIMAL(5,2),
    duration_minutes INTEGER,
    status TEXT NOT NULL DEFAULT 'in_progress',
    operator_id UUID NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table de liaison: boîtes dans un cycle de stérilisation
CREATE TABLE public.sterilization_cycle_boxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID NOT NULL REFERENCES public.sterilization_cycles(id) ON DELETE CASCADE,
    box_id UUID NOT NULL REFERENCES public.instrument_boxes(id) ON DELETE CASCADE,
    result TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Historique des mouvements d'instruments
CREATE TABLE public.instrument_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instrument_id UUID REFERENCES public.instruments(id) ON DELETE CASCADE,
    box_id UUID REFERENCES public.instrument_boxes(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    from_status sterilization_status,
    to_status sterilization_status,
    performed_by UUID NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des permissions par rôle
CREATE TABLE public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role app_role NOT NULL,
    permission_key TEXT NOT NULL,
    is_allowed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(role, permission_key)
);

-- Insérer les permissions par défaut
INSERT INTO public.role_permissions (role, permission_key, is_allowed) VALUES
-- Admin permissions
('admin', 'manage_users', true),
('admin', 'manage_roles', true),
('admin', 'manage_doctors', true),
('admin', 'manage_operations', true),
('admin', 'manage_file_types', true),
('admin', 'manage_boxes', true),
('admin', 'manage_archives', true),
('admin', 'view_all_archives', true),
('admin', 'export_data', true),
('admin', 'import_data', true),
('admin', 'system_settings', true),
('admin', 'manage_sterilization', true),
-- User permissions
('user', 'manage_users', false),
('user', 'manage_roles', false),
('user', 'manage_doctors', false),
('user', 'manage_operations', false),
('user', 'manage_file_types', false),
('user', 'manage_boxes', false),
('user', 'manage_archives', true),
('user', 'view_all_archives', true),
('user', 'export_data', true),
('user', 'import_data', false),
('user', 'system_settings', false),
('user', 'manage_sterilization', false);

-- Enable RLS
ALTER TABLE public.instrument_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sterilization_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sterilization_cycle_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instrument_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies pour instrument_boxes
CREATE POLICY "Authenticated users can view instrument boxes"
ON public.instrument_boxes FOR SELECT
USING (true);

CREATE POLICY "Admins can manage instrument boxes"
ON public.instrument_boxes FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies pour instruments
CREATE POLICY "Authenticated users can view instruments"
ON public.instruments FOR SELECT
USING (true);

CREATE POLICY "Admins can manage instruments"
ON public.instruments FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies pour sterilization_cycles
CREATE POLICY "Authenticated users can view sterilization cycles"
ON public.sterilization_cycles FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create sterilization cycles"
ON public.sterilization_cycles FOR INSERT
WITH CHECK (auth.uid() = operator_id);

CREATE POLICY "Admins can update sterilization cycles"
ON public.sterilization_cycles FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR auth.uid() = operator_id);

-- RLS Policies pour sterilization_cycle_boxes
CREATE POLICY "Authenticated users can view cycle boxes"
ON public.sterilization_cycle_boxes FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can manage cycle boxes"
ON public.sterilization_cycle_boxes FOR ALL
USING (true);

-- RLS Policies pour instrument_movements
CREATE POLICY "Authenticated users can view instrument movements"
ON public.instrument_movements FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create instrument movements"
ON public.instrument_movements FOR INSERT
WITH CHECK (auth.uid() = performed_by);

-- RLS Policies pour role_permissions
CREATE POLICY "Authenticated users can view permissions"
ON public.role_permissions FOR SELECT
USING (true);

CREATE POLICY "Admins can manage permissions"
ON public.role_permissions FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Triggers pour updated_at
CREATE TRIGGER update_instrument_boxes_updated_at
BEFORE UPDATE ON public.instrument_boxes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_instruments_updated_at
BEFORE UPDATE ON public.instruments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_role_permissions_updated_at
BEFORE UPDATE ON public.role_permissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();