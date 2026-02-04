import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zxeodxltghzeetajdeyx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4ZW9keGx0Z2h6ZWV0YWpkZXl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2NDExNTAsImV4cCI6MjA4MjIxNzE1MH0.djfG17NDmUdztKyuw5Ml-kjRDqsaf34bVvGQOOGFNSo';

export const supabase = createClient(supabaseUrl, supabaseKey);