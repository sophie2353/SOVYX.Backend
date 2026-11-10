require('dotenv').config();
const crypto = require('crypto');

// Importas tu archivo real de base de datos
const campaignStorage = require('./campaignStorageService'); 

const GRAPH_VERSION = 'v26.0';
// Validación de Cuenta de Anuncios y Token
const rawAdAccountId = process.env.META_AD_ACCOUNT_ID || process.env.AD_ACCOUNT_ID;
const ACCESS_TOKEN = process.env.ADMIN_TOKEN || process.env.META_ACCESS_TOKEN;

// Meta exige el prefijo 'act_' antes del ID de la cuenta publicitaria
const AD_ACCOUNT_ID = rawAdAccountId && !rawAdAccountId.startsWith('act_') 
  ? `act_${rawAdAccountId}` 
  : rawAdAccountId;

// ⏱️ UTILIDAD NUEVA: Función para pausar la ejecución
const pausar = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function hashData(data) {
  return crypto.createHash('sha256').update(data.toLowerCase().trim()).digest('hex');
}

function generarDataFalsa() {
  const data = [];
  const paises = ['us', 'br', 'sv']; // Códigos ISO de 2 letras en minúscula

  for (let i = 0; i < 5000; i++) {
    const paisAleatorio = paises[Math.floor(Math.random() * paises.length)]; 

    data.push([
      hashData(`TestName${i}`), 
      hashData(`TestLast${i}`), 
      hashData(paisAleatorio), // País encriptado
      Math.floor(Math.random() * (1500000 - 800000 + 1)) + 800000 // Value de 8K a 15K
    ]);
  }
  return data;
}

async function ejecutarTestIntegral() {
  // 🚨 FRENO DE SEGURIDAD: Verificar que la variable existe antes de llamar a Meta
  if (!AD_ACCOUNT_ID || AD_ACCOUNT_ID.includes('undefined')) {
    console.error('💥 ERROR: La variable META_AD_ACCOUNT_ID no está definida en Render.');
    console.log('👉 Asegúrate de agregar META_AD_ACCOUNT_ID en la sección "Environment Variables" de Render.');
    return false;
  }

  console.log(`📌 Usando Cuenta de Anuncios: ${AD_ACCOUNT_ID}`);
  
  try {
    // 1. Crear Semilla en Meta
    const seedRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${AD_ACCOUNT_ID}/customaudiences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `SEED_TEST_V5_${Date.now()}`,
        subtype: 'CUSTOM',
        customer_file_source: 'USER_PROVIDED_ONLY',
        is_value_based: true, 
        access_token: ACCESS_TOKEN
      })
    });
    
    const seedData = await seedRes.json();

    if (seedData.error) {
      console.error('\n💥 ERROR DE META CREANDO LA SEMILLA:');
      console.error(JSON.stringify(seedData.error, null, 2));
      return false;
    }

    const seedId = seedData.id;
    console.log(`✅ Semilla Creada con éxito. ID: ${seedId}`);
    
    // 2. Inyectar los 5,000 usuarios a la semilla
    const usuarios = generarDataFalsa();
    await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${seedId}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payload: { 
          schema: ['FN', 'LN', 'COUNTRY', 'LOOKALIKE_VALUE'],
          data: usuarios 
        },
        access_token: ACCESS_TOKEN
      })
    });
    console.log('✅ 5,000 usuarios High Ticket inyectados a la semilla.');

    // =================================================================
    // ⏳ 3. LA PAUSA VITAL: Darle tiempo a Meta de procesar la semilla
    // =================================================================
    console.log('⏳ Dándole 20 segundos de respiro a Meta para que digiera los datos...');
    await pausar(20000); 

    // 4. Crear Lookalike 2% (US, BR, SV)
    const lalRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${AD_ACCOUNT_ID}/customaudiences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `LAL_2_USA_BR_SV_${Date.now()}`,
        subtype: 'LOOKALIKE',
        origin_audience_id: seedId,
        lookalike_spec: {
          type: 'similarity',
          ratio: 0.02,
          location_spec: { geo_locations: { countries: ['US', 'BR', 'SV'] } }
        },
        access_token: ACCESS_TOKEN
      })
    });
    const lalData = await lalRes.json();

    // 🚨 5. VALIDACIÓN DE ERROR: Si Meta falla, atrapamos la razón exacta
    if (lalData.error) {
      console.error('\n💥 ERROR DE META CREANDO EL LOOKALIKE:');
      console.error(JSON.stringify(lalData.error, null, 2));
      console.log('\n❌ El test se abortó para no guardar basura en la base de datos.');
      return false; 
    }

    const lalId = lalData.id;
    console.log(`🎉 Lookalike creado con éxito. ID válido: ${lalId}`);

    // 6. Guardar en la BD
    console.log('💾 Guardando el test en MongoDB usando registrarCampaignId...');
    await campaignStorage.registrarCampaignId({
      clientId: 'ADMIN_TEST', 
      campaignId: `TEST_CAMP_${Date.now()}`,
      customAudiences: [{ id: lalId, type: 'LOOKALIKE_2%' }], 
      estadoIndexacion: 'PENDIENTE',
      tokenUsado: ACCESS_TOKEN,
      version: 'v-test-sandbox',
      isAdmin: true,
      ttlHours: 72
    });
    
    console.log('✅ ¡Test guardado impecable! El Radar lo procesará en el próximo ciclo.');
    
    return true; 
  } catch (error) {
    console.error('💥 Error Crítico en el script:', error);
  }
}

ejecutarTestIntegral();
