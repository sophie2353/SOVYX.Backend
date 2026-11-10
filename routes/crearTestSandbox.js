require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');

// Importas tu archivo real de base de datos
const campaignStorage = require('./campaignStorageService'); 

const GRAPH_VERSION = 'v26.0';
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;
const ACCESS_TOKEN = process.env.ADMIN_TOKEN || process.env.META_ACCESS_TOKEN;

function hashData(data) {
  return crypto.createHash('sha256').update(data.toLowerCase().trim()).digest('hex');
}

function generarDataFalsa() {
  const data = [];
  const paises = ['us', 'br', 'sv']; // Códigos ISO de 2 letras en minúscula

  for (let i = 0; i < 5000; i++) {
    // Escoger un país al azar de los 3
    const paisAleatorio = paises[Math.floor(Math.random() * paises.length)]; 

    data.push([
      hashData(`TestName${i}`), 
      hashData(`TestLast${i}`), 
      hashData(paisAleatorio), // 👈 País encriptado en SHA256 (Requisito de Meta)
      Math.floor(Math.random() * (15000 - 8000 + 1)) + 8000
    ]);
  }
  return data;
}

async function ejecutarTestIntegral() {
  try {
    // 1. Conectar a MongoDB para poder guardar el test
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📦 Conectado a la BD para el test...');

    // 2. Crear Semilla en Meta
    const seedRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${AD_ACCOUNT_ID}/customaudiences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `SEED_TEST_V5_${Date.now()}`,
        subtype: 'CUSTOM',
        customer_file_source: 'USER_PROVIDED_ONLY',
        is_value_based: true, // Vital para Lookalike de valor
        access_token: ACCESS_TOKEN
      })
    });
    const seedId = (await seedRes.json()).id;

    // 3. Inyectar los 5,000 usuarios a la semilla
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
    const lalId = (await lalRes.json()).id;
    console.log(`🎉 Lookalike creado con éxito: ${lalId}`);



        // =================================================================
    // 5. LA MAGIA: GUARDARLO USANDO TU MÉTODO OFICIAL
    // =================================================================
    console.log('💾 Guardando el test en MongoDB usando registrarCampaignId...');

    await campaignStorage.registrarCampaignId({
      clientId: 'ADMIN_TEST_LAB', // Nombre para reconocerlo fácil en los logs
      campaignId: `TEST_CAMP_${Date.now()}`,
      customAudiences: [{ id: lalId, type: 'LOOKALIKE_2%' }], // Mismo formato que usa finalAudiences
      estadoIndexacion: 'PENDIENTE',
      tokenUsado: ACCESS_TOKEN,
      version: 'v-test-sandbox',
      isAdmin: true,
      ttlHours: 72
    });
    
    console.log('✅ ¡Test guardado impecable! El Radar lo procesará en el próximo ciclo.');
    
    
    process.exit(0); // Cerrar script
  } catch (error) {
    console.error('💥 Error:', error);
    process.exit(1);
  }
}

ejecutarTestIntegral();
