require('dotenv').config({ path: './tgp-dashboard/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function debug() {
  console.log("Conectando a:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  
  const { data: perfiles, error: e1 } = await supabase.from('perfiles').select('*');
  console.log("\n--- PERFILES EN LA BASE DE DATOS ---");
  if (e1) console.error(e1);
  else console.log(perfiles);

  const { data: reuniones, error: e2 } = await supabase.from('reuniones').select('id, sdr_name, nombre_prospecto').limit(5);
  console.log("\n--- ÚLTIMAS 5 REUNIONES (Para ver el nombre del SDR guardado) ---");
  if (e2) console.error(e2);
  else console.log(reuniones);
}

debug();
