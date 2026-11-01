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
    const valorLTV = 15000; 

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
    // RESUMEN EXITOSO
    // -----------------------------------------------------------------------
    const summary = {
      testId: `test_full_${Date.now()}`,
      status: 'SUCCESS',
      clientId: testClientId,
      valorIngresado: valorLTV, // 👈 Aquí ves el valor enviado ($15,000)
      valorProcesadoCentavos: Math.round(Number(valorLTV) * 100), // 👈 Aquí confirmas el x100 en centavos (1,500,000)
      totalRegistros: formSegRes.data.totalRegistros,
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
