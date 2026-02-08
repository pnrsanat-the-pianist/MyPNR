
-- =====================================================
-- PNR Sanat Akademisi - User Roles & Auth Sync Setup
-- Description: Reconfigures user roles and sets up auto-sync with Supabase Auth
-- Roles: Admin, Kurucu, Müdür, Personel, Öğretmen, Veli
-- =====================================================

-- 1. Update profiles table constraints to support new roles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('Admin', 'Kurucu', 'Müdür', 'Personel', 'Öğretmen', 'Veli'));

-- Ensure status check is matching the frontend (passive)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check 
CHECK (status IN ('active', 'passive'));

-- 2. Handle role_permissions table column naming (Sync with App.tsx)
-- If 'module' column exists, rename it to 'resource_key'
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='role_permissions' AND column_name='module') THEN
    ALTER TABLE public.role_permissions RENAME COLUMN module TO resource_key;
    RAISE NOTICE 'Renamed module to resource_key';
  END IF;
  
  -- Ensure resource_key is NOT NULL if it was just created or renamed
  ALTER TABLE public.role_permissions ALTER COLUMN resource_key SET NOT NULL;
END $$;

-- Update role_permissions table constraints for roles
ALTER TABLE public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_check;
ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_role_check 
CHECK (role IN ('Admin', 'Kurucu', 'Müdür', 'Personel', 'Öğretmen', 'Veli'));

-- 3. Automatic Profile Creation Trigger
-- This function runs every time a user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)), 
    'Veli', -- Default role for new signups is 'Veli'
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Self-Healing: Fix existing admin account
UPDATE public.profiles 
SET role = 'Admin', status = 'active' 
WHERE email = 'pnrsanat@gmail.com';

-- 5. Helper function to promote any user to Admin
CREATE OR REPLACE FUNCTION promote_to_admin(target_email TEXT)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles SET role = 'Admin' WHERE email = target_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Initial Permissions Setup (Basic mapping)
-- Note: 'resource_key' is used in App.tsx fetchPermissions
-- We use a DO block to insert only if the columns exist, or stick to standard ones
DELETE FROM public.role_permissions WHERE resource_key IN ('all', 'crm', 'attendance', 'dashboard');

INSERT INTO public.role_permissions (role, resource_key, can_view, can_edit)
VALUES 
  ('Admin', 'all', true, true),
  ('Kurucu', 'all', true, true),
  ('Müdür', 'all', true, true),
  ('Personel', 'crm', true, true),
  ('Öğretmen', 'attendance', true, true),
  ('Veli', 'dashboard', true, false)
ON CONFLICT (role, resource_key) DO NOTHING;
