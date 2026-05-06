-- =====================================================
-- PNR Sanat Akademisi - Sync Branch Students to Income Sub-categories
-- Description: Adds active/passive CRM students under matching income branch
--              categories such as Bale, Piyano, Gitar, etc.
-- =====================================================

CREATE OR REPLACE FUNCTION public.make_dotted_i_readable(input_text TEXT)
RETURNS TEXT AS $$
    SELECT REPLACE(REPLACE(COALESCE(input_text, ''), U&'\0069\0307', 'i'), U&'\0049\0307', 'İ');
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.sync_branch_student_to_finance()
RETURNS TRIGGER AS $$
DECLARE
    branch_category_id UUID;
    old_branch_category_id UUID;
BEGIN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        SELECT id
        INTO branch_category_id
        FROM public.financial_categories
        WHERE type = 'income'
          AND public.make_dotted_i_readable(title) = public.make_dotted_i_readable(NEW.sub_branch)
        LIMIT 1;

        IF branch_category_id IS NOT NULL
           AND NEW.status IN ('active', 'inactive', 'passive')
           AND COALESCE(TRIM(NEW.full_name), '') <> '' THEN
            INSERT INTO public.financial_category_descriptions (category_id, description)
            VALUES (branch_category_id, public.make_dotted_i_readable(NEW.full_name))
            ON CONFLICT (category_id, description) DO NOTHING;
        END IF;
    END IF;

    IF TG_OP = 'UPDATE'
       AND (OLD.full_name IS DISTINCT FROM NEW.full_name OR OLD.sub_branch IS DISTINCT FROM NEW.sub_branch OR OLD.status IS DISTINCT FROM NEW.status) THEN
        SELECT id
        INTO old_branch_category_id
        FROM public.financial_categories
        WHERE type = 'income'
          AND public.make_dotted_i_readable(title) = public.make_dotted_i_readable(OLD.sub_branch)
        LIMIT 1;

        IF old_branch_category_id IS NOT NULL THEN
            DELETE FROM public.financial_category_descriptions
            WHERE category_id = old_branch_category_id
              AND description = public.make_dotted_i_readable(OLD.full_name)
              AND NOT EXISTS (
                  SELECT 1
                  FROM public.students s
                  WHERE public.make_dotted_i_readable(s.full_name) = public.make_dotted_i_readable(OLD.full_name)
                    AND public.make_dotted_i_readable(s.sub_branch) = public.make_dotted_i_readable(OLD.sub_branch)
                    AND s.status IN ('active', 'inactive', 'passive')
              );
        END IF;

        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        SELECT id
        INTO old_branch_category_id
        FROM public.financial_categories
        WHERE type = 'income'
          AND public.make_dotted_i_readable(title) = public.make_dotted_i_readable(OLD.sub_branch)
        LIMIT 1;

        IF old_branch_category_id IS NOT NULL THEN
            DELETE FROM public.financial_category_descriptions
            WHERE category_id = old_branch_category_id
              AND description = public.make_dotted_i_readable(OLD.full_name)
              AND NOT EXISTS (
                  SELECT 1
                  FROM public.students s
                  WHERE public.make_dotted_i_readable(s.full_name) = public.make_dotted_i_readable(OLD.full_name)
                    AND public.make_dotted_i_readable(s.sub_branch) = public.make_dotted_i_readable(OLD.sub_branch)
                    AND s.status IN ('active', 'inactive', 'passive')
              );
        END IF;

        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_sync_branch_student_to_finance ON public.students;
CREATE TRIGGER tr_sync_branch_student_to_finance
    AFTER INSERT OR UPDATE OF full_name, status, sub_branch OR DELETE ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_branch_student_to_finance();

-- Initial sync for all current active/passive CRM students under matching income branch categories.
INSERT INTO public.financial_category_descriptions (category_id, description)
SELECT
    c.id,
    public.make_dotted_i_readable(s.full_name)
FROM public.students s
JOIN public.financial_categories c
  ON c.type = 'income'
 AND public.make_dotted_i_readable(c.title) = public.make_dotted_i_readable(s.sub_branch)
WHERE s.status IN ('active', 'inactive', 'passive')
  AND COALESCE(TRIM(s.full_name), '') <> ''
  AND COALESCE(TRIM(s.sub_branch), '') <> ''
ON CONFLICT (category_id, description) DO NOTHING;
