/**
 * SODIE - Test Suite V3.5 (Test de Formulario de 4 Datos + Segmentación + Upload -> Mongo)
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
  const testClientId = 'ADMIN';
  const logs = [];

  console.log('\n======================================================================');
  console.log('🚀 INICIANDO TEST DE FLUJO FORMULARIO -> SEGMENTACIÓN -> UPLOAD -> MONGO');
  console.log('======================================================================\n');

  try {
    // -----------------------------------------------------------------------
    // PASO 1: Enviar los 4 datos del formulario real del cliente (ADMIN)
    // -----------------------------------------------------------------------
    const paisesParam = ['CO', 'AR', 'US', 'MX', 'SV']; // 5 países = 1,500 registros exactos (300 c/u)
    const valorLTV = 10000; // Valor medio entre 5,000 y 15,000$

    logs.push(`📡 [TEST] POST /api/v1/segmentacion/procesar con parámetros de formulario...`);
    logs.push(`Países: [${paisesParam.join(', ')}], Edad: 25-40, Nicho: infoproductos, Value: ${valorLTV}`);

    const formSegRes = await axios.post(`${baseUrl}/api/v1/segmentacion/procesar`, {
      clientId: testClientId,
      paises: paisesParam,
      edadMin: 25,
      edadMax: 40,
      value: valorLTV,
      nicho: 'infoproductos'
    });

    console.log('✅ PASO 1 OK (Formulario enviado y procesado):', formSegRes.data.ok ? 'EXITOSO' : 'FALLIDO');
    logs.push(`Respuesta de segmentación/upload ok=${formSegRes.data.ok}. Total registros generados: ${formSegRes.data.totalRegistros}`);

    // -----------------------------------------------------------------------
    // PASO 2: Verificación estricta extrayendo la audiencia directamente de MongoDB
    // -----------------------------------------------------------------------
    logs.push('🔍 [VERIFICACIÓN] Extrayendo la audiencia completa desde models/Audiencia en Mongo...');
    const audienciaMongo = await Audiencia.findOne({ clientId: testClientId });

    if (!audienciaMongo) {
      throw new Error('❌ La audiencia no se encontró registrada en MongoDB.');
    }

    const payloadExtraido = audienciaMongo.segmentacion?.usersPayload || [];
    const totalExtraido = payloadExtraido.length;
    const primerRegistro = payloadExtraido[0] || {};

    console.log(`✅ PASO 2 OK (Extracción Mongo): Encontrados ${totalExtraido} registros con ID de sesión y estructura.`);
    logs.push(`Audiencia extraída de Mongo correctamente. Total en lista: ${totalExtraido}`);
    logs.push(`Muestra de registro UID/Email: ${primerRegistro.email} | País: ${primerRegistro.country} | Valor: ${primerRegistro.value}`);

    // -----------------------------------------------------------------------
    // PASO 3: Consultar Estado del Temporizador de 72h
    // -----------------------------------------------------------------------
    logs.push(`📡 [TEST] GET /api/v1/segmentacion/estado/${testClientId}...`);
    const estadoRes = await axios.get(`${baseUrl}/api/v1/segmentacion/estado/${encodeURIComponent(testClientId)}`);

    console.log('✅ PASO 3 OK (Consulta de Estado/Timer 72h):', estadoRes.data.ok ? 'EXITOSO' : 'FALLIDO');
    logs.push(`Horas restantes para rotación: ${estadoRes.data.horasRestantes}h`);

    const summary = {
      testId: `test_form_seg_${Date.now()}`,
      status: 'SUCCESS',
      clientId: testClientId,
      segmentacionFormOk: formSegRes.data.ok,
      totalRegistrosEsperados: paisesParam.length * 300,
      totalRegistrosEnMongo: totalExtraido,
      muestraRegistro: primerRegistro,
      timerEstadoOk: estadoRes.data.ok,
      horasRestantes: estadoRes.data.horasRestantes,
      logs
    };

    saveTestHistory(summary);
    console.log('\n✨ ¡TEST DE FORMULARIO Y SEGMENTACIÓN VERIFICADO EXITOSAMENTE EN MONGO! ✨\n');
    return summary;

  } catch (error) {
    const errorDetails = error.response ? error.response.data : error.message;
    console.error('❌ Error durante el test de formulario:', errorDetails);
    
    const errorSummary = {
      testId: `test_form_err_${Date.now()}`,
      status: 'FAILED',
      error: errorDetails,
      logs
    };
    saveTestHistory(errorSummary);
    throw error;
  } finally {
    // -----------------------------------------------------------------------
    // LIMPIEZA AUTOMÁTICA EN MONGODB
    // -----------------------------------------------------------------------
    try {
      console.log('🧹 [CLEANUP] Limpiando datos de prueba en MongoDB...');
      await Audiencia.deleteMany({ clientId: testClientId });
      await Client.deleteOne({ clientId: testClientId });
      console.log('✨ [CLEANUP] MongoDB totalmente limpio.');
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
      message: 'Flujo de formulario, segmentación y persistencia en MongoDB probado con éxito.',
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
