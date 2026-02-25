-- =============================================
-- TODOS TABLOSU YENİDEN OLUŞTURMA v2
-- Supabase SQL Editor'de çalıştırın.
-- =============================================

-- 1. Mevcut tabloyu kaldır
DROP TABLE IF EXISTS public.todos CASCADE;

-- 2. Yeni todos tablosu
CREATE TABLE public.todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  assignee_notes TEXT,
  assigner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigner_name TEXT,
  assignee_name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  is_priority BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. RLS Etkinleştir
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "todos_select" ON public.todos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "todos_insert" ON public.todos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "todos_update" ON public.todos
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "todos_delete" ON public.todos
  FOR DELETE TO authenticated USING (true);

-- 4. Trigger: assigner_name ve assignee_name otomatik doldur
CREATE OR REPLACE FUNCTION public.set_todo_names()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigner_id IS NOT NULL THEN
    SELECT name INTO NEW.assigner_name
    FROM public.profiles
    WHERE id = NEW.assigner_id;
  END IF;

  IF NEW.assignee_id IS NOT NULL THEN
    SELECT name INTO NEW.assignee_name
    FROM public.profiles
    WHERE id = NEW.assignee_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_todo_names_trigger
  BEFORE INSERT OR UPDATE ON public.todos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_todo_names();

-- 5. handle_updated_at fonksiyonu (yoksa oluştur)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_todos_updated
  BEFORE UPDATE ON public.todos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 6. Profiles SELECT izni
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'profiles_select_all_authenticated'
  ) THEN
    CREATE POLICY "profiles_select_all_authenticated" ON public.profiles
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- =============================================
-- ✅ TAMAMLANDI
-- Sütunlar: title, description, assignee_notes,
--   assigner_id/name, assignee_id/name,
--   status (pending/in_progress/completed),
--   is_priority, completed_at
-- =============================================
