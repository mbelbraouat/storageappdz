-- Add 'instrumentiste' role to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'instrumentiste';

-- Create sterilization_techniques table for configurable techniques
CREATE TABLE IF NOT EXISTS public.sterilization_techniques (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  temperature NUMERIC,
  pressure NUMERIC,
  duration_minutes INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sterilization_techniques ENABLE ROW LEVEL SECURITY;

-- Policies for sterilization_techniques
CREATE POLICY "Authenticated users can view techniques" 
ON public.sterilization_techniques 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage techniques" 
ON public.sterilization_techniques 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add created_by column to instruments table to track who created it
ALTER TABLE public.instruments 
ADD COLUMN IF NOT EXISTS created_by UUID;

-- Add trigger for updated_at on sterilization_techniques
CREATE TRIGGER update_sterilization_techniques_updated_at
BEFORE UPDATE ON public.sterilization_techniques
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default techniques based on existing enum values
INSERT INTO public.sterilization_techniques (name, code, description, temperature, pressure, duration_minutes) VALUES
  ('Stérilisation à vapeur', 'vapeur', 'Autoclavage standard à vapeur saturée', 134, 2.1, 18),
  ('Stérilisation plasma', 'plasma', 'Stérilisation par plasma de peroxyde d''hydrogène', 50, NULL, 45),
  ('Oxyde d''éthylène', 'oxyde_ethylene', 'Stérilisation chimique par gaz EtO', 55, NULL, 180),
  ('Stérilisation par radiation', 'radiation', 'Stérilisation par rayonnement gamma', NULL, NULL, 60)
ON CONFLICT (code) DO NOTHING;

-- Add technique_id to instrument_boxes to reference configurable techniques
ALTER TABLE public.instrument_boxes 
ADD COLUMN IF NOT EXISTS technique_id UUID REFERENCES public.sterilization_techniques(id);