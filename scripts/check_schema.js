import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase environment variables!");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const queries = [
    `ALTER TABLE IF EXISTS public.cash_book ADD COLUMN IF NOT EXISTS installment_info TEXT;`,
    `ALTER TABLE IF EXISTS public.denizbank_book ADD COLUMN IF NOT EXISTS installment_info TEXT;`,
    `ALTER TABLE IF EXISTS public.denizbank_pos_book ADD COLUMN IF NOT EXISTS installment_info TEXT;`,
    `ALTER TABLE IF EXISTS public.vakifbank_book ADD COLUMN IF NOT EXISTS installment_info TEXT;`,
    `DO $$ BEGIN IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'financial_categories' AND column_name = 'name') THEN ALTER TABLE public.financial_categories RENAME COLUMN name TO title; END IF; END $$;`
];

async function runFix() {
    console.log("Starting finance schema fixes...");
    
    // We'll use the SQL editor functionality via RPC if available, 
    // but since we are using JS client, we'll try to use a dummy query or 
    // inform the user if we can't run raw SQL.
    // Supabase JS doesn't support raw SQL for security reasons.
    
    console.log("PLEASE NOTE: Supabase JS client cannot execute raw ALTER TABLE queries directly.");
    console.log("I will check if the columns exist first.");

    const { data, error } = await supabase.from('cash_book').select('*').limit(1);
    
    if (error && error.message.includes("installment_info")) {
        console.log("Confirmed: 'installment_info' is missing in 'cash_book'.");
    } else if (!error) {
        if (data && data.length > 0 && 'installment_info' in data[0]) {
            console.log("Success: 'installment_info' already exists.");
        } else {
            console.log("Column 'installment_info' might be missing OR table is empty.");
        }
    } else {
        console.error("Error checking table:", error.message);
    }
}

runFix();
