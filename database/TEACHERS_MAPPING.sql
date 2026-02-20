-- 1. Öğretmenler tablosuna fotoğraf ve dosya kolonlarını ekler (Eğer yoksa)
ALTER TABLE teachers 
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS files JSONB DEFAULT '[]'::jsonb;

-- 2. Örnek: Manuel eşleme yapmak isterseniz aşağıdaki şablonu kullanabilirsiniz
-- Not: 'dosya-adi.jpg' kısmını storage'a yüklediğiniz dosya adıyla, 
-- 'Öğretmen Adı' kısmını da tablonuzdaki isimle değiştirin.

/*
UPDATE teachers 
SET photo_url = (
    SELECT 'https://zzovahjrrjmpoztruezp.supabase.co/storage/v1/object/public/teacher-files/photos/' || 'dosya-adi.jpg'
)
WHERE name = 'Öğretmen Adı';
*/

-- 3. Toplu güncelleme yardımı:
-- Eğer resim dosyalarınız öğretmen isimleriyle birebir aynıysa (örn: "Ali Veli.jpg") 
-- ve storage'da ise, otomatik eşleme mantığı:
/*
UPDATE teachers
SET photo_url = 'https://zzovahjrrjmpoztruezp.supabase.co/storage/v1/object/public/teacher-files/photos/' || name || '.jpg'
WHERE photo_url IS NULL;
*/
