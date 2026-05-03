-- Fix finance RLS policies to match the application's role/permission model.
-- Run this in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.can_access_resource(resource_key_input TEXT, access_type TEXT DEFAULT 'view')
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'Admin'
    )
    OR EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.role_permissions rp ON rp.role = p.role
        WHERE p.id = auth.uid()
          AND rp.resource_key = resource_key_input
          AND CASE
              WHEN access_type = 'edit' THEN rp.can_edit
              ELSE rp.can_view OR rp.can_edit
          END
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_access_resource(TEXT, TEXT) TO authenticated;

-- Financial categories
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.financial_categories;
DROP POLICY IF EXISTS "Enable all access for admins on financial_categories" ON public.financial_categories;
DROP POLICY IF EXISTS financial_categories_select ON public.financial_categories;
DROP POLICY IF EXISTS financial_categories_insert ON public.financial_categories;
DROP POLICY IF EXISTS financial_categories_update ON public.financial_categories;
DROP POLICY IF EXISTS financial_categories_delete ON public.financial_categories;

CREATE POLICY financial_categories_select ON public.financial_categories
FOR SELECT TO authenticated
USING (public.can_access_resource('gelir-gider', 'view'));

CREATE POLICY financial_categories_insert ON public.financial_categories
FOR INSERT TO authenticated
WITH CHECK (public.can_access_resource('gelir-gider', 'edit'));

CREATE POLICY financial_categories_update ON public.financial_categories
FOR UPDATE TO authenticated
USING (public.can_access_resource('gelir-gider', 'edit'))
WITH CHECK (public.can_access_resource('gelir-gider', 'edit'));

CREATE POLICY financial_categories_delete ON public.financial_categories
FOR DELETE TO authenticated
USING (public.can_access_resource('gelir-gider', 'edit'));

-- Financial category descriptions
DROP POLICY IF EXISTS "Enable read access for sub-items" ON public.financial_category_descriptions;
DROP POLICY IF EXISTS "Enable all access for admins on sub-items" ON public.financial_category_descriptions;
DROP POLICY IF EXISTS financial_category_descriptions_select ON public.financial_category_descriptions;
DROP POLICY IF EXISTS financial_category_descriptions_insert ON public.financial_category_descriptions;
DROP POLICY IF EXISTS financial_category_descriptions_update ON public.financial_category_descriptions;
DROP POLICY IF EXISTS financial_category_descriptions_delete ON public.financial_category_descriptions;

CREATE POLICY financial_category_descriptions_select ON public.financial_category_descriptions
FOR SELECT TO authenticated
USING (public.can_access_resource('gelir-gider', 'view'));

CREATE POLICY financial_category_descriptions_insert ON public.financial_category_descriptions
FOR INSERT TO authenticated
WITH CHECK (public.can_access_resource('gelir-gider', 'edit'));

CREATE POLICY financial_category_descriptions_update ON public.financial_category_descriptions
FOR UPDATE TO authenticated
USING (public.can_access_resource('gelir-gider', 'edit'))
WITH CHECK (public.can_access_resource('gelir-gider', 'edit'));

CREATE POLICY financial_category_descriptions_delete ON public.financial_category_descriptions
FOR DELETE TO authenticated
USING (public.can_access_resource('gelir-gider', 'edit'));

-- Cash book
DROP POLICY IF EXISTS "Financial view policy" ON public.cash_book;
DROP POLICY IF EXISTS "Financial manage policy" ON public.cash_book;
DROP POLICY IF EXISTS cash_book_select ON public.cash_book;
DROP POLICY IF EXISTS cash_book_insert ON public.cash_book;
DROP POLICY IF EXISTS cash_book_update ON public.cash_book;
DROP POLICY IF EXISTS cash_book_delete ON public.cash_book;

CREATE POLICY cash_book_select ON public.cash_book
FOR SELECT TO authenticated
USING (public.can_access_resource('kasa', 'view'));

CREATE POLICY cash_book_insert ON public.cash_book
FOR INSERT TO authenticated
WITH CHECK (public.can_access_resource('kasa', 'edit'));

CREATE POLICY cash_book_update ON public.cash_book
FOR UPDATE TO authenticated
USING (public.can_access_resource('kasa', 'edit'))
WITH CHECK (public.can_access_resource('kasa', 'edit'));

