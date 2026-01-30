-- Add status column to archive_boxes
ALTER TABLE public.archive_boxes 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'available' 
CHECK (status IN ('available', 'full', 'sealed'));

-- Add box_number column for automatic numbering
ALTER TABLE public.archive_boxes 
ADD COLUMN IF NOT EXISTS box_number integer;

-- Create unique index for box_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_archive_boxes_box_number ON public.archive_boxes(box_number) WHERE box_number IS NOT NULL;

-- Create box_movements table for history tracking
CREATE TABLE IF NOT EXISTS public.box_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  box_id uuid NOT NULL REFERENCES public.archive_boxes(id) ON DELETE CASCADE,
  action text NOT NULL,
  from_location text,
  to_location text,
  notes text,
  performed_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on box_movements
ALTER TABLE public.box_movements ENABLE ROW LEVEL SECURITY;

-- RLS policies for box_movements
CREATE POLICY "Authenticated users can view box movements"
ON public.box_movements FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create box movements"
ON public.box_movements FOR INSERT
WITH CHECK (auth.uid() = performed_by);

CREATE POLICY "Admins can manage box movements"
ON public.box_movements FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  entity_type text,
  entity_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Authenticated users can create notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (user_id IS NULL OR user_id = auth.uid());

-- Add realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.box_movements;