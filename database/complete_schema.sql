-- =====================================================
-- PNR Sanat Akademisi - Complete Database Schema
-- Created: 2026-02-08
-- Description: Full database schema for student management system
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. AUTHENTICATION & USER MANAGEMENT
-- =====================================================

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'teacher', 'user', 'accountant')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'user', 'accountant')),
    module TEXT NOT NULL,
    can_view BOOLEAN DEFAULT FALSE,
    can_create BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role, module)
);

-- =====================================================
-- 2. EDUCATIONAL STRUCTURE
-- =====================================================

-- Main branches (e.g., Enstrüman, Bale/Dans)
CREATE TABLE IF NOT EXISTS main_branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sub branches (e.g., Piyano, Gitar, Bale)
CREATE TABLE IF NOT EXISTS sub_branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    main_branch_id UUID REFERENCES main_branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teachers table
CREATE TABLE IF NOT EXISTS teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    tc_no TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    hourly_rate DECIMAL(10, 2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teacher-SubBranch relationship (many-to-many)
CREATE TABLE IF NOT EXISTS sub_branch_teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sub_branch_id UUID REFERENCES sub_branches(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sub_branch_id, teacher_id)
);

-- Students table
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    tc_no TEXT,
    dob DATE,
    main_branch TEXT,
    sub_branch TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated', 'dropped')),
    start_date DATE,
    end_date DATE,
    parent1_name TEXT,
    parent1_tc TEXT,
    parent1_phone TEXT,
    parent1_email TEXT,
    parent2_name TEXT,
    parent2_tc TEXT,
    parent2_phone TEXT,
    parent2_email TEXT,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. SCHEDULING & ATTENDANCE
-- =====================================================

-- Instrument periods (10-week courses)
CREATE TABLE IF NOT EXISTS instrument_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Instrument lessons schedule
CREATE TABLE IF NOT EXISTS instrument_lessons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    period_id UUID REFERENCES instrument_periods(id) ON DELETE CASCADE,
    sub_branch TEXT,
    day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 7),
    time_slot TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Instrument attendance
