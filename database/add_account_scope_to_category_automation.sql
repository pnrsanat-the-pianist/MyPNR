ALTER TABLE public.category_automation_rules
ADD COLUMN IF NOT EXISTS account_scope TEXT NOT NULL DEFAULT 'all';

UPDATE public.category_automation_rules
SET account_scope = 'all'
WHERE account_scope IS NULL;
