-- 1. teacher-files adında bir storage bucket oluşturur (veya varsa atlar)
INSERT INTO storage.buckets (id, name, public)
VALUES ('teacher-files', 'teacher-files', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Herkese dosyaları görüntüleme izni verir (Profil fotoğrafları için gerekli)
CREATE POLICY "Allow public access to teacher files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'teacher-files');

-- 3. Sadece giriş yapmış (authenticated) kullanıcıların dosya yüklemesine izin verir
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'teacher-files');

-- 4. Sadece giriş yapmış (authenticated) kullanıcıların dosya güncelleme ve silme izni verir
CREATE POLICY "Allow authenticated management"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'teacher-files')
WITH CHECK (bucket_id = 'teacher-files');
