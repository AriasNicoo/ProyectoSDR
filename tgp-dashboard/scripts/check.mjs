import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envPath = '.env.local';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value.length > 0) {
      process.env[key.trim()] = value.join('=').trim().replace(/['"]/g, '');
    }
  });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase
    .from('reuniones')
    .select('id, cliente, notas, nombre_prospecto, titulo_reunion')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(JSON.stringify(data, null, 2));
}

check();
