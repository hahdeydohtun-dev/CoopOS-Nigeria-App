CREATE TABLE public.staff_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cooperative_id UUID NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  severity TEXT NOT NULL DEFAULT 'INFO',
  read_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_notifications_coop ON public.staff_notifications (cooperative_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_notifications TO authenticated;
GRANT ALL ON public.staff_notifications TO service_role;

ALTER TABLE public.staff_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view cooperative alerts"
  ON public.staff_notifications FOR SELECT TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Staff can create cooperative alerts"
  ON public.staff_notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Staff can update cooperative alerts"
  ON public.staff_notifications FOR UPDATE TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_member_of_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()));

CREATE TRIGGER set_staff_notifications_updated_at
  BEFORE UPDATE ON public.staff_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();