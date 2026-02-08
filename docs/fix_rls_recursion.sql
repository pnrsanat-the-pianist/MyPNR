-- =====================================================
-- FIX: RLS Infinite Recursion
-- =====================================================
-- Bu script, profiles tablosundaki admin kontrolünün 
-- sonsuz döngüye girmesini engeller.
-- =====================================================

-- 1. Mevcut sorunlu politikaları temizle
DROP POLICY IF EXISTS "Admins can do everything on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage students" ON public.students;
DROP POLICY IF EXISTS "Admins can manage teachers" ON public.teachers;
DROP POLICY IF EXISTS "Financial view policy" ON public.cash_book;
DROP POLICY IF EXISTS "Financial manage policy" ON public.cash_book;

-- 2. Rol kontrolünü RLS dışı (Security Definer) yapan bir fonksiyon oluştur
-- Bu fonksiyon, RLS politikalarını tetiklemeden rol kontrolü yapar.
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND role IN ('Admin', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Politikaları güvenli fonksiyon ile yeniden tanımla

-- PROFILES: Herkes kendi profilini görebilir/güncelleyebilir, admin her şeyi yapabilir
CREATE POLICY "Profiles access policy" ON public.profiles
FOR ALL USING (
    id = auth.uid() OR check_is_admin()
);

-- STUDENTS: Sadece admin yönetebilir (veya herkes görebilir - tercihe göre)
CREATE POLICY "Students manage policy" ON public.students
FOR ALL USING (
    check_is_admin()
);

-- TEACHERS: Sadece admin yönetebilir
CREATE POLICY "Teachers manage policy" ON public.teachers
FOR ALL USING (
    check_is_admin()
);

-- FINANCE: Örnek olarak cash_book için
CREATE POLICY "Cash book access policy" ON public.cash_book
FOR ALL USING (
    check_is_admin()
);

-- DİĞER TABLOLAR İÇİN DE BENZER ŞEKİLDE UYGULANABİLİR
RAISE NOTICE '✅ RLS Infinite Recursion hatası giderildi.';
