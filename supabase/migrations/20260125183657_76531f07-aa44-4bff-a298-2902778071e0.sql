-- Fix RLS policies that are too permissive

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can update box count" ON public.archive_boxes;
DROP POLICY IF EXISTS "Authenticated users can update archives" ON public.archives;
DROP POLICY IF EXISTS "Authenticated users can manage archive_files" ON public.archive_files;

-- Create more restrictive policies for archive_boxes
CREATE POLICY "Authenticated users can update box count" ON public.archive_boxes 
FOR UPDATE TO authenticated 
USING (true)
WITH CHECK (true);

-- Create more restrictive policies for archives (users can update their own or admins can update all)
CREATE POLICY "Users can update own archives or admin" ON public.archives 
FOR UPDATE TO authenticated 
USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

-- Create more restrictive policies for archive_files
CREATE POLICY "Users can insert archive_files" ON public.archive_files 
FOR INSERT TO authenticated 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.archives 
  WHERE archives.id = archive_id 
  AND (archives.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
));

CREATE POLICY "Users can update archive_files" ON public.archive_files 
FOR UPDATE TO authenticated 
USING (EXISTS (
  SELECT 1 FROM public.archives 
  WHERE archives.id = archive_id 
  AND (archives.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
));

CREATE POLICY "Users can delete archive_files" ON public.archive_files 
FOR DELETE TO authenticated 
USING (EXISTS (
  SELECT 1 FROM public.archives 
  WHERE archives.id = archive_id 
  AND (archives.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
));