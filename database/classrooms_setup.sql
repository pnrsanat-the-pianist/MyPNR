-- Derslikler sayfasi icin Supabase kurulumu
-- Bu script tekrar calistirilmaya uygun olacak sekilde yazilmistir.

CREATE TABLE IF NOT EXISTS public.classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  allowed_branches TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.classrooms
  ADD COLUMN IF NOT EXISTS allowed_branches TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.classrooms
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.classrooms
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.set_classrooms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_classrooms_updated_at ON public.classrooms;
CREATE TRIGGER trg_classrooms_updated_at
BEFORE UPDATE ON public.classrooms
FOR EACH ROW
EXECUTE FUNCTION public.set_classrooms_updated_at();

CREATE INDEX IF NOT EXISTS idx_classrooms_is_active ON public.classrooms(is_active);
CREATE INDEX IF NOT EXISTS idx_classrooms_name ON public.classrooms(name);
CREATE INDEX IF NOT EXISTS idx_classrooms_allowed_branches ON public.classrooms USING GIN (allowed_branches);

ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS classrooms_select ON public.classrooms;
CREATE POLICY classrooms_select
ON public.classrooms
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS classrooms_insert ON public.classrooms;
CREATE POLICY classrooms_insert
ON public.classrooms
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('Admin', 'Kurucu', 'Müdür')
  )
);

DROP POLICY IF EXISTS classrooms_update ON public.classrooms;
CREATE POLICY classrooms_update
ON public.classrooms
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('Admin', 'Kurucu', 'Müdür')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('Admin', 'Kurucu', 'Müdür')
  )
);

DROP POLICY IF EXISTS classrooms_delete ON public.classrooms;
CREATE POLICY classrooms_delete
ON public.classrooms
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('Admin', 'Kurucu', 'Müdür')
  )
);

INSERT INTO public.role_permissions (role, resource_key, can_view, can_edit)
VALUES
  ('Admin', 'derslikler', true, true),
  ('Kurucu', 'derslikler', true, true),
  ('Müdür', 'derslikler', true, true),
  ('Personel', 'derslikler', true, false)
ON CONFLICT (role, resource_key) DO NOTHING;
