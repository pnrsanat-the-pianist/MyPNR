-- =====================================================
-- pnrsanat@gmail.com Kullanıcısını Admin Yap
-- =====================================================
-- Bu SQL'i Supabase Dashboard > SQL Editor'de çalıştırın
-- =====================================================

-- Otomatik admin ayarlama
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
      RAISE NOTICE '✅ Kullanıcı admin olarak güncellendi: %', user_id;
    ELSE
      -- Yoksa ekle
      INSERT INTO profiles (id, email, full_name, role, status)
      VALUES (user_id, 'pnrsanat@gmail.com', 'PNR Sanat Admin', 'admin', 'active');
      RAISE NOTICE '✅ Yeni admin profili oluşturuldu: %', user_id;
    END IF;
  ELSE
    RAISE EXCEPTION '❌ HATA: pnrsanat@gmail.com auth.users tablosunda bulunamadı! Önce Supabase Dashboard > Authentication > Users bölümünden kullanıcı oluşturun.';
  END IF;
END $$;

-- Doğrulama: Admin kullanıcısını kontrol et
SELECT 
  '✅ BAŞARILI - Admin Kullanıcı Bilgileri:' as durum,
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
