-- Fix RLS policies for box_movements - remove overly permissive INSERT
DROP POLICY IF EXISTS "Authenticated users can create box movements" ON public.box_movements;

-- Only allow authenticated users to create movements they perform
CREATE POLICY "Users can create own box movements"
ON public.box_movements FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = performed_by);

-- Fix RLS policies for notifications - remove overly permissive INSERT
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;

-- Only admins can create notifications, or system creates for specific user
CREATE POLICY "Admins can create notifications"
ON public.notifications FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR user_id = auth.uid());