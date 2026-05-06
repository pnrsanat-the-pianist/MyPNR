-- =====================================================
-- PNR Sanat Akademisi - Sync Students to Refund Sub-categories
-- Description: Adds active/passive CRM students under the expense category
--              'Ödeme İadesi' and keeps new/renamed students in sync.
-- =====================================================

-- 1. Ensure the refund category exists in the expense list.
INSERT INTO public.financial_categories (title, type)
VALUES ('Ödeme İadesi', 'expense')
ON CONFLICT (title, type) DO NOTHING;

CREATE OR REPLACE FUNCTION public.make_dotted_i_readable(input_text TEXT)
RETURNS TEXT AS $$
    SELECT REPLACE(REPLACE(COALESCE(input_text, ''), U&'\0069\0307', 'i'), U&'\0049\0307', 'İ');
$$ LANGUAGE sql IMMUTABLE;

-- 2. Sync a student row to the 'Ödeme İadesi' sub-category list.
CREATE OR REPLACE FUNCTION public.sync_student_to_refund_finance()
RETURNS TRIGGER AS $$
DECLARE
    refund_category_id UUID;
BEGIN
    SELECT id
    INTO refund_category_id
    FROM public.financial_categories
    WHERE title = 'Ödeme İadesi'
      AND type = 'expense'
    LIMIT 1;

    IF refund_category_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.status IN ('active', 'inactive', 'passive') AND COALESCE(TRIM(NEW.full_name), '') <> '' THEN
            INSERT INTO public.financial_category_descriptions (category_id, description)
            VALUES (refund_category_id, public.make_dotted_i_readable(NEW.full_name))
            ON CONFLICT (category_id, description) DO NOTHING;
        END IF;

        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.full_name IS DISTINCT FROM NEW.full_name THEN
            IF NEW.status IN ('active', 'inactive', 'passive') AND COALESCE(TRIM(NEW.full_name), '') <> '' THEN
                INSERT INTO public.financial_category_descriptions (category_id, description)
                VALUES (refund_category_id, public.make_dotted_i_readable(NEW.full_name))
                ON CONFLICT (category_id, description) DO NOTHING;
            END IF;

            DELETE FROM public.financial_category_descriptions
            WHERE category_id = refund_category_id
              AND description = public.make_dotted_i_readable(OLD.full_name)
              AND NOT EXISTS (
                  SELECT 1
                  FROM public.students s
                  WHERE s.full_name = OLD.full_name
                    AND s.status IN ('active', 'inactive', 'passive')
              );
        ELSIF NEW.status IN ('active', 'inactive', 'passive') AND COALESCE(TRIM(NEW.full_name), '') <> '' THEN
            INSERT INTO public.financial_category_descriptions (category_id, description)
            VALUES (refund_category_id, public.make_dotted_i_readable(NEW.full_name))
            ON CONFLICT (category_id, description) DO NOTHING;
        ELSE
            DELETE FROM public.financial_category_descriptions
            WHERE category_id = refund_category_id
              AND description = public.make_dotted_i_readable(OLD.full_name)
              AND NOT EXISTS (
                  SELECT 1
                  FROM public.students s
                  WHERE s.full_name = OLD.full_name
                    AND s.status IN ('active', 'inactive', 'passive')
              );
        END IF;

        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.financial_category_descriptions
        WHERE category_id = refund_category_id
          AND description = public.make_dotted_i_readable(OLD.full_name)
          AND NOT EXISTS (
              SELECT 1
              FROM public.students s
              WHERE s.full_name = OLD.full_name
                AND s.status IN ('active', 'inactive', 'passive')
          );

        RETURN OLD;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger for future CRM student inserts/updates.
DROP TRIGGER IF EXISTS tr_sync_student_to_refund_finance ON public.students;
CREATE TRIGGER tr_sync_student_to_refund_finance
    AFTER INSERT OR UPDATE OF full_name, status OR DELETE ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_student_to_refund_finance();

-- 4. Make existing refund sub-categories readable without changing CRM names.
WITH refund_category AS (
    SELECT id
    FROM public.financial_categories
    WHERE title = 'Ödeme İadesi'
      AND type = 'expense'
    LIMIT 1
)
DELETE FROM public.financial_category_descriptions unreadable
USING public.financial_category_descriptions readable, refund_category
WHERE unreadable.category_id = refund_category.id
  AND readable.category_id = refund_category.id
  AND unreadable.id <> readable.id
  AND unreadable.description <> public.make_dotted_i_readable(unreadable.description)
  AND readable.description = public.make_dotted_i_readable(unreadable.description);

WITH refund_category AS (
    SELECT id
    FROM public.financial_categories
    WHERE title = 'Ödeme İadesi'
      AND type = 'expense'
    LIMIT 1
)
UPDATE public.financial_category_descriptions descriptions
SET description = public.make_dotted_i_readable(descriptions.description)
FROM refund_category
WHERE descriptions.category_id = refund_category.id
  AND descriptions.description <> public.make_dotted_i_readable(descriptions.description);

-- 5. Initial sync for all current active/passive CRM students.
INSERT INTO public.financial_category_descriptions (category_id, description)
SELECT
    (SELECT id FROM public.financial_categories WHERE title = 'Ödeme İadesi' AND type = 'expense' LIMIT 1),
    public.make_dotted_i_readable(s.full_name)
FROM public.students s
WHERE s.status IN ('active', 'inactive', 'passive')
  AND COALESCE(TRIM(s.full_name), '') <> ''
ON CONFLICT (category_id, description) DO NOTHING;
