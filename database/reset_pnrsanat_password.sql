-- =====================================================
-- pnrsanat@gmail.com Kullanıcısını Yeniden Oluşturma
-- Şifre: pnrsanat
-- =====================================================

-- ADIM 1: Mevcut kullanıcıyı kontrol et
SELECT id, email, email_confirmed_at 
FROM auth.users 
WHERE email = 'pnrsanat@gmail.com';

-- ADIM 2: Profiles kaydını sil (önce bağımlılıkları temizle)
DELETE FROM profiles WHERE email = 'pnrsanat@gmail.com';

-- ADIM 3: Auth kullanıcısını sil
-- NOT: Bu işlem Supabase Dashboard'dan yapılmalıdır!
-- Authentication > Users > pnrsanat@gmail.com > Delete user

-- =====================================================
-- YENİ KULLANICI OLUŞTURMA TALİMATLARI
-- =====================================================

/*
Supabase Dashboard'da:

1. Authentication > Users > Add user
2. Formu doldurun:
   - Email: pnrsanat@gmail.com
   - Password: pnrsanat
   - Auto Confirm User: ✅ (İşaretleyin)
3. Create user tıklayın
4. User ID'yi kopyalayın
5. Aşağıdaki SQL'i çalıştırın (User ID'yi değiştirin):
*/

-- ADIM 4: Admin profili oluştur
INSERT INTO profiles (id, email, full_name, role, status)
VALUES (
  'BURAYA_YENİ_USER_ID_YAPIŞTIRIN',  -- Dashboard'dan kopyalanan ID
  'pnrsanat@gmail.com',
  'PNR Sanat Admin',
  'admin',
  'active'
);

-- =====================================================
-- OTOMATİK ÇÖZÜM (Kullanıcı zaten varsa)
-- =====================================================

-- Eğer kullanıcı zaten auth.users'da varsa, sadece profile ekle/güncelle
DO $$
DECLARE
  user_id UUID;
BEGIN
  SELECT id INTO user_id 
  FROM auth.users 
  WHERE email = 'pnrsanat@gmail.com';
  
  IF user_id IS NOT NULL THEN
    -- Profile var mı kontrol et
    IF EXISTS (SELECT 1 FROM profiles WHERE id = user_id) THEN
      UPDATE profiles 
      SET role = 'admin', status = 'active', updated_at = NOW()
      WHERE id = user_id;
      RAISE NOTICE 'Admin profili güncellendi: %', user_id;
    ELSE
      INSERT INTO profiles (id, email, full_name, role, status)
      VALUES (user_id, 'pnrsanat@gmail.com', 'PNR Sanat Admin', 'admin', 'active');
      RAISE NOTICE 'Admin profili oluşturuldu: %', user_id;
    END IF;
  ELSE
    RAISE NOTICE 'Kullanıcı bulunamadı. Dashboard''dan oluşturun.';
  END IF;
END $$;

-- =====================================================
-- DOĞRULAMA
-- =====================================================

-- Kullanıcı ve profil kontrolü
SELECT 
  'AUTH' as kaynak,
  u.id,
  u.email,
  u.email_confirmed_at,
  NULL as role
FROM auth.users u
WHERE u.email = 'pnrsanat@gmail.com'

UNION ALL

SELECT 
  'PROFILE' as kaynak,
  p.id,
  p.email,
  p.created_at as email_confirmed_at,
  p.role
FROM profiles p
WHERE p.email = 'pnrsanat@gmail.com';

-- =====================================================
-- GÜVENLİK UYARISI
-- =====================================================

/*
⚠️ ÖNEMLİ GÜVENLİK UYARISI ⚠️

Şifre: "pnrsanat" çok basit ve güvensizdir!

Üretim ortamında MUTLAKA güçlü bir şifre kullanın:
- En az 12 karakter
- Büyük ve küçük harfler
- Rakamlar
- Özel karakterler (!@#$%^&*)

Örnek güçlü şifre: PnrSanat2026!@#

Test/Geliştirme için basit şifre kullanabilirsiniz,
ancak canlıya almadan önce DEĞİŞTİRİN!
*/
