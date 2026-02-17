-- =============================================
-- 🛠️ MyPNR - Infinite Recursion Fix
-- Bu script profiles tablosundaki döngüsel yetki hatasını düzeltir.
-- =============================================

-- 1. Mevcut hatalı politikaları temizle
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "Admins can do everything on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- 2. Basit ve güvenli politikaları tanımla

-- Herkes profilleri görebilir (Döngü oluşturmaz)
CREATE POLICY "profiles_select_policy" 
ON public.profiles FOR SELECT 
USING ( true );

-- Kullanıcılar sadece kendi profillerini ekleyebilir
CREATE POLICY "profiles_insert_policy" 
ON public.profiles FOR INSERT 
WITH CHECK ( auth.uid() = id );

-- Kullanıcılar sadece kendi profillerini güncelleyebilir (Rol kontrolü yapmadan)
CREATE POLICY "profiles_update_own_policy" 
ON public.profiles FOR UPDATE 
USING ( auth.uid() = id )
WITH CHECK ( auth.uid() = id );

-- Admin yetkisi kontrolü için bir fonksiyon oluştur (Döngüyü kırmak için)
-- SECURITY DEFINER sayesinde RLS'e takılmadan kontrol yapar.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'Admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin her şeyi yapabilir (Fonksiyon üzerinden kontrol)
CREATE POLICY "profiles_admin_all_policy"
ON public.profiles FOR ALL
USING ( public.is_admin() );
