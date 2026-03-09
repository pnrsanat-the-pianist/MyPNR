-- =====================================================
-- PNR Sanat Akademisi - Sync Teachers to Finance Sub-categories
-- Description: Automatically adds teacher names as sub-categories under 'Maaşlar'
-- =====================================================

-- 1. Sync script function
CREATE OR REPLACE FUNCTION sync_teacher_to_finance()
RETURNS TRIGGER AS $$
DECLARE
    maaslar_id UUID;
BEGIN
    -- Get the ID for Maaşlar category
    SELECT id INTO maaslar_id FROM public.financial_categories WHERE title = 'Maaşlar' AND type = 'expense' LIMIT 1;
    
    -- If Maaşlar category doesn't exist, we can't do anything
    IF maaslar_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.financial_category_descriptions (category_id, description)
        VALUES (maaslar_id, NEW.name)
        ON CONFLICT (category_id, description) DO NOTHING;
        
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Only update if name changed
        IF OLD.name IS DISTINCT FROM NEW.name THEN
            UPDATE public.financial_category_descriptions 
            SET description = NEW.name
            WHERE category_id = maaslar_id AND description = OLD.name;
            
            -- If update didn't affect anything (maybe it was deleted manually?), insert it
            IF NOT FOUND THEN
                INSERT INTO public.financial_category_descriptions (category_id, description)
                VALUES (maaslar_id, NEW.name)
                ON CONFLICT (category_id, description) DO NOTHING;
            END IF;
        END IF;
        
    ELSIF (TG_OP = 'DELETE') THEN
        -- When a teacher is deleted, we might want to keep the description for historical records,
        -- but usually sub-categories are just for active selection.
        -- We will remove it here to keep the list clean.
        DELETE FROM public.financial_category_descriptions 
        WHERE category_id = maaslar_id AND description = OLD.name;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS tr_sync_teacher_to_finance ON public.teachers;
CREATE TRIGGER tr_sync_teacher_to_finance
    AFTER INSERT OR UPDATE OR DELETE ON public.teachers
    FOR EACH ROW
    EXECUTE FUNCTION sync_teacher_to_finance();

-- 3. Initial Sync
-- Note: This requires the 'Maaşlar' category to exist. 
-- In case it doesn't, we insert it first.
INSERT INTO public.financial_categories (title, type)
VALUES ('Maaşlar', 'expense')
ON CONFLICT (title, type) DO NOTHING;

INSERT INTO public.financial_category_descriptions (category_id, description)
SELECT 
    (SELECT id FROM public.financial_categories WHERE title = 'Maaşlar' AND type = 'expense' LIMIT 1),
    name
FROM public.teachers
WHERE status = 'active'
ON CONFLICT (category_id, description) DO NOTHING;
