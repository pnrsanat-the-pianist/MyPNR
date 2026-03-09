-- Finance fixes for Cash Book
-- Description: Adds missing 'installment_info' column to 'cash_book' and ensures schema consistency.

-- 1. Add installment_info to cash_book if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cash_book' AND column_name = 'installment_info') THEN
        ALTER TABLE public.cash_book ADD COLUMN installment_info TEXT;
    END IF;
END $$;

-- 2. Add installment_info to other book tables for consistency (optional but recommended)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'denizbank_book' AND column_name = 'installment_info') THEN
        ALTER TABLE public.denizbank_book ADD COLUMN installment_info TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'denizbank_pos_book' AND column_name = 'installment_info') THEN
        ALTER TABLE public.denizbank_pos_book ADD COLUMN installment_info TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vakifbank_book' AND column_name = 'installment_info') THEN
        ALTER TABLE public.vakifbank_book ADD COLUMN installment_info TEXT;
    END IF;
END $$;

-- 3. Ensure financial_categories migration is up to date (title vs name)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'financial_categories' AND column_name = 'name') THEN
        ALTER TABLE public.financial_categories RENAME COLUMN name TO title;
    END IF;
END $$;