CREATE TABLE IF NOT EXISTS instrument_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lesson_id UUID REFERENCES instrument_lessons(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    period_id UUID REFERENCES instrument_periods(id) ON DELETE CASCADE,
    lesson_date DATE NOT NULL,
    week_number INTEGER,
    status TEXT DEFAULT 'present' CHECK (status IN ('present', 'absent', 'excused', 'makeup')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dance classes
CREATE TABLE IF NOT EXISTS dance_classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    sub_branch TEXT,
    day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 7),
    time_slot TEXT,
    max_students INTEGER,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dance class enrollments
CREATE TABLE IF NOT EXISTS dance_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID REFERENCES dance_classes(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    enrollment_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(class_id, student_id)
);

-- Dance attendance
CREATE TABLE IF NOT EXISTS dance_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID REFERENCES dance_classes(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status TEXT DEFAULT 'present' CHECK (status IN ('present', 'absent', 'excused')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. CRM & LEADS
-- =====================================================

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_name TEXT NOT NULL,
    parent_name TEXT,
    phone TEXT,
    email TEXT,
    branch_interest TEXT,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'trial', 'enrolled', 'lost')),
    source TEXT,
    notes TEXT,
    follow_up_date DATE,
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CRM interactions
CREATE TABLE IF NOT EXISTS crm_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    interaction_type TEXT CHECK (interaction_type IN ('call', 'email', 'meeting', 'note')),
    description TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. FINANCIAL MANAGEMENT
-- =====================================================

-- Financial categories
CREATE TABLE IF NOT EXISTS financial_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    type TEXT CHECK (type IN ('income', 'expense')),
    description TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cash book
CREATE TABLE IF NOT EXISTS cash_book (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    description TEXT,
    category_id UUID REFERENCES financial_categories(id) ON DELETE SET NULL,
    category_name TEXT,
    type TEXT CHECK (type IN ('income', 'expense')),
    amount DECIMAL(10, 2) NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Denizbank book
CREATE TABLE IF NOT EXISTS denizbank_book (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    description TEXT,
    category_id UUID REFERENCES financial_categories(id) ON DELETE SET NULL,
    category_name TEXT,
    type TEXT CHECK (type IN ('income', 'expense')),
    amount DECIMAL(10, 2) NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Denizbank POS book
CREATE TABLE IF NOT EXISTS denizbank_pos_book (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    description TEXT,
    category_id UUID REFERENCES financial_categories(id) ON DELETE SET NULL,
    category_name TEXT,
    type TEXT CHECK (type IN ('income', 'expense')),
    amount DECIMAL(10, 2) NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vakifbank book
CREATE TABLE IF NOT EXISTS vakifbank_book (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    description TEXT,
    category_id UUID REFERENCES financial_categories(id) ON DELETE SET NULL,
    category_name TEXT,
    type TEXT CHECK (type IN ('income', 'expense')),
    amount DECIMAL(10, 2) NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. CONTRACTS & DOCUMENTS
-- =====================================================

-- Contract settings
CREATE TABLE IF NOT EXISTS contract_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    general_rules TEXT,
    holiday_dates TEXT,
    payment_policy TEXT,
    branch_rules_music TEXT,
    branch_rules_dance TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 7. TASK MANAGEMENT
-- =====================================================

-- Todos table
CREATE TABLE IF NOT EXISTS todos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    due_date DATE,
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    related_to_type TEXT CHECK (related_to_type IN ('student', 'teacher', 'period', 'general')),
    related_to_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 8. INDEXES FOR PERFORMANCE
-- =====================================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Students indexes
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_full_name ON students(full_name);
CREATE INDEX IF NOT EXISTS idx_students_sub_branch ON students(sub_branch);

-- Teachers indexes
CREATE INDEX IF NOT EXISTS idx_teachers_status ON teachers(status);
CREATE INDEX IF NOT EXISTS idx_teachers_user_id ON teachers(user_id);

-- Attendance indexes
CREATE INDEX IF NOT EXISTS idx_instrument_attendance_date ON instrument_attendance(lesson_date);
CREATE INDEX IF NOT EXISTS idx_instrument_attendance_student ON instrument_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_instrument_attendance_teacher ON instrument_attendance(teacher_id);
CREATE INDEX IF NOT EXISTS idx_dance_attendance_date ON dance_attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_dance_attendance_student ON dance_attendance(student_id);

-- Financial indexes
CREATE INDEX IF NOT EXISTS idx_cash_book_date ON cash_book(date);
CREATE INDEX IF NOT EXISTS idx_denizbank_book_date ON denizbank_book(date);
CREATE INDEX IF NOT EXISTS idx_denizbank_pos_book_date ON denizbank_pos_book(date);
CREATE INDEX IF NOT EXISTS idx_vakifbank_book_date ON vakifbank_book(date);

-- Leads indexes
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up_date ON leads(follow_up_date);

-- =====================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE main_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_branch_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE instrument_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE instrument_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE instrument_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE dance_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dance_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dance_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_book ENABLE ROW LEVEL SECURITY;
ALTER TABLE denizbank_book ENABLE ROW LEVEL SECURITY;
ALTER TABLE denizbank_pos_book ENABLE ROW LEVEL SECURITY;
ALTER TABLE vakifbank_book ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can do everything on profiles" ON profiles FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Students policies
CREATE POLICY "Everyone can view students" ON students FOR SELECT USING (true);
CREATE POLICY "Admins can manage students" ON students FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Teachers policies
CREATE POLICY "Everyone can view teachers" ON teachers FOR SELECT USING (true);
CREATE POLICY "Admins can manage teachers" ON teachers FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Financial policies (restricted to admin and accountant)
CREATE POLICY "Financial view policy" ON cash_book FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
);
CREATE POLICY "Financial manage policy" ON cash_book FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
);

CREATE POLICY "Denizbank view policy" ON denizbank_book FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
);
CREATE POLICY "Denizbank manage policy" ON denizbank_book FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
);

CREATE POLICY "Denizbank POS view policy" ON denizbank_pos_book FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
);
CREATE POLICY "Denizbank POS manage policy" ON denizbank_pos_book FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
);

CREATE POLICY "Vakifbank view policy" ON vakifbank_book FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
);
CREATE POLICY "Vakifbank manage policy" ON vakifbank_book FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
);

