import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTeachersSchema() {
    // We can't query information_schema easily via JS client, 
    // but we can try to select one row and see keys.
    const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error fetching teachers:", error.message);
        // If it failed because of column doesn't exist, we might get more info here
    } else if (data && data.length > 0) {
        console.log("Columns in teachers table:", Object.keys(data[0]));
    } else {
        console.log("No data in teachers table to check columns.");
    }
}

checkTeachersSchema();
