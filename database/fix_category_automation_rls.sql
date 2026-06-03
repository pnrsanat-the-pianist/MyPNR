-- Fix category_automation_rules DELETE policy.
-- Run this in Supabase SQL Editor if delete works in the UI but rows stay in Supabase.

ALTER TABLE public.category_automation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone with financial access can view rules" ON public.category_automation_rules;
DROP POLICY IF EXISTS "Admins and accountants can manage rules" ON public.category_automation_rules;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.category_automation_rules;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.category_automation_rules;

CREATE POLICY "Enable read access for all authenticated users"
ON public.category_automation_rules
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable all access for authenticated users"
ON public.category_automation_rules
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
