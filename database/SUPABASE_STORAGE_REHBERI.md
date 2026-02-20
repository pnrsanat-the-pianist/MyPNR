# Supabase Storage Kurulum Rehberi (Öğretmen Dosyaları)

Öğretmen profil fotoğrafları ve özlük dosyalarının Supabase üzerinde saklanabilmesi için aşağıdaki adımları takip edin.

## 1. Bucket Oluşturma

1. Supabase Dashboard'a gidin.
2. Sol menüden **Storage** sekmesine tıklayın.
3. **New Bucket** butonuna tıklayın.
4. Bucket adını `teacher-files` olarak belirleyin.
5. **Public bucket** seçeneğini işaretleyin (Profil fotoğraflarının doğrudan görüntülenebilmesi için).
6. **Save** butonuna tıklayın.

## 2. RLS Politikaları (Storage Policies)

Dosyaların yüklenebilmesi ve okunabilmesi için politikalar eklemeniz gerekir:

1. `teacher-files` bucket'ına girin.
2. Üstten **Policies** sekmesine tıklayın.
3. **New Policy** butonuna tıklayın.

### A. Herkese Okuma İzni (SELECT)
- **Policy name**: `Allow public access to teacher files`
- **Allowed operations**: `SELECT`
- **Target roles**: `public`
- **Definition**: `(bucket_id = 'teacher-files'::text)`

### B. Kayıtlı Kullanıcılara Yükleme İzni (INSERT)
- **Policy name**: `Allow authenticated uploads`
- **Allowed operations**: `INSERT`
- **Target roles**: `authenticated`
- **Definition**: `(bucket_id = 'teacher-files'::text)`

### C. Kayıtlı Kullanıcılara Güncelleme/Silme İzni (UPDATE/DELETE)
- **Policy name**: `Allow authenticated management`
- **Allowed operations**: `UPDATE`, `DELETE`
- **Target roles**: `authenticated`
- **Definition**: `(bucket_id = 'teacher-files'::text)`

---

## 3. Uygulama Entegrasyonu

Uygulama artık dosyaları `teacher-files` bucket'ına şu klasör yapılarıyla yükleyecektir:
- `photos/`: Profil fotoğrafları
- `documents/`: Özlük dosyaları

Bu kurulum tamamlandıktan sonra öğretmen ekleme formundaki yüklemeler otomatik olarak Supabase üzerinde yedeklenecektir.

---

## veya SQL ile Otomatik Kurulum

Supabase Dashboard üzerindeki **SQL Editor** kısmına giderek `database/STORAGE_SETUP.sql` dosyasındaki kodları yapıştırıp çalıştırarak yukarıdaki tüm adımları tek seferde tamamlayabilirsiniz.