CREATE POLICY cash_book_delete ON public.cash_book
FOR DELETE TO authenticated
USING (public.can_access_resource('kasa', 'edit'));

-- Denizbank
DROP POLICY IF EXISTS "Denizbank view policy" ON public.denizbank_book;
DROP POLICY IF EXISTS "Denizbank manage policy" ON public.denizbank_book;
DROP POLICY IF EXISTS denizbank_book_select ON public.denizbank_book;
DROP POLICY IF EXISTS denizbank_book_insert ON public.denizbank_book;
DROP POLICY IF EXISTS denizbank_book_update ON public.denizbank_book;
DROP POLICY IF EXISTS denizbank_book_delete ON public.denizbank_book;

CREATE POLICY denizbank_book_select ON public.denizbank_book
FOR SELECT TO authenticated
USING (public.can_access_resource('denizbank', 'view'));

CREATE POLICY denizbank_book_insert ON public.denizbank_book
FOR INSERT TO authenticated
WITH CHECK (public.can_access_resource('denizbank', 'edit'));

CREATE POLICY denizbank_book_update ON public.denizbank_book
FOR UPDATE TO authenticated
USING (public.can_access_resource('denizbank', 'edit'))
WITH CHECK (public.can_access_resource('denizbank', 'edit'));

CREATE POLICY denizbank_book_delete ON public.denizbank_book
FOR DELETE TO authenticated
USING (public.can_access_resource('denizbank', 'edit'));

-- Denizbank POS
DROP POLICY IF EXISTS "Denizbank POS view policy" ON public.denizbank_pos_book;
DROP POLICY IF EXISTS "Denizbank POS manage policy" ON public.denizbank_pos_book;
DROP POLICY IF EXISTS denizbank_pos_book_select ON public.denizbank_pos_book;
DROP POLICY IF EXISTS denizbank_pos_book_insert ON public.denizbank_pos_book;
DROP POLICY IF EXISTS denizbank_pos_book_update ON public.denizbank_pos_book;
DROP POLICY IF EXISTS denizbank_pos_book_delete ON public.denizbank_pos_book;

CREATE POLICY denizbank_pos_book_select ON public.denizbank_pos_book
FOR SELECT TO authenticated
USING (public.can_access_resource('denizbank-pos', 'view'));

CREATE POLICY denizbank_pos_book_insert ON public.denizbank_pos_book
FOR INSERT TO authenticated
WITH CHECK (public.can_access_resource('denizbank-pos', 'edit'));

CREATE POLICY denizbank_pos_book_update ON public.denizbank_pos_book
FOR UPDATE TO authenticated
USING (public.can_access_resource('denizbank-pos', 'edit'))
WITH CHECK (public.can_access_resource('denizbank-pos', 'edit'));

CREATE POLICY denizbank_pos_book_delete ON public.denizbank_pos_book
FOR DELETE TO authenticated
USING (public.can_access_resource('denizbank-pos', 'edit'));

-- Vakifbank
DROP POLICY IF EXISTS "Vakifbank view policy" ON public.vakifbank_book;
DROP POLICY IF EXISTS "Vakifbank manage policy" ON public.vakifbank_book;
DROP POLICY IF EXISTS vakifbank_book_select ON public.vakifbank_book;
DROP POLICY IF EXISTS vakifbank_book_insert ON public.vakifbank_book;
DROP POLICY IF EXISTS vakifbank_book_update ON public.vakifbank_book;
DROP POLICY IF EXISTS vakifbank_book_delete ON public.vakifbank_book;

CREATE POLICY vakifbank_book_select ON public.vakifbank_book
FOR SELECT TO authenticated
USING (public.can_access_resource('vakifbank', 'view'));

CREATE POLICY vakifbank_book_insert ON public.vakifbank_book
FOR INSERT TO authenticated
WITH CHECK (public.can_access_resource('vakifbank', 'edit'));

CREATE POLICY vakifbank_book_update ON public.vakifbank_book
FOR UPDATE TO authenticated
USING (public.can_access_resource('vakifbank', 'edit'))
WITH CHECK (public.can_access_resource('vakifbank', 'edit'));

CREATE POLICY vakifbank_book_delete ON public.vakifbank_book
FOR DELETE TO authenticated
USING (public.can_access_resource('vakifbank', 'edit'));
