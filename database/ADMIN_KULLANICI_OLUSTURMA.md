# Admin Kullanıcısı Oluşturma Rehberi

## Yöntem 1: Supabase Dashboard ile (Önerilen)

### Adım 1: Kullanıcı Oluşturma

1. **Supabase Dashboard**'a gidin: https://supabase.com/dashboard
2. Projenizi seçin: **zzovahjrrjmpoztruezp**
3. Sol menüden **Authentication** > **Users** sekmesine tıklayın
4. Sağ üstteki **Add user** butonuna tıklayın
5. **Create a new user** formunu doldurun:
   - **Email**: admin@pnrsanat.com (veya istediğiniz email)
   - **Password**: Güçlü bir şifre belirleyin (en az 8 karakter)
   - **Auto Confirm User**: ✅ İşaretleyin (email doğrulama gerektirmez)
6. **Create user** butonuna tıklayın

### Adım 2: Admin Rolü Atama

1. Kullanıcı oluşturulduktan sonra, **User ID**'yi kopyalayın (UUID formatında)
2. Sol menüden **SQL Editor** sekmesine tıklayın
3. **New query** butonuna tıklayın
4. Aşağıdaki SQL kodunu yapıştırın:

```sql
-- Kullanıcının ID'sini buraya yapıştırın
INSERT INTO profiles (id, email, full_name, role, status)
VALUES (
  'KULLANICI_ID_BURAYA_YAPIŞTIRIN',  -- Örnek: '123e4567-e89b-12d3-a456-426614174000'
  'admin@pnrsanat.com',               -- Email adresi
  'Admin Kullanıcı',                  -- Tam ad
  'admin',                            -- Rol (admin, teacher, user, accountant)
  'active'                            -- Durum
);
```

5. **KULLANICI_ID_BURAYA_YAPIŞTIRIN** yerine kopyaladığınız User ID'yi yapıştırın
6. Email ve tam adı düzenleyin
7. **Run** butonuna tıklayın

### Adım 3: Doğrulama

1. SQL Editor'de şu sorguyu çalıştırın:

```sql
SELECT id, email, full_name, role, status 
FROM profiles 
WHERE role = 'admin';
```

2. Admin kullanıcınızı görmelisiniz ✅

---

## Yöntem 2: Kayıt Sayfası ile

### Adım 1: Uygulamada Kayıt Olun

1. Uygulamanızı çalıştırın
2. Kayıt sayfasına gidin
3. Email ve şifre ile kayıt olun

### Adım 2: Supabase'de Admin Rolü Verin

1. **Supabase Dashboard** > **SQL Editor**
2. Şu sorguyu çalıştırın:

```sql
-- Önce kullanıcıyı bulun
SELECT id, email FROM auth.users WHERE email = 'sizin@email.com';

-- Sonra admin rolü verin (ID'yi yukarıdaki sonuçtan alın)
UPDATE profiles 
SET role = 'admin' 
WHERE id = 'KULLANICI_ID_BURAYA';
```

---

## Yöntem 3: SQL ile Direkt Oluşturma (İleri Seviye)

⚠️ **Dikkat**: Bu yöntem Supabase Auth sistemini bypass eder ve önerilmez.

```sql
-- 1. Auth kullanıcısı oluştur (Supabase internal)
-- Bu işlem Supabase Dashboard'dan yapılmalıdır

-- 2. Profile kaydı ekle
INSERT INTO profiles (id, email, full_name, role, status)
SELECT 
  id,
  email,
  'Admin Kullanıcı',
  'admin',
  'active'
FROM auth.users
WHERE email = 'admin@pnrsanat.com';
```

---

## Örnek: Tam Admin Kullanıcısı Oluşturma

### 1. Dashboard'dan Kullanıcı Oluştur

- Email: `admin@pnrsanat.com`
- Password: `Admin123!@#`
- Auto Confirm: ✅

### 2. User ID'yi Kopyala

Örnek: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

### 3. SQL ile Profile Ekle

```sql
INSERT INTO profiles (id, email, full_name, role, status)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'admin@pnrsanat.com',
  'Kaan Çalış',
  'admin',
  'active'
);
```

### 4. Giriş Yapın

- Uygulamanızı açın
- Email: `admin@pnrsanat.com`
- Password: `Admin123!@#`
- Giriş yapın ✅

