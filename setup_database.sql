-- =============================================
-- 🎵 MyPNR - PNR Sanat Akademisi
-- Veritabanı Kurulum SQL Scripti
-- Supabase SQL Editor'de çalıştırın
-- =============================================
-- ÖNEMLİ: Bu script mevcut profiles ve role_permissions
-- tablolarını KORUR, sadece eksik tabloları oluşturur.
-- =============================================

-- =============================================
-- 1. PROFILES TABLE (ZATEN MEVCUT - ATLA)
-- =============================================
-- profiles tablosu zaten oluşturuldu (migration: create_profiles_table)
-- 3 kullanıcı mevcut:
--   kaan.calis@gmail.com  -> Admin
--   pinar@pnrsanat.com    -> Kurucu
--   merhaba@pnrsanat.com  -> Müdür

-- =============================================
-- 2. ROLE_PERMISSIONS TABLE (ZATEN MEVCUT - ATLA)
-- =============================================
-- role_permissions tablosu zaten oluşturuldu (migration: create_role_permissions_table)
-- 50 izin kaydı mevcut

-- =============================================
-- 3. BRANCHES (Branşlar) TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  upper_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  color_code TEXT DEFAULT '#6B21A8',
  icon_name TEXT DEFAULT 'Music',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view branches"
  ON public.branches FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin and Kurucu can manage branches"
  ON public.branches FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('Admin', 'Kurucu', 'Müdür')
    )
  );

-- =============================================
-- 4. TEACHERS (Öğretmenler) TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  branch_ids UUID[] DEFAULT '{}',
  salary_info TEXT,
  sgk_info TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view teachers"
  ON public.teachers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin Kurucu Mudur can manage teachers"
  ON public.teachers FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('Admin', 'Kurucu', 'Müdür')
    )
  );

-- =============================================
-- 5. CLASSROOMS (Sınıflar) TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  capacity INTEGER DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view classrooms"
  ON public.classrooms FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin Kurucu Mudur can manage classrooms"
  ON public.classrooms FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('Admin', 'Kurucu', 'Müdür')
    )
  );

-- =============================================
-- 6. STUDENTS (Öğrenciler) TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'trial', 'pending', 'cancelled')),
  enrollment_type TEXT CHECK (enrollment_type IN ('package', 'monthly')),
  remaining_package_lessons INTEGER DEFAULT 0,
  phone TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  parent_email TEXT,
  birth_date DATE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view students"
  ON public.students FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can manage students"
  ON public.students FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('Admin', 'Kurucu', 'Müdür', 'Personel')
    )
  );

-- Parents can view their own children
CREATE POLICY "Parents can view own children"
  ON public.students FOR SELECT USING (
    parent_id = auth.uid()
  );

-- =============================================
-- 7. LESSONS (Dersler) TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  duration INTEGER DEFAULT 60, -- minutes
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'missed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view lessons"
  ON public.lessons FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can manage lessons"
  ON public.lessons FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('Admin', 'Kurucu', 'Müdür', 'Personel', 'Öğretmen')
    )
  );

-- =============================================
-- 8. LEADS (Yeni Talepler / CRM) TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name TEXT NOT NULL,
  parent_name TEXT,
  phone TEXT,
  email TEXT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'walk-in' CHECK (source IN ('walk-in', 'phone', 'web', 'referral', 'social-media', 'other')),
  status TEXT DEFAULT 'Yeni' CHECK (status IN ('Yeni', 'Arandı', 'Görüşüldü', 'Deneme Dersi', 'Kayıt Oldu', 'İptal')),
  lead_type TEXT DEFAULT 'Bireysel' CHECK (lead_type IN ('Bireysel', 'Grup')),
  notes TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view leads"
  ON public.leads FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can manage leads"
  ON public.leads FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('Admin', 'Kurucu', 'Müdür', 'Personel')
    )
  );

-- =============================================
-- 9. CONTRACTS (Sözleşmeler) TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  contract_number TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  monthly_fee NUMERIC(10,2) DEFAULT 0,
  total_fee NUMERIC(10,2) DEFAULT 0,
  payment_type TEXT DEFAULT 'monthly' CHECK (payment_type IN ('monthly', 'package', 'yearly')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin Kurucu Mudur can view contracts"
  ON public.contracts FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('Admin', 'Kurucu', 'Müdür')
    )
  );

CREATE POLICY "Admin Kurucu can manage contracts"
  ON public.contracts FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('Admin', 'Kurucu')
    )
  );

-- =============================================
-- 10. FINANCIAL_CATEGORIES (Gelir-Gider Kategorileri)
-- =============================================
CREATE TABLE IF NOT EXISTS public.financial_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  parent_category_id UUID REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance roles can view categories"
  ON public.financial_categories FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('Admin', 'Kurucu', 'Müdür')
    )
  );

CREATE POLICY "Admin Kurucu can manage categories"
  ON public.financial_categories FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('Admin', 'Kurucu')
    )
  );

-- =============================================
-- 11. FINANCIAL_RECORDS (Finansal Kayıtlar)
-- =============================================
CREATE TABLE IF NOT EXISTS public.financial_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category_id UUID REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  payment_method TEXT CHECK (payment_method IN ('cash', 'credit_card', 'bank_transfer', 'pos')),
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance roles can view records"
  ON public.financial_records FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('Admin', 'Kurucu', 'Müdür')
    )
  );

CREATE POLICY "Admin Kurucu can manage records"
  ON public.financial_records FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('Admin', 'Kurucu')
    )
  );

