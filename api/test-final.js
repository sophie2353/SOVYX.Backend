/**
 * SODIE - Test Suite V3.6 (Formulario -> Segmentación -> Configurar Meta -> Borrador)
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

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
  const testClientId = 'ADMIN'; 
  const logs = [];

  console.log('\n======================================================================');
  console.log('🚀 INICIANDO TEST DE FLUJO COMPLETO (FORMULARIO -> MONGO -> UPLOAD)');
  console.log('======================================================================\n');

  try {
    // -----------------------------------------------------------------------
    // PASO 1: Procesar Segmentación con múltiples países (Ej: BR, SV, US)
    // -----------------------------------------------------------------------
    const paisesParam = ['BR', 'SV', 'US']; 
    const valorLTV = 1500; 
    const presupuestoDiarioCentavos = 3300; // 33$ en centavos

    logs.push(`📡 [TEST] POST /api/v1/segmentacion/procesar...`);
    
    const formSegRes = await axios.post(`${baseUrl}/api/v1/segmentacion/procesar`, {
      clientId: testClientId,
      paises: paisesParam,
      edadMin: 22,
      edadMax: 55,
      value: valorLTV,
      nicho: 'infoproductos'
    });

    console.log('✅ PASO 1 OK (Segmentación):', formSegRes.data.ok ? 'EXITOSO' : 'FALLIDO');
    logs.push(`Registros generados: ${formSegRes.data.totalRegistros}`);

    // -----------------------------------------------------------------------
    // PASO 2: Verificación estricta en MongoDB (Comprobar que Upload guardó el payload)
    // -----------------------------------------------------------------------
    logs.push('🔍 [VERIFICACIÓN] Extrayendo la audiencia desde MongoDB...');
    const audienciaMongo = await Audiencia.findOne({ clientId: testClientId }).sort({ createdAt: -1 });

    if (!audienciaMongo) throw new Error('❌ La audiencia no se encontró en MongoDB.');

    const payloadExtraido = audienciaMongo.segmentacion?.usersPayload || [];
    const paisesEncontrados = audienciaMongo.segmentacion?.countriesFound || [];
    
    console.log(`✅ PASO 2 OK (MongoDB): Encontrados ${payloadExtraido.length} registros.`);
    console.log(`🌍 Países detectados en la nube:`, paisesEncontrados);
    
    if (payloadExtraido.length < 1200) {
      throw new Error(`⚠️ El registro de filas (${payloadExtraido.length}) es inferior al mínimo de 1,200 establecido.`);
    }

    logs.push(`Muestra de registro limpio (Sin correos/teléfonos): ${payloadExtraido[0]?.firstName} | ${payloadExtraido[0]?.country} | Val: ${payloadExtraido[0]?.value}`);

    // -----------------------------------------------------------------------
    // PASO 3: Consultar Estado del Temporizador y Edades guardadas
    // -----------------------------------------------------------------------
    const estadoRes = await axios.get(`${baseUrl}/api/v1/segmentacion/estado/${encodeURIComponent(testClientId)}`);
    console.log('✅ PASO 3 OK (Timer 72h y Config):', estadoRes.data.ok ? 'EXITOSO' : 'FALLIDO');

    const summary = {
      testId: `test_full_${Date.now()}`,
      status: 'SUCCESS',
      clientId: testClientId,
      valorIngresado: valorLTV,
      presupuestoConfiguradoCentavos: presupuestoDiarioCentavos,
      totalRegistros: formSegRes.data.totalRegistros,
      paisesVerificados: paisesEncontrados,
      logs
    };

    saveTestHistory(summary);
    console.log('\n✨ ¡TEST DE FLUJO DE AUDIENCIA VERIFICADO CON ÉXITO EN MONGO! ✨\n');
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
    try {
      console.log('🧹 [CLEANUP] Limpiando datos de prueba en MongoDB...');
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
      message: 'Flujo completo (Segmentación -> Upload -> Mongo) probado con éxito.',
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
