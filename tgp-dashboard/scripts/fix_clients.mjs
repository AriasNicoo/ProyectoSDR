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

async function fixClients() {
  console.log('Obteniendo reuniones con cliente nulo...');
  const { data: reuniones, error } = await supabase
    .from('reuniones')
    .select('id, cliente, notas, nombre_prospecto, empresa')
    .is('cliente', null);

  if (error) {
    console.error('Error fetching reuniones:', error);
    return;
  }

  let actualizados = 0;

  for (const reunion of reuniones) {
    let nuevoCliente = null;

    if (reunion.notas) {
      // Buscar en las notas la primera línea limpia
      const notasLimpias = reunion.notas.replace(/<[^|>]+\|([^>]+)>/g, '$1');
      const lineas = notasLimpias.split('\n').map(l => l.trim().replace(/[*_~`]/g, '').trim()).filter(l => l.length > 0);
      
      for (const linea of lineas) {
        const match = linea.match(/^(?:Reuni[oó]n|Reagendamiento|Agendamiento)\s+(.+)/i);
        if (match) {
          nuevoCliente = match[1].trim().replace(/^<|>$/g, '').trim();
          break;
        }
      }
    }

    if ((!nuevoCliente || nuevoCliente.includes('http')) && reunion.empresa) {
      nuevoCliente = reunion.empresa;
    }

    if (nuevoCliente && !nuevoCliente.includes('http')) {
      console.log(`Corrigiendo [${reunion.nombre_prospecto}] -> Cliente: ${nuevoCliente}`);
      
      const { error: updateError } = await supabase
        .from('reuniones')
        .update({ cliente: nuevoCliente })
        .eq('id', reunion.id);
        
      if (updateError) {
        console.error(`Error actualizando ${reunion.id}:`, updateError);
      } else {
        actualizados++;
      }
    } else {
      console.log(`No se pudo determinar un cliente limpio para [${reunion.nombre_prospecto}].`);
    }
  }

  console.log(`\nProceso finalizado. Se corrigieron ${actualizados} registros.`);
}

fixClients();
