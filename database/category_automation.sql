
-- Category Automation Rules Table
CREATE TABLE IF NOT EXISTS category_automation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    keyword TEXT NOT NULL,
    account_scope TEXT NOT NULL DEFAULT 'all',
    category_id UUID REFERENCES financial_categories(id) ON DELETE CASCADE,
    sub_category_id UUID REFERENCES financial_category_descriptions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE category_automation_rules ADD COLUMN IF NOT EXISTS account_scope TEXT NOT NULL DEFAULT 'all';

-- Enable RLS
ALTER TABLE category_automation_rules ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Everyone with financial access can view rules" ON category_automation_rules;
DROP POLICY IF EXISTS "Admins and accountants can manage rules" ON category_automation_rules;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON category_automation_rules;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON category_automation_rules;

CREATE POLICY "Enable read access for all authenticated users" ON category_automation_rules FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON category_automation_rules FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Add sample rule mentioned by user
-- Note: This requires existing category/sub-category IDs. 
-- In the UI, the user will add these themselves.
