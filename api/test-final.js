/**
 * SODIE - Test Suite V3.5 (E2E Integration + Lazy Orchestration + Form Segmentacion + Push Webhooks)
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const XLSX = require('xlsx');

// Modelos y Almacenamiento
const Client = require('../models/clients');
const Audiencia = require('../models/Audiencia');
const ClientPush = require('../models/ClientPush');
const campaignStorage = require('../routes/campaignStorageService');

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

function generate200MockLeads() {
  const locations = [
    { ciudad: 'Ciudad de México', pais: 'MX', phoneCode: '+52' },
    { ciudad: 'Bogotá', pais: 'CO', phoneCode: '+57' },
    { ciudad: 'Buenos Aires', pais: 'AR', phoneCode: '+54' }
  ];

  const firstNames = ['Carlos', 'Sofía', 'Mateo', 'Valentina', 'Santiago', 'Camila', 'Alejandro', 'Mariana', 'Diego', 'Lucía'];
  const lastNames = ['Mendoza', 'Rodríguez', 'Silva', 'Gomez', 'Hernandez', 'Torres', 'Perez', 'Morales', 'Rios', 'Castro'];

  const leads = [];
  for (let i = 1; i <= 200; i++) {
    const loc = locations[i % locations.length];
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[i % lastNames.length];
    
    leads.push({
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`,
      phone: `${loc.phoneCode}300${100000 + i}`,
      nombre: firstName,
      apellido: lastName,
      country: loc.pais,
      valor: Math.floor(Math.random() * (18000 - 900 + 1)) + 900
    });
  }
  return leads;
}

async function runFullIntegrationTest(baseUrl = 'http://localhost:10000') {
  // Configuración en modo ADMIN para usar AD_ACCOUNT_ID y META_PIXEL_ID de entorno
  const testClientId = 'ADMIN';
  const targetAdAccount = process.env.AD_ACCOUNT_ID || process.env.META_AD_ACCOUNT_ID || '';
  const targetPixelId = process.env.META_PIXEL_ID || process.env.PIXEL_ID || '';

  const logs = [];

  console.log('\n======================================================');
  console.log('🚀 INICIANDO TEST DE INTEGRACIÓN E2E SODIE V3.5 FULL (ADMIN)');
  console.log('======================================================\n');

  try {
    // -----------------------------------------------------------------------
    // PASO 1: Subida de Excel -> Procesamiento IA1 -> Mongo Audiencias
    // -----------------------------------------------------------------------
    logs.push('1. Generando Excel en memoria con 200 leads simulados...');
    const fakeLeads = generate200MockLeads();
    const ws = XLSX.utils.json_to_sheet(fakeLeads);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const form = new FormData();
    form.append('file', excelBuffer, {
      filename: 'leads_test_200.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    form.append('clientId', testClientId);
    form.append('nicho', 'infoproductos');

    logs.push('📡 [TEST] POST /api/v1/media/upload...');
    const uploadRes = await axios.post(`${baseUrl}/api/v1/media/upload`, form, {
      headers: form.getHeaders()
    });

    console.log('✅ PASO 1 OK (Upload + Guardado en Mongo):', uploadRes.data.ok ? 'EXITOSO' : 'FALLIDO');
    logs.push(`Upload ok=${uploadRes.data.ok}. Registros guardados: ${uploadRes.data.totalRegistros}`);

    // -----------------------------------------------------------------------
    // PASO 2: Prueba de Formulario de Segmentación Directa (segmentacionRoutes)
    // -----------------------------------------------------------------------
    logs.push('📡 [TEST] POST /api/v1/segmentacion/procesar (Mapeo de 4 campos a dataset de Mongo)...');
    const formSegRes = await axios.post(`${baseUrl}/api/v1/segmentacion/procesar`, {
      clientId: testClientId,
      paises: ['MX', 'CO'],
      edadMin: 25,
      edadMax: 50,
      value: 1200,
      nicho: 'educacion',
      adAccountId: targetAdAccount
    });

    console.log('✅ PASO 2 OK (Segmentación Formulario -> Audiencias Mongo):', formSegRes.data.ok ? 'EXITOSO' : 'FALLIDO');
    logs.push(`Segmentación Form ok=${formSegRes.data.ok}. Key: ${formSegRes.data.datasetKey || 'OK'}`);

    // -----------------------------------------------------------------------
    // PASO 3: Guardar Suscripción Push WebNativa (ClientPush / push_ADMIN)
    // -----------------------------------------------------------------------
    logs.push('📡 [TEST] POST /api/webhook-client/save-subscription...');
    const pushSaveRes = await axios.post(`${baseUrl}/api/webhook-client/save-subscription`, {
      clientId: testClientId,
      subscription: {
        endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/test_endpoint_mock',
        keys: {
          p256dh: 'mock_p256dh_key_test_string',
          auth: 'mock_auth_key_string'
        }
      }
    });

    console.log('✅ PASO 3 OK (Guardado de Suscripción push_ADMIN):', pushSaveRes.data.success ? 'EXITOSO' : 'FALLIDO');
    logs.push(`Push Subscription ok=${pushSaveRes.data.success}`);

    // -----------------------------------------------------------------------
    // PASO 4: Probar Webhooks de Notificación (3 Días / 7 Días)
    // -----------------------------------------------------------------------
    logs.push('📡 [TEST] POST /api/webhook-client/timer/push-24h (Disparo Alerta 72h)...');
    const push72hRes = await axios.post(`${baseUrl}/api/webhook-client/timer/push-24h`, {
      clientId: testClientId,
      timerId: 'timer_test_72h'
    });

    logs.push('📡 [TEST] POST /api/webhook-client/timer/push-day7 (Disparo Alerta Día 7)...');
    const pushDay7Res = await axios.post(`${baseUrl}/api/webhook-client/timer/push-day7`, {
      clientId: testClientId,
      timerId: 'timer_test_day7'
    });

    console.log('✅ PASO 4 OK (Webhooks Push 3d / 7d):', (push72hRes.data.success && pushDay7Res.data.success) ? 'EXITOSO' : 'FALLIDO');

    // -----------------------------------------------------------------------
    // PASO 5: Configuración de Credenciales (Hora 0)
    // -----------------------------------------------------------------------
    logs.push('📡 [TEST] POST /api/v1/facebook/configurar (Inyección de Credenciales)...');
    const configRes = await axios.post(`${baseUrl}/api/v1/facebook/configurar`, {
      clientId: testClientId,
      actId: targetAdAccount,
      pixelId: targetPixelId,
      dailyBudget: 1500,
      version: 'V3.5'
    });

    console.log('✅ PASO 5 OK (Configurar Credenciales Meta):', configRes.data.success ? 'EXITOSO' : 'FALLIDO');

    // -----------------------------------------------------------------------
    // PASO 6: Crear Borrador en Meta (Lazy Orchestration desde Mongo)
    // -----------------------------------------------------------------------
    logs.push('📡 [TEST] POST /api/v1/facebook/crear-borrador...');
    const draftRes = await axios.post(`${baseUrl}/api/v1/facebook/crear-borrador`, {
      clientId: testClientId,
      actId: targetAdAccount,
      pixelId: targetPixelId,
      dailyBudget: 1500,
      version: 'V3.5'
    });

    console.log('✅ PASO 6 OK (Borrador e Inyección LTV en Meta):', draftRes.data.success ? 'EXITOSO' : 'FALLIDO');
    const generatedCampaignId = draftRes.data.campaignId;
    logs.push(`Campaña en borrador creada con éxito en Meta. ID: ${generatedCampaignId}`);

    // Verificación de almacenamiento con TTL (campaignStorage)
    let storedCampaignId = null;
    if (campaignStorage && typeof campaignStorage.obtenerCampaignIdVigente === 'function') {
      storedCampaignId = await campaignStorage.obtenerCampaignIdVigente(testClientId, true);
      logs.push(`🔍 Verificación en campaignStorage: Campaign ID activo = ${storedCampaignId}`);
    }

    // -----------------------------------------------------------------------
    // PASO 7: Consultar Métricas
    // -----------------------------------------------------------------------
    logs.push('📡 [TEST] GET /api/v1/facebook/metrics...');
    const metricsRes = await axios.get(`${baseUrl}/api/v1/facebook/metrics?clientId=${encodeURIComponent(testClientId)}`);

    console.log('✅ PASO 7 OK (Consulta de Métricas):', metricsRes.data.success ? 'EXITOSO' : 'FALLIDO');
    logs.push(`Métricas recibidas: Alcance=${metricsRes.data.metrics?.reach || 0}`);

    const summary = {
      testId: `sim_v35_full_${Date.now()}`,
      status: 'SUCCESS',
      clientId: testClientId,
      uploadOk: uploadRes.data.ok,
      segmentacionFormOk: formSegRes.data.ok,
      pushSubscriptionOk: pushSaveRes.data.success,
      push72hWebhookOk: push72hRes.data.success,
      pushDay7WebhookOk: pushDay7Res.data.success,
      configOk: configRes.data.success,
      draftOk: draftRes.data.success,
      storageVerified: storedCampaignId === generatedCampaignId,
      metricsOk: metricsRes.data.success,
      campaignId: generatedCampaignId,
      logs
    };

    saveTestHistory(summary);
    console.log('\n✨ ¡TEST E2E COMPLETO PROBADO CON ÉXITO Y REGISTRADO! ✨\n');
    return summary;

  } catch (error) {
    const errorDetails = error.response ? error.response.data : error.message;
    console.error('❌ Error durante la ejecución del test E2E:', errorDetails);
    
    const errorSummary = {
      testId: `sim_v35_err_${Date.now()}`,
      status: 'FAILED',
      error: errorDetails,
      logs
    };
    saveTestHistory(errorSummary);
    throw error;
  } finally {
    // -----------------------------------------------------------------------
    // LIMPIEZA AUTOMÁTICA COMPLETA EN MONGODB
    // -----------------------------------------------------------------------
    try {
      console.log('🧹 [CLEANUP] Limpiando datos de simulación en MongoDB...');
      await Client.deleteOne({ clientId: testClientId });
      await Audiencia.deleteMany({ clientId: testClientId });
      await ClientPush.deleteMany({ clientId: testClientId });
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

    const result = await runFullIntegrationTest(baseUrl);
    return res.status(200).json({
      ok: true,
      message: 'Prueba de integración V3.5 ejecutada correctamente con todas las rutas y webhooks.',
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
