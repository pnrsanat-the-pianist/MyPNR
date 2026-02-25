-- =====================================================
-- PNR Sanat Akademisi - Finance Categories Setup & Migration
-- Version: 3.0 (Handles unique constraints for ON CONFLICT)
-- =====================================================

-- 1. Migrate financial_categories table
DO $$ 
BEGIN
    -- Check if table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_categories') THEN
        
        -- Rename 'name' to 'title' if 'name' exists
        IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'financial_categories' AND column_name = 'name') THEN
            ALTER TABLE public.financial_categories RENAME COLUMN name TO title;
        END IF;

        -- Add 'is_automatic' if it doesn't exist
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'financial_categories' AND column_name = 'is_automatic') THEN
            ALTER TABLE public.financial_categories ADD COLUMN is_automatic BOOLEAN DEFAULT false;
        END IF;

        -- Ensure UNIQUE(title, type) constraint exists for ON CONFLICT to work
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'financial_categories_title_type_key' 
            OR conname = 'financial_categories_name_key' -- In case it was unique on name before
        ) THEN
            -- Remove old name unique if it exists
            EXECUTE (format('ALTER TABLE public.financial_categories DROP CONSTRAINT IF EXISTS %I', 
                (SELECT conname FROM pg_constraint WHERE conrelid = 'public.financial_categories'::regclass AND contype = 'u' LIMIT 1)));
            
            ALTER TABLE public.financial_categories ADD CONSTRAINT financial_categories_title_type_key UNIQUE(title, type);
        END IF;
        
    ELSE
        -- Create table fresh if it doesn't exist
        CREATE TABLE public.financial_categories (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title TEXT NOT NULL,
            type TEXT CHECK (type IN ('income', 'expense')) NOT NULL,
            is_automatic BOOLEAN DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT financial_categories_title_type_key UNIQUE(title, type)
        );
    END IF;
END $$;

-- 2. Create financial_category_descriptions table (Sub-items)
CREATE TABLE IF NOT EXISTS public.financial_category_descriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES public.financial_categories(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(category_id, description)
);

-- 3. Enable RLS
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_category_descriptions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.financial_categories;
CREATE POLICY "Enable read access for authenticated users" 
ON public.financial_categories FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Enable all access for admins on financial_categories" ON public.financial_categories;
CREATE POLICY "Enable all access for admins on financial_categories" 
ON public.financial_categories FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'accountant')
  )
);

DROP POLICY IF EXISTS "Enable read access for sub-items" ON public.financial_category_descriptions;
CREATE POLICY "Enable read access for sub-items" 
ON public.financial_category_descriptions FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Enable all access for admins on sub-items" ON public.financial_category_descriptions;
CREATE POLICY "Enable all access for admins on sub-items" 
ON public.financial_category_descriptions FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'accountant')
  )
);

-- 5. Helper Function & Triggers for Updated At
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS tr_financial_categories_updated_at ON public.financial_categories;
CREATE TRIGGER tr_financial_categories_updated_at
    BEFORE UPDATE ON public.financial_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tr_financial_category_descriptions_updated_at ON public.financial_category_descriptions;
CREATE TRIGGER tr_financial_category_descriptions_updated_at
    BEFORE UPDATE ON public.financial_category_descriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. RPC Function for Opening Balance
CREATE OR REPLACE FUNCTION calculate_opening_balance(query_date DATE)
RETURNS DECIMAL AS $$
DECLARE
    income_sum DECIMAL;
    expense_sum DECIMAL;
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO income_sum FROM public.cash_book WHERE type = 'income' AND date < query_date;
    SELECT COALESCE(SUM(amount), 0) INTO expense_sum FROM public.cash_book WHERE type = 'expense' AND date < query_date;
    
    RETURN income_sum - expense_sum;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Initial Seed Data
INSERT INTO public.financial_categories (title, type) VALUES 
('Öğrenci Ödemeleri', 'income'),
('Kayıt Ücretleri', 'income'),
('Ekipman Satışı', 'income'),
('Etkinlik Gelirleri', 'income'),
('Maaşlar', 'expense'),
('Kira ve Aidat', 'expense'),
('Faturalar', 'expense'),
('Reklam ve Pazarlama', 'expense'),
('Mutfak ve Temizlik', 'expense'),
('Kırtasiye', 'expense'),
('Vergiler ve Harçlar', 'expense'),
('Bakım ve Onarım', 'expense')
ON CONFLICT (title, type) DO NOTHING;