-- General policies for other tables (everyone can view, admins can manage)
CREATE POLICY "View main_branches" ON main_branches FOR SELECT USING (true);
CREATE POLICY "Manage main_branches" ON main_branches FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "View sub_branches" ON sub_branches FOR SELECT USING (true);
CREATE POLICY "Manage sub_branches" ON sub_branches FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "View attendance" ON instrument_attendance FOR SELECT USING (true);
CREATE POLICY "Manage attendance" ON instrument_attendance FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
);

CREATE POLICY "View dance attendance" ON dance_attendance FOR SELECT USING (true);
CREATE POLICY "Manage dance attendance" ON dance_attendance FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
);

CREATE POLICY "View leads" ON leads FOR SELECT USING (true);
CREATE POLICY "Manage leads" ON leads FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'user'))
);

CREATE POLICY "View todos" ON todos FOR SELECT USING (true);
CREATE POLICY "Manage todos" ON todos FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "View contract_settings" ON contract_settings FOR SELECT USING (true);
CREATE POLICY "Manage contract_settings" ON contract_settings FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- =====================================================
-- 10. INITIAL DATA
-- =====================================================

-- Insert default contract settings
INSERT INTO contract_settings (general_rules, holiday_dates, payment_policy, branch_rules_music, branch_rules_dance)
VALUES (
    '1. Kurumumuzda eğitim öğretim faaliyetleri MEB standartlarına uygun olarak yürütülür.
2. Öğrenci, ders saatinden en az 10 dakika önce kurumda hazır bulunmalıdır.
3. Kurum demirbaşlarına verilen zararlar veli tarafından tazmin edilir.
4. Kayıt dondurma işlemleri en az 15 gün önceden yazılı olarak bildirilmelidir.',
    '1. Resmi tatillerde ders yapılmaz, bu derslerin telafisi kurumun belirlediği tarihlerde yapılır.
2. Sömestr tatili MEB takvimine göre uygulanır.
3. Yaz dönemi (Temmuz-Ağustos) çalışma saatleri ayrıca duyurulur.',
    '1. Ödemeler her ayın ilk 5 iş günü içerisinde yapılmalıdır.
2. 10 haftalık paket programlarda ücret peşin veya kredi kartına taksit ile tahsil edilir.
3. Mazeretsiz devamsızlıklar ücrete tabidir, iade yapılmaz.
4. Kayıt iptallerinde, işlenmemiş derslerin ücret iadesi %10 kesinti ile yapılır.',
    '1. Enstrüman dersleri birebir (özel) ders olarak yapılır.
2. Öğrenci kendi enstrümanını (piyano ve bateri hariç) getirmekle yükümlüdür.
3. Her kur (10 hafta) sonunda öğrenci gelişim raporu verilir.
4. Bir dönem içerisinde mazeretli olarak en fazla 1 ders telafi hakkı bulunur.',
    '1. Bale ve Dans dersleri grup eğitimi olarak yapılır.
2. Kıyafet zorunluluğu vardır (May, çorap, pisi pisi vb.).
3. Grup derslerinde telafi imkanı bulunmamaktadır.
4. Yıl sonu gösterisine katılım zorunludur ve kostüm giderleri veliye aittir.'
)
ON CONFLICT DO NOTHING;

-- Insert default financial categories
INSERT INTO financial_categories (name, type, description) VALUES
    ('Öğrenci Ödemeleri', 'income', 'Öğrencilerden gelen aylık ödemeler'),
    ('Kayıt Ücreti', 'income', 'Yeni öğrenci kayıt ücretleri'),
    ('Öğretmen Maaşları', 'expense', 'Öğretmen ücret ödemeleri'),
    ('Kira', 'expense', 'Bina kira ödemesi'),
    ('Elektrik', 'expense', 'Elektrik faturası'),
    ('Su', 'expense', 'Su faturası'),
    ('İnternet', 'expense', 'İnternet faturası'),
    ('Malzeme Gideri', 'expense', 'Eğitim malzemeleri'),
    ('Temizlik', 'expense', 'Temizlik giderleri'),
    ('Bakım Onarım', 'expense', 'Bakım ve onarım giderleri')
ON CONFLICT DO NOTHING;

-- Insert default main branches
INSERT INTO main_branches (name, description) VALUES
    ('Enstrüman', 'Müzik enstrümanı eğitimi'),
    ('Bale / Dans', 'Bale ve dans eğitimi')
ON CONFLICT DO NOTHING;

-- =====================================================
-- SCHEMA CREATION COMPLETE
-- =====================================================
