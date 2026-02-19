-- 1. Mevcut kısıtlamayı kaldır
ALTER TABLE public.new_leads DROP CONSTRAINT IF EXISTS new_leads_status_check;

-- 2. Yeni kısıtlamayı ekle (Görüşüldü dahil)
-- İsterseniz kısıtlamayı tamamen kaldırıp uygulamanıza güvenebilirsiniz, ancak veritabanı bütünlüğü için bu daha iyidir.
ALTER TABLE public.new_leads ADD CONSTRAINT new_leads_status_check 
CHECK (status IN ('Takip', 'Görüşüldü', 'Deneme', 'Kayıt', 'İptal'));

-- 3. İşlemin başarılı olduğunu doğrula
SELECT 'Kısıtlama güncellendi!' as sonuc;
