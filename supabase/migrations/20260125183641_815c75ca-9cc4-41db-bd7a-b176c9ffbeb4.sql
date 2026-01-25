-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

-- Create doctors table
CREATE TABLE public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  specialty TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create operation_actes table
CREATE TABLE public.operation_actes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create file_types table (files to scan)
CREATE TABLE public.file_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_required BOOLEAN DEFAULT false NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create archive_boxes table
CREATE TABLE public.archive_boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  max_capacity INTEGER NOT NULL DEFAULT 50,
  current_count INTEGER NOT NULL DEFAULT 0,
  shelf TEXT NOT NULL,
  column_position TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('left', 'right')),
  qr_code TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create archives table (main archive records)
CREATE TABLE public.archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_full_name TEXT NOT NULL,
  admission_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  doctor_id UUID REFERENCES public.doctors(id) NOT NULL,
  operation_acte_id UUID REFERENCES public.operation_actes(id) NOT NULL,
  box_id UUID REFERENCES public.archive_boxes(id) NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  notes TEXT,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  is_archived BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create archive_files table (scanned files for each archive)
CREATE TABLE public.archive_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archive_id UUID REFERENCES public.archives(id) ON DELETE CASCADE NOT NULL,
  file_type_id UUID REFERENCES public.file_types(id) NOT NULL,
  file_url TEXT,
  file_name TEXT,
  is_attached BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create system_settings table for LDAP, NAS, Mail, Notifications
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create activity_log table
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_actes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for doctors
CREATE POLICY "Authenticated users can view doctors" ON public.doctors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage doctors" ON public.doctors FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for operation_actes
CREATE POLICY "Authenticated users can view operation_actes" ON public.operation_actes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage operation_actes" ON public.operation_actes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for file_types
CREATE POLICY "Authenticated users can view file_types" ON public.file_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage file_types" ON public.file_types FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for archive_boxes
CREATE POLICY "Authenticated users can view boxes" ON public.archive_boxes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update box count" ON public.archive_boxes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can manage boxes" ON public.archive_boxes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete boxes" ON public.archive_boxes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for archives
CREATE POLICY "Authenticated users can view archives" ON public.archives FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create archives" ON public.archives FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated users can update archives" ON public.archives FOR UPDATE TO authenticated USING (true);

-- RLS Policies for archive_files
CREATE POLICY "Authenticated users can view archive_files" ON public.archive_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage archive_files" ON public.archive_files FOR ALL TO authenticated USING (true);

-- RLS Policies for system_settings
CREATE POLICY "Authenticated users can view settings" ON public.system_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage settings" ON public.system_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for activity_log
CREATE POLICY "Users can view activity log" ON public.activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create activity log" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Create function to update box count
CREATE OR REPLACE FUNCTION public.update_box_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.archive_boxes 
    SET current_count = current_count + 1 
    WHERE id = NEW.box_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.archive_boxes 
    SET current_count = current_count - 1 
    WHERE id = OLD.box_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND NEW.box_id != OLD.box_id THEN
    UPDATE public.archive_boxes 
    SET current_count = current_count - 1 
    WHERE id = OLD.box_id;
    UPDATE public.archive_boxes 
    SET current_count = current_count + 1 
    WHERE id = NEW.box_id;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for box count
CREATE TRIGGER update_box_count_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.archives
FOR EACH ROW EXECUTE FUNCTION public.update_box_count();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  
  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_doctors_updated_at BEFORE UPDATE ON public.doctors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_operation_actes_updated_at BEFORE UPDATE ON public.operation_actes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_file_types_updated_at BEFORE UPDATE ON public.file_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_archive_boxes_updated_at BEFORE UPDATE ON public.archive_boxes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_archives_updated_at BEFORE UPDATE ON public.archives FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for activity tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.archives;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;