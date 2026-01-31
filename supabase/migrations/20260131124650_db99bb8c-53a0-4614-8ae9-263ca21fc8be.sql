-- Corriger les politiques RLS trop permissives

-- Supprimer la politique permissive pour sterilization_cycle_boxes
DROP POLICY IF EXISTS "Authenticated users can manage cycle boxes" ON public.sterilization_cycle_boxes;

-- Créer des politiques plus restrictives pour sterilization_cycle_boxes
CREATE POLICY "Authenticated users can insert cycle boxes"
ON public.sterilization_cycle_boxes FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update cycle boxes"
ON public.sterilization_cycle_boxes FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete cycle boxes"
ON public.sterilization_cycle_boxes FOR DELETE
USING (has_role(auth.uid(), 'admin'));