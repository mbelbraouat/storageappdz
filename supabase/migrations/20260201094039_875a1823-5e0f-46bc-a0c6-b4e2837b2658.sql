-- Enum pour les types de stérilisation
DO $$ BEGIN
  CREATE TYPE sterilization_type AS ENUM ('vapeur', 'plasma', 'oxyde_ethylene', 'radiation');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enum pour les étapes du workflow
DO $$ BEGIN
  CREATE TYPE sterilization_step AS ENUM (
    'reception',
    'pre_disinfection', 
    'cleaning',
    'conditioning',
    'sterilization',
    'control',
    'storage',
    'distribution'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Table des services hospitaliers
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view services" ON public.services
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage services" ON public.services
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Ajouter colonnes à instrument_boxes
ALTER TABLE public.instrument_boxes 
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id),
  ADD COLUMN IF NOT EXISTS assigned_service_id UUID REFERENCES public.services(id),
  ADD COLUMN IF NOT EXISTS assigned_bloc TEXT,
  ADD COLUMN IF NOT EXISTS sterilization_type sterilization_type DEFAULT 'vapeur',
  ADD COLUMN IF NOT EXISTS current_step sterilization_step;

-- Table des affectations de boîtes
CREATE TABLE IF NOT EXISTS public.box_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id UUID NOT NULL REFERENCES public.instrument_boxes(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id),
  bloc_operatoire TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  assigned_by UUID REFERENCES auth.users(id),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'assigned', 'in_use', 'returned'))
);

ALTER TABLE public.box_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view assignments" ON public.box_assignments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create assignments" ON public.box_assignments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update assignments" ON public.box_assignments
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Table du journal de workflow de stérilisation
CREATE TABLE IF NOT EXISTS public.sterilization_workflow_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id UUID NOT NULL REFERENCES public.instrument_boxes(id) ON DELETE CASCADE,
  from_step sterilization_step,
  to_step sterilization_step NOT NULL,
  performed_by UUID NOT NULL REFERENCES auth.users(id),
  sterilization_type sterilization_type,
  validation_result TEXT CHECK (validation_result IN ('passed', 'failed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sterilization_workflow_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view workflow log" ON public.sterilization_workflow_log
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create workflow log" ON public.sterilization_workflow_log
  FOR INSERT WITH CHECK (auth.uid() = performed_by);

-- Trigger pour updated_at sur services
CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insérer quelques services par défaut
INSERT INTO public.services (name, code, description) VALUES
  ('Bloc Opératoire Central', 'BOC', 'Bloc opératoire principal'),
  ('Urgences', 'URG', 'Service des urgences'),
  ('Chirurgie Générale', 'CHG', 'Service de chirurgie générale'),
  ('Orthopédie', 'ORT', 'Service d''orthopédie'),
  ('Cardiologie', 'CAR', 'Service de cardiologie')
ON CONFLICT (code) DO NOTHING;