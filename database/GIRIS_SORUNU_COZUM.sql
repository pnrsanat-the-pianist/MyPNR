-- =====================================================
-- GİRİŞ SORUNU ÇÖZÜMÜ - Tanı ve Düzeltme
-- =====================================================
-- pnrsanat@gmail.com için
-- =====================================================

-- ADIM 1: Kullanıcı Durumunu Kontrol Et
SELECT 
  '=== AUTH USERS KONTROLÜ ===' as kontrol,
  id,
  email,
  email_confirmed_at,
  created_at,
  CASE 
    WHEN email_confirmed_at IS NULL THEN '❌ Email doğrulanmamış'
    ELSE '✅ Email doğrulanmış'
  END as email_durumu
FROM auth.users 
WHERE email = 'pnrsanat@gmail.com';

-- ADIM 2: Profil Durumunu Kontrol Et
SELECT 
  '=== PROFILES KONTROLÜ ===' as kontrol,
  id,
  email,
  full_name,
  role,
  status,
  created_at,
  CASE 
    WHEN role = 'admin' THEN '✅ Admin rolü var'
    ELSE '❌ Admin rolü YOK - Rol: ' || role
  END as rol_durumu,
  CASE 
    WHEN status = 'active' THEN '✅ Aktif'
    ELSE '❌ Pasif/İnaktif'
  END as durum
FROM profiles 
WHERE email = 'pnrsanat@gmail.com';

-- ADIM 3: Sorun Tespiti
SELECT 
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'pnrsanat@gmail.com') 
      THEN '❌ SORUN: Kullanıcı auth.users tablosunda YOK - Dashboard''dan oluşturun'
    WHEN EXISTS (SELECT 1 FROM auth.users WHERE email = 'pnrsanat@gmail.com' AND email_confirmed_at IS NULL)
      THEN '❌ SORUN: Email doğrulanmamış - Dashboard''dan Auto Confirm yapın'
    WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE email = 'pnrsanat@gmail.com')
      THEN '❌ SORUN: Profil tablosunda kayıt YOK - Aşağıdaki SQL''i çalıştırın'
    WHEN EXISTS (SELECT 1 FROM profiles WHERE email = 'pnrsanat@gmail.com' AND role != 'admin')
      THEN '❌ SORUN: Kullanıcı admin değil - Aşağıdaki SQL''i çalıştırın'
    WHEN EXISTS (SELECT 1 FROM profiles WHERE email = 'pnrsanat@gmail.com' AND status != 'active')
      THEN '❌ SORUN: Kullanıcı pasif - Aşağıdaki SQL''i çalıştırın'
    ELSE '✅ HER ŞEY TAMAM - Şifre yanlış olabilir'
  END as tani;

-- =====================================================
-- ÇÖZÜM 1: Email Doğrulama (Manuel)
-- =====================================================
-- NOT: Bu işlem Supabase Dashboard'dan yapılmalıdır
-- Authentication > Users > pnrsanat@gmail.com > ... > Confirm Email

-- =====================================================
-- ÇÖZÜM 2: Profil Oluştur/Güncelle
-- =====================================================

-- Otomatik düzeltme
DO $$
DECLARE
  user_id UUID;
  user_confirmed BOOLEAN;
BEGIN
  -- Kullanıcı bilgilerini al
  SELECT id, email_confirmed_at IS NOT NULL INTO user_id, user_confirmed
  FROM auth.users 
  WHERE email = 'pnrsanat@gmail.com';
  
  IF user_id IS NULL THEN
    RAISE EXCEPTION '❌ Kullanıcı bulunamadı! Dashboard > Authentication > Users > Add user ile oluşturun.';
  END IF;
  
  IF NOT user_confirmed THEN
    RAISE NOTICE '⚠️ UYARI: Email doğrulanmamış! Dashboard''dan Confirm Email yapın.';
  END IF;
  
  -- Profil var mı kontrol et
  IF EXISTS (SELECT 1 FROM profiles WHERE id = user_id) THEN
    -- Varsa güncelle
    UPDATE profiles 
    SET 
      role = 'admin', 
      status = 'active', 
      updated_at = NOW()
    WHERE id = user_id;
    RAISE NOTICE '✅ Profil admin olarak güncellendi';
  ELSE
    -- Yoksa ekle
    INSERT INTO profiles (id, email, full_name, role, status)
    VALUES (user_id, 'pnrsanat@gmail.com', 'PNR Sanat Admin', 'admin', 'active');
    RAISE NOTICE '✅ Admin profili oluşturuldu';
  END IF;
END $$;

-- =====================================================
-- ÇÖZÜM 3: Şifre Sıfırlama
-- =====================================================
-- Eğer şifre hatası varsa, Dashboard'dan şifre sıfırlayın:
-- Authentication > Users > pnrsanat@gmail.com > ... > Reset Password

-- =====================================================
-- DOĞRULAMA: Son Kontrol
-- =====================================================

SELECT 
  '✅ GİRİŞ BİLGİLERİ' as baslik,
  u.email as email,
  CASE 
    WHEN u.email_confirmed_at IS NOT NULL THEN '✅ Doğrulanmış'
    ELSE '❌ Doğrulanmamış'
  END as email_durumu,
  p.role as rol,
  p.status as durum,
  CASE 
    WHEN p.role = 'admin' AND p.status = 'active' AND u.email_confirmed_at IS NOT NULL 
      THEN '✅ GİRİŞ YAPABİLİR'
    ELSE '❌ GİRİŞ YAPILAMAZ'
  END as giris_durumu
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email = 'pnrsanat@gmail.com';

-- =====================================================
-- GİRİŞ BİLGİLERİ
-- =====================================================
/*
Email: pnrsanat@gmail.com
Şifre: pnrsanat (veya Dashboard'dan belirlediğiniz şifre)
URL: http://localhost:5173/

SORUN DEVAM EDİYORSA:
1. Tarayıcı konsolunu açın (F12)
2. Console sekmesine bakın
3. Hata mesajını kontrol edin
4. Network sekmesinde auth isteklerini kontrol edin
*/
