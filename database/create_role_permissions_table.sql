-- Table: role_permissions
-- Fixes missing table issue and aligns with App.tsx usage

CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_key TEXT NOT NULL,
    role TEXT NOT NULL,
    can_view BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(role, resource_key)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view permissions"
    ON public.role_permissions FOR SELECT TO authenticated USING (true);

-- Ensure Admin matches your exact role string (e.g. 'Admin' vs 'admin')
CREATE POLICY "Admins can manage permissions"
    ON public.role_permissions FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'Admin' 
        )
    );
