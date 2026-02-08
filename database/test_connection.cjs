require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking project:", supabaseUrl);

    const { data: students, error: sError, count } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true });

    if (sError) {
        console.error("Error fetching students:", sError.message);
    } else {
        console.log("Students count in DB:", count);
    }

    const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id, email, role');

    if (pError) {
        console.error("Error fetching profiles:", pError.message);
    } else {
        console.log("Profiles found:", profiles.length);
        profiles.forEach(p => console.log(`- ${p.email}: ${p.role}`));
    }
}

check();
