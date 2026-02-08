-- =====================================================
-- Admin Kullanıcısı Ayarlama: pnrsanat@gmail.com
-- =====================================================

-- ADIM 1: Önce kullanıcının auth.users tablosunda olup olmadığını kontrol edin
SELECT id, email, email_confirmed_at, created_at
FROM auth.users 
WHERE email = 'pnrsanat@gmail.com';

-- ADIM 2A: Eğer kullanıcı VARSA ve profiles tablosunda YOKSA
-- (Yukarıdaki sorgudan dönen ID'yi kullanın)
INSERT INTO profiles (id, email, full_name, role, status)
VALUES (
  'BURAYA_USER_ID_YAPIŞTIRIN',  -- Adım 1'den gelen ID
  'pnrsanat@gmail.com',
  'PNR Sanat Admin',
  'admin',
  'active'
);

-- ADIM 2B: Eğer kullanıcı profiles tablosunda VARSA (sadece rolü güncelleyin)
UPDATE profiles 
SET 
  role = 'admin',
  status = 'active',
  updated_at = NOW()
WHERE email = 'pnrsanat@gmail.com';

-- ADIM 3: Doğrulama - Admin kullanıcısını kontrol edin
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.status,
  p.created_at,
  u.email_confirmed_at
FROM profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE p.email = 'pnrsanat@gmail.com';

-- =====================================================
-- HIZLI ÇÖZÜM: Kullanıcı varsa güncelle, yoksa ekle
-- =====================================================

-- Bu sorgu otomatik olarak kullanıcıyı bulup admin yapar
-- ÖNCE auth.users'da kullanıcının ID'sini alın:
DO $$
DECLARE
  user_id UUID;
BEGIN
  -- Auth kullanıcısının ID'sini al
  SELECT id INTO user_id 
  FROM auth.users 
  WHERE email = 'pnrsanat@gmail.com';
  
  -- Eğer kullanıcı varsa
  IF user_id IS NOT NULL THEN
    -- Profiles'da var mı kontrol et
    IF EXISTS (SELECT 1 FROM profiles WHERE id = user_id) THEN
      -- Varsa güncelle
      UPDATE profiles 
      SET role = 'admin', status = 'active', updated_at = NOW()
      WHERE id = user_id;
      RAISE NOTICE 'Kullanıcı admin olarak güncellendi: %', user_id;
    ELSE
      -- Yoksa ekle
      INSERT INTO profiles (id, email, full_name, role, status)
      VALUES (user_id, 'pnrsanat@gmail.com', 'PNR Sanat Admin', 'admin', 'active');
      RAISE NOTICE 'Yeni admin profili oluşturuldu: %', user_id;
    END IF;
  ELSE
    RAISE NOTICE 'UYARI: pnrsanat@gmail.com auth.users tablosunda bulunamadı!';
    RAISE NOTICE 'Önce Supabase Dashboard > Authentication > Users bölümünden kullanıcı oluşturun.';
  END IF;
END $$;

-- =====================================================
-- SORUN GİDERME
-- =====================================================

-- Kullanıcı auth.users'da var mı?
SELECT 'AUTH USERS' as tablo, id, email, email_confirmed_at 
FROM auth.users 
WHERE email = 'pnrsanat@gmail.com'
UNION ALL
-- Kullanıcı profiles'da var mı?
SELECT 'PROFILES' as tablo, id, email, role::text as email_confirmed_at
FROM profiles 
WHERE email = 'pnrsanat@gmail.com';
