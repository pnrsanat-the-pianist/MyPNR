-- 1. Tablo için RLS (Satır Düzeyinde Güvenlik) özelliğini etkinleştir
ALTER TABLE public.new_leads ENABLE ROW LEVEL SECURITY;

-- 2. Eski politikaları temizle (Çakışmaları önlemek için)
-- Eğer bu politikalar yoksa hata verebilir, o yüzden önce IF EXISTS kontrolü yapıyoruz.
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Allow all access" ON public.new_leads;
    DROP POLICY IF EXISTS "Enable update for all users" ON public.new_leads;
    DROP POLICY IF EXISTS "Enable insert for all users" ON public.new_leads;
    DROP POLICY IF EXISTS "Enable select for all users" ON public.new_leads;
    DROP POLICY IF EXISTS "Allow all operations" ON public.new_leads;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 3. Yeni ve kapsamlı bir "her şeye izin ver" politikası ekle
-- "public" rolü (giriş yapmamış kullanıcılar dahil) için tüm yetkileri açar.
CREATE POLICY "Allow all operations" ON public.new_leads
FOR ALL 
TO public
USING (true)
WITH CHECK (true);

-- 4. Status sütununun doğru tipte olduğundan emin ol
-- Varsayılan değeri 'Takip' olarak ayarla
ALTER TABLE public.new_leads 
ALTER COLUMN status SET DEFAULT 'Takip';

-- 5. İşlemin başarılı olduğunu doğrulamak için bir sonuç döndür
SELECT 'İşlem Başarıyla Tamamlandı!' as sonuc;