---

## Birden Fazla Admin Oluşturma

Aynı adımları tekrarlayarak birden fazla admin oluşturabilirsiniz:

```sql
-- İkinci admin
INSERT INTO profiles (id, email, full_name, role, status)
VALUES (
  'IKINCI_KULLANICI_ID',
  'admin2@pnrsanat.com',
  'İkinci Admin',
  'admin',
  'active'
);
```

---

## Mevcut Kullanıcıya Admin Yetkisi Verme

Eğer zaten kayıtlı bir kullanıcınız varsa:

```sql
-- Email ile kullanıcıyı bulun
SELECT id, email, role FROM profiles WHERE email = 'kullanici@email.com';

-- Admin rolü verin
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'kullanici@email.com';
```

---

## Rol Türleri

Sistemde 4 farklı rol vardır:

1. **admin** - Tüm yetkilere sahip
2. **teacher** - Öğretmen yetkileri (yoklama, öğrenci görüntüleme)
3. **accountant** - Muhasebe yetkileri (finans modülü)
4. **user** - Temel kullanıcı (CRM, leads)

---

## Sorun Giderme

### Hata: "duplicate key value violates unique constraint"

**Sebep**: Bu email ile zaten bir profil var.

**Çözüm**:
```sql
-- Mevcut profili güncelleyin
UPDATE profiles 
SET role = 'admin', status = 'active'
WHERE email = 'admin@pnrsanat.com';
```

### Hata: "insert or update on table profiles violates foreign key constraint"

**Sebep**: User ID auth.users tablosunda yok.

**Çözüm**: Önce Supabase Dashboard'dan kullanıcıyı oluşturun.

### Giriş Yapamıyorum

**Kontrol Listesi**:
1. ✅ Kullanıcı auth.users tablosunda var mı?
2. ✅ Kullanıcı profiles tablosunda var mı?
3. ✅ Email doğrulandı mı? (Auto Confirm işaretli mi?)
4. ✅ Şifre doğru mu?
5. ✅ Status 'active' mi?

**Kontrol SQL**:
```sql
-- Auth kullanıcısını kontrol et
SELECT id, email, email_confirmed_at 
FROM auth.users 
WHERE email = 'admin@pnrsanat.com';

-- Profile'ı kontrol et
SELECT id, email, role, status 
FROM profiles 
WHERE email = 'admin@pnrsanat.com';
```

---

## Güvenlik Önerileri

1. 🔒 **Güçlü Şifre Kullanın**: En az 12 karakter, büyük/küçük harf, rakam ve özel karakter
2. 🔒 **Gerçek Email Kullanın**: Şifre sıfırlama için gerekli
3. 🔒 **Admin Sayısını Sınırlayın**: Sadece gerekli kişilere admin yetkisi verin
4. 🔒 **Düzenli Şifre Değişimi**: Her 3 ayda bir şifre değiştirin
5. 🔒 **2FA Aktif Edin**: Supabase Dashboard'dan 2FA'yı aktif edin (opsiyonel)

---

## Hızlı Başlangıç Komutları

### Yeni Admin Oluştur (Tüm Adımlar)

1. Dashboard > Authentication > Users > Add user
2. Email: `admin@pnrsanat.com`, Password: `YourPassword123!`, Auto Confirm: ✅
3. User ID'yi kopyala
4. SQL Editor'de:

```sql
INSERT INTO profiles (id, email, full_name, role, status)
VALUES (
  'KOPYALADIGINIZ_USER_ID',
  'admin@pnrsanat.com',
  'Admin Kullanıcı',
  'admin',
  'active'
);
```

5. Uygulamada giriş yapın ✅

---

## İlk Giriş Sonrası

Admin kullanıcısı ile giriş yaptıktan sonra:

1. ✅ **Sistem Ayarları**'nı kontrol edin
2. ✅ **Ana Branşlar**'ı oluşturun (Enstrüman, Bale/Dans)
3. ✅ **Alt Branşlar**'ı ekleyin (Piyano, Gitar, vb.)
4. ✅ **Finansal Kategoriler**'i kontrol edin
5. ✅ **Diğer kullanıcıları** ekleyin (öğretmen, muhasebeci)

Başarılar! 🎉
