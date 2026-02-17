import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');

try {
    // Simple .env parser to avoid adding 'dotenv' dependency
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const env = {};
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            env[key] = value;
        }
    });

    const supabaseUrl = env.VITE_SUPABASE_URL;
    const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Error: Could not find VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env file');
        process.exit(1);
    }

    console.log('Attempting to connect to Supabase...');
    console.log(`URL: ${supabaseUrl}`);

    const supabase = createClient(supabaseUrl, supabaseKey);

    // We try to fetch from a table that might not exist yet, 
    // just to check if the network request reaches the server.
    // If we get a specific PostgREST error (like "relation undefined"), 
    // it means we successfully connected to the DB engine.
    const { data, error } = await supabase.from('test_connection_probe').select('*').limit(1);

    if (error) {
        // If the error code starts with PGRST, it's a database error, meaning we connected!
        // 42P01 is "undefined_table", which proves connection.
        if (error.code && (error.code.startsWith('PGRST') || error.code === '42P01')) {
            console.log('✅ Connection SUCCESSFUL!');
            console.log(`Server responded with: ${error.message} (This is expected for a probe)`);
        } else {
            console.error('❌ Connection FAILED or Server Error');
            console.error('Error details:', error);
        }
    } else {
        console.log('✅ Connection SUCCESSFUL!');
    }

} catch (err) {
    console.error('❌ Script Error:', err.message);
}
