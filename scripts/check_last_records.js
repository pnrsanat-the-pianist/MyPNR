import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLastRecords() {
    const { data, error } = await supabase
        .from('cash_book')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error:", error.message);
        return;
    }

    console.log("Last 5 records:");
    data.forEach(r => {
        console.log(`ID: ${r.id}, Date: ${r.date}, Desc: ${r.description}, Inst: ${r.installment_info}, Amount: ${r.amount}`);
    });
}

checkLastRecords();
