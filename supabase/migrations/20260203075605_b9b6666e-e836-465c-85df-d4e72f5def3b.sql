-- Create helper function to check if user can access sterilization (admin or instrumentiste)
CREATE OR REPLACE FUNCTION public.can_access_sterilization(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'instrumentiste')
  )
$$;