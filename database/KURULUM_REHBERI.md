# Supabase Veritabanı Kurulum Rehberi

## Adım 1: Supabase Dashboard'a Giriş

1. Tarayıcınızda şu adresi açın: https://supabase.com/dashboard
2. Giriş yapın
3. **zzovahjrrjmpoztruezp** projesini seçin

## Adım 2: SQL Editor'ü Açın

1. Sol menüden **SQL Editor** sekmesine tıklayın
2. **New query** butonuna tıklayın

## Adım 3: SQL Dosyasını Kopyalayın

1. Bu klasördeki `complete_schema.sql` dosyasını açın
2. Tüm içeriği kopyalayın (Ctrl+A, Ctrl+C)
3. Supabase SQL Editor'e yapıştırın (Ctrl+V)

## Adım 4: SQL'i Çalıştırın

1. Sağ üst köşedeki **Run** butonuna tıklayın
2. İşlemin tamamlanmasını bekleyin (1-2 dakika sürebilir)
3. Başarılı mesajı görmelisiniz

## Adım 5: Doğrulama

1. Sol menüden **Table Editor** sekmesine tıklayın
2. Şu tabloların oluşturulduğunu kontrol edin:
   - ✅ profiles
   - ✅ students
   - ✅ teachers
   - ✅ main_branches
   - ✅ sub_branches
   - ✅ financial_categories
   - ✅ cash_book
   - ✅ denizbank_book
   - ✅ vakifbank_book
   - ✅ contract_settings
   - ✅ leads
   - ✅ todos
   - ve diğerleri...

## Oluşturulan Tablolar

### 1. Kullanıcı Yönetimi
- `profiles` - Kullanıcı profilleri
- `role_permissions` - Rol bazlı izinler

### 2. Eğitim Yapısı
- `main_branches` - Ana branşlar (Enstrüman, Bale/Dans)
- `sub_branches` - Alt branşlar (Piyano, Gitar, vb.)
- `teachers` - Öğretmenler
- `sub_branch_teachers` - Öğretmen-Branş ilişkisi
- `students` - Öğrenciler

### 3. Planlama & Yoklama
- `instrument_periods` - 10 haftalık dönemler
- `instrument_lessons` - Enstrüman ders programı
- `instrument_attendance` - Enstrüman yoklama
- `dance_classes` - Dans sınıfları
- `dance_enrollments` - Dans kayıtları
- `dance_attendance` - Dans yoklama

### 4. CRM & Potansiyel Öğrenciler
- `leads` - Potansiyel öğrenciler
- `crm_interactions` - CRM etkileşimleri

### 5. Finans Yönetimi
- `financial_categories` - Gelir/Gider kategorileri
- `cash_book` - Kasa defteri
- `denizbank_book` - Denizbank hesap defteri
- `denizbank_pos_book` - Denizbank POS defteri
- `vakifbank_book` - Vakıfbank hesap defteri

### 6. Sözleşmeler
- `contract_settings` - Sözleşme şablonları

### 7. Görev Yönetimi
- `todos` - Yapılacaklar listesi

## Önemli Notlar

- ✅ Tüm tablolarda **Row Level Security (RLS)** aktif
- ✅ Admin ve öğretmen rolleri için özel izinler tanımlanmış
- ✅ Finansal tablolara sadece admin ve muhasebeci erişebilir
- ✅ Performans için indexler oluşturulmuş
- ✅ Varsayılan veriler (kategoriler, branşlar, sözleşme şablonları) eklenmiş

## Sorun Giderme

### Hata: "relation already exists"
- Bu normal, tablo zaten varsa atlanır (IF NOT EXISTS kullanılıyor)

### Hata: "permission denied"
- Supabase projesinde admin yetkisine sahip olduğunuzdan emin olun

### Hata: "syntax error"
- SQL'in tamamını kopyaladığınızdan emin olun
- Özel karakterlerin bozulmadığını kontrol edin

## Sonraki Adımlar

1. ✅ Veritabanı şeması oluşturuldu
2. 🔄 Uygulamayı test edin
3. 📝 İlk admin kullanıcısını oluşturun (Supabase Auth'dan)
4. 🎯 Profil tablosuna admin rolü atayın

## İlk Admin Kullanıcısı Oluşturma

1. Supabase Dashboard > Authentication > Users
2. "Add user" butonuna tıklayın
3. Email ve şifre girin
4. Kullanıcı oluşturulduktan sonra:
   - SQL Editor'e gidin
   - Şu komutu çalıştırın:

```sql
-- Kullanıcının ID'sini bulun
SELECT id, email FROM auth.users;

-- Admin rolü atayın (ID'yi yukarıdaki sonuçtan alın)
INSERT INTO profiles (id, email, full_name, role, status)
VALUES (
  'KULLANICI_ID_BURAYA',
  'email@example.com',
  'Admin Kullanıcı',
  'admin',
  'active'
);
```

## Yardım

Herhangi bir sorun yaşarsanız:
1. Supabase Dashboard > Logs bölümünden hata loglarını kontrol edin
2. SQL Editor'de küçük parçalar halinde çalıştırmayı deneyin
3. Bana hata mesajını gönderin