-- =============================================
-- 12. BANKS (Bankalar) TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  account_name TEXT,
  branch_name TEXT,
  account_number TEXT,
  iban TEXT,
  currency TEXT DEFAULT 'TRY',
  balance NUMERIC(12,2) DEFAULT 0,
  logo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance roles can view banks"
  ON public.banks FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('Admin', 'Kurucu', 'Müdür')
    )
  );

CREATE POLICY "Admin Kurucu can manage banks"
  ON public.banks FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('Admin', 'Kurucu')
    )
  );

-- =============================================
-- 13. BANK_TRANSACTIONS (Banka Hareketleri)
-- =============================================
CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID REFERENCES public.banks(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance roles can view transactions"
  ON public.bank_transactions FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('Admin', 'Kurucu', 'Müdür')
    )
  );

CREATE POLICY "Admin Kurucu can manage transactions"
  ON public.bank_transactions FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('Admin', 'Kurucu')
    )
  );

-- =============================================
-- 14. TODOS (Yapılacaklar) TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date DATE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view todos"
  ON public.todos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin Kurucu Mudur can manage todos"
  ON public.todos FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('Admin', 'Kurucu', 'Müdür')
    )
  );

-- =============================================
-- 15. ATTENDANCE (Yoklama) TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused')),
  notes TEXT,
  marked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view attendance"
  ON public.attendance FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can manage attendance"
  ON public.attendance FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('Admin', 'Kurucu', 'Müdür', 'Personel', 'Öğretmen')
    )
  );

-- =============================================
-- 16. UPDATED_AT TRIGGERS (Tüm tablolar için)
-- =============================================
-- handle_updated_at fonksiyonu zaten mevcut (migration: create_profiles_table)

CREATE TRIGGER on_branches_updated BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_teachers_updated BEFORE UPDATE ON public.teachers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_students_updated BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_lessons_updated BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_leads_updated BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_contracts_updated BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_financial_records_updated BEFORE UPDATE ON public.financial_records
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_banks_updated BEFORE UPDATE ON public.banks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_todos_updated BEFORE UPDATE ON public.todos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- 17. VARSAYILAN VERİLER
-- =============================================

-- Varsayılan Branşlar
INSERT INTO public.branches (name, color_code, icon_name) VALUES
  ('Piyano', '#6B21A8', 'Piano'),
  ('Gitar', '#4F46E5', 'Guitar'),
  ('Keman', '#3B82F6', 'Violin'),
  ('Bateri', '#06B6D4', 'Drum'),
  ('Şan / Vokal', '#14B8A6', 'Mic'),
  ('Bale', '#EC4899', 'Ballet'),
  ('Modern Dans', '#F97316', 'Dance'),
  ('Resim', '#22C55E', 'Palette'),
  ('Heykel', '#EAB308', 'Cube')
ON CONFLICT DO NOTHING;

-- Varsayılan Sınıflar
INSERT INTO public.classrooms (name, capacity) VALUES
  ('Studio 1', 1),
  ('Studio 2', 1),
  ('Studio 3', 1),
  ('Bale Salonu', 20),
  ('Dans Salonu', 15),
  ('Resim Atölyesi', 10),
  ('Toplantı Odası', 8)
ON CONFLICT DO NOTHING;

-- Varsayılan Bankalar
INSERT INTO public.banks (name, account_name, currency) VALUES
  ('Denizbank', 'PNR Sanat Akademisi', 'TRY'),
  ('Denizbank POS', 'PNR Sanat POS', 'TRY'),
  ('Vakıfbank', 'PNR Sanat Akademisi', 'TRY')
ON CONFLICT DO NOTHING;

-- Varsayılan Gelir Kategorileri
INSERT INTO public.financial_categories (name, type) VALUES
  ('Ders Ücreti', 'income'),
  ('Kayıt Ücreti', 'income'),
  ('Sınav Ücreti', 'income'),
  ('Kostüm Satışı', 'income'),
  ('Diğer Gelir', 'income')
ON CONFLICT DO NOTHING;

-- Varsayılan Gider Kategorileri
INSERT INTO public.financial_categories (name, type) VALUES
  ('Maaşlar', 'expense'),
  ('Kira', 'expense'),
  ('Elektrik', 'expense'),
  ('Su', 'expense'),
  ('Doğalgaz', 'expense'),
  ('İnternet', 'expense'),
  ('Malzeme', 'expense'),
  ('Bakım-Onarım', 'expense'),
  ('Vergi', 'expense'),
  ('SGK', 'expense'),
  ('Diğer Gider', 'expense')
ON CONFLICT DO NOTHING;

-- =============================================
-- ✅ KURULUM TAMAMLANDI!
-- =============================================
-- Oluşturulan tablolar:
--   1.  profiles          (MEVCUT - 3 kullanıcı)
--   2.  role_permissions   (MEVCUT - 50 izin)
--   3.  branches           (Branşlar)
--   4.  teachers           (Öğretmenler)
--   5.  classrooms         (Sınıflar)
--   6.  students           (Öğrenciler)
--   7.  lessons            (Dersler)
--   8.  leads              (Yeni Talepler / CRM)
--   9.  contracts          (Sözleşmeler)
--   10. financial_categories (Gelir-Gider Kategorileri)
--   11. financial_records   (Finansal Kayıtlar)
--   12. banks              (Bankalar)
--   13. bank_transactions  (Banka Hareketleri)
--   14. todos              (Yapılacaklar)
--   15. attendance         (Yoklama)
-- =============================================
