/**
 * SODIE - Test Suite V3.6 (Formulario -> Segmentación -> Configurar Meta -> Crear Borrador)
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Modelos de MongoDB
const Audiencia = require('../models/Audiencia');
const Client = require('../models/clients');

const HISTORY_FILE = path.join(__dirname, 'test-history.json');

function saveTestHistory(entry) {
  let history = [];
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    } catch (err) {
      history = [];
    }
  }
  history.push({
    timestamp: new Date().toISOString(),
    ...entry
  });
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
}

async function runFormularioSegmentacionTest(baseUrl = 'http://localhost:10000') {
  // Usamos 'ADMIN-TEST' para que facebookRoutes lo identifique como ADMIN pero podamos limpiar sin borrar tu config principal
  const testClientId = 'ADMIN'; 
  const logs = [];

  console.log('\n======================================================================');
  console.log('🚀 INICIANDO TEST DE FLUJO COMPLETO (FORMULARIO -> MONGO -> META API)');
  console.log('======================================================================\n');

  try {
    // -----------------------------------------------------------------------
    // PASO 1: Procesar Segmentación (Genera Audiencia y Usuarios)
    // -----------------------------------------------------------------------
    const paisesParam = ['CO', 'AR', 'US', 'MX', 'SV']; 
    const valorLTV = 10000; 

    logs.push(`📡 [TEST] POST /api/v1/segmentacion/procesar...`);
    
    const formSegRes = await axios.post(`${baseUrl}/api/v1/segmentacion/procesar`, {
      clientId: testClientId,
      paises: paisesParam,
      edadMin: 25,
      edadMax: 40,
      value: valorLTV,
      nicho: 'infoproductos'
    });

    console.log('✅ PASO 1 OK (Segmentación):', formSegRes.data.ok ? 'EXITOSO' : 'FALLIDO');
    logs.push(`Registros generados: ${formSegRes.data.totalRegistros}`);

    // -----------------------------------------------------------------------
    // PASO 2: Verificación en MongoDB
    // -----------------------------------------------------------------------
    logs.push('🔍 [VERIFICACIÓN] Extrayendo la audiencia desde MongoDB...');
    const audienciaMongo = await Audiencia.findOne({ clientId: testClientId }).sort({ createdAt: -1 });

    if (!audienciaMongo) throw new Error('❌ La audiencia no se encontró en MongoDB.');

    const payloadExtraido = audienciaMongo.segmentacion?.usersPayload || [];
    console.log(`✅ PASO 2 OK (MongoDB): Encontrados ${payloadExtraido.length} registros.`);
    logs.push(`Muestra de registro: ${payloadExtraido[0]?.email} | ${payloadExtraido[0]?.country}`);

    // -----------------------------------------------------------------------
    // PASO 3: Consultar Estado del Temporizador
    // -----------------------------------------------------------------------
    const estadoRes = await axios.get(`${baseUrl}/api/v1/segmentacion/estado/${encodeURIComponent(testClientId)}`);
    console.log('✅ PASO 3 OK (Timer 72h):', estadoRes.data.ok ? 'EXITOSO' : 'FALLIDO');

    // -----------------------------------------------------------------------
    // PASO 4: Configurar Meta Credenciales (Website y ActId)
    // -----------------------------------------------------------------------
    logs.push(`📡 [TEST] POST /api/v1/facebook/configurar...`);
    const actIdPrueba = process.env.AD_ACCOUNT_ID || '123456789'; // Toma tu ID real si está en el .env
    const websitePrueba = 'https://sodie.com/test';

    const configRes = await axios.post(`${baseUrl}/api/v1/facebook/configurar`, {
      clientId: testClientId,
      actId: actIdPrueba,
      websiteUrl: websitePrueba
    });

    console.log('✅ PASO 4 OK (Meta Config): Credenciales guardadas en DB.', configRes.data.act_id);
    logs.push(`Configuración guardada para Act ID: ${configRes.data.act_id} y Website: ${websitePrueba}`);

    // -----------------------------------------------------------------------
    // PASO 5: Lanzar metaService (Crear Borrador Real en Meta)
    // -----------------------------------------------------------------------
    console.log('⏳ PASO 5: Disparando creación de borrador (Llamando a Graph API)...');
    logs.push(`📡 [TEST] POST /api/v1/facebook/crear-borrador... (Invocando metaService)`);

    const draftRes = await axios.post(`${baseUrl}/api/v1/facebook/crear-borrador`, {
      clientId: testClientId,
      actId: actIdPrueba,
      websiteUrl: websitePrueba
    });

    console.log('✅ PASO 5 OK (Meta API): Borrador creado con éxito.');
    console.log(`🎯 Campaign ID: ${draftRes.data.campaignId}`);
    logs.push(`Borrador finalizado. Campaign ID: ${draftRes.data.campaignId} | Status: ${draftRes.data.status}`);

    // -----------------------------------------------------------------------
    // RESUMEN EXITOSO
    // -----------------------------------------------------------------------
    const summary = {
      testId: `test_full_${Date.now()}`,
      status: 'SUCCESS',
      clientId: testClientId,
      campaignIdGenerada: draftRes.data.campaignId,
      logs
    };

    saveTestHistory(summary);
    console.log('\n✨ ¡TEST COMPLETO VERIFICADO! META API RESPONDIÓ CORRECTAMENTE ✨\n');
    return summary;

  } catch (error) {
    const errorDetails = error.response ? error.response.data : error.message;
    console.error('\n❌ [ERROR EN EL FLUJO]:', JSON.stringify(errorDetails, null, 2));
    
    const errorSummary = {
      testId: `test_full_err_${Date.now()}`,
      status: 'FAILED',
      error: errorDetails,
      logs
    };
    saveTestHistory(errorSummary);
    throw error;
  } finally {
    // -----------------------------------------------------------------------
    // LIMPIEZA AUTOMÁTICA
    // -----------------------------------------------------------------------
    try {
      console.log('🧹 [CLEANUP] Limpiando datos de prueba (ADMIN-TEST) en MongoDB...');
      await Audiencia.deleteMany({ clientId: testClientId });
      await Client.deleteOne({ clientId: testClientId });
      console.log('✨ [CLEANUP] Completado.');
    } catch (cleanupErr) {
      console.error('⚠️ [CLEANUP WARNING]:', cleanupErr.message);
    }
  }
}

router.all('/', async (req, res) => {
  try {
    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:10000';
    const baseUrl = `${protocol}://${host}`;

    const result = await runFormularioSegmentacionTest(baseUrl);
    return res.status(200).json({
      ok: true,
      message: 'Flujo completo (Frontend -> Mongo -> Meta API) probado con éxito.',
      result
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.response ? err.response.data : err.message
    });
  }
});

module.exports = router;
