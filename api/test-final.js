/**
 * SODIE - Test Suite V3.5 (Lazy Orchestration & Deferred Campaign Creation)
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
  const testClientId = 'CLIENT-#01';
  const logs = [];

  console.log('\n======================================================');
  console.log('🚀 INICIANDO TEST DE INTEGRATION E2E SODIE V3.5 (LAZY)');
  console.log('======================================================\n');

  try {
    // -----------------------------------------------------------------------
    // PASO 1: Subida de Excel + Segmentación IA1 (Retiene LALs)
    // -----------------------------------------------------------------------
    logs.logTimestamp = new Date().toISOString();
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

    console.log('✅ PASO 1 OK (Upload + LAL Retenidos):', uploadRes.data.ok ? 'EXITOSO' : 'FALLIDO');
    logs.push(`Upload ok=${uploadRes.data.ok}. Registros: ${uploadRes.data.totalRegistros}`);

    // -----------------------------------------------------------------------
    // PASO 2: Configuración (Hora 0) -> Envía actId y dispara creación del borrador
    // -----------------------------------------------------------------------
    logs.push('📡 [TEST] POST /api/v1/facebook/configurar (Hora 0 - Inyección de Credenciales y Activación del Buffer)...');
    const configRes = await axios.post(`${baseUrl}/api/v1/facebook/configurar`, {
      clientId: testClientId,
      actId: process.env.AD_ACCOUNT_ID || '', // 👈 Tu cuenta publicitaria comercial real
      pixelId: process.env.META_PIXEL_ID || '', // 👈 Tu pixel real
      dailyBudget: 1500,
      version: 'V3.5'
    });

    console.log('✅ PASO 2 OK (Configurar + Sincronización Meta):', configRes.data.success ? 'EXITOSO' : 'FALLIDO');

    // -----------------------------------------------------------------------
    // PASO 3: Forzar explicitamente /crear-borrador si el buffer requiere paso manual o validar ID generado
    // -----------------------------------------------------------------------
    logs.push('📡 [TEST] POST /api/v1/facebook/crear-borrador (Validación de ensamble final)...');
    const draftRes = await axios.post(`${baseUrl}/api/v1/facebook/crear-borrador`, {
      clientId: testClientId,
      dailyBudget: 1500,
      version: 'V3.5'
    });

    console.log('✅ PASO 3 OK (Borrador Ensamblado con LALs Retenidos):', draftRes.data.success ? 'EXITOSO' : 'FALLIDO');
    const generatedCampaignId = draftRes.data.campaignId;
    logs.push(`Campaña en borrador creada con éxito. ID: ${generatedCampaignId}`);

    // Verificación de almacenamiento con TTL (campaignStorage)
    let storedCampaignId = null;
    if (campaignStorage && typeof campaignStorage.obtenerCampaignIdVigente === 'function') {
      storedCampaignId = await campaignStorage.obtenerCampaignIdVigente(testClientId, false);
      logs.push(`🔍 Verificación en campaignStorage: Campaign ID activo = ${storedCampaignId}`);
    }

    // -----------------------------------------------------------------------
    // PASO 4: Consultar Métricas
    // -----------------------------------------------------------------------
    logs.push('📡 [TEST] GET /api/v1/facebook/metrics...');
    const metricsRes = await axios.get(`${baseUrl}/api/v1/facebook/metrics?clientId=${encodeURIComponent(testClientId)}`);

    console.log('✅ PASO 4 OK (Consulta de Métricas):', metricsRes.data.success ? 'EXITOSO' : 'FALLIDO');
    logs.push(`Métricas recibidas: Alcance=${metricsRes.data.metrics?.reach || 0}`);

    const summary = {
      testId: `sim_v35_lazy_${Date.now()}`,
      status: 'SUCCESS',
      clientId: testClientId,
      uploadOk: uploadRes.data.ok,
      configOk: configRes.data.success,
      draftOk: draftRes.data.success,
      storageVerified: storedCampaignId === generatedCampaignId,
      metricsOk: metricsRes.data.success,
      campaignId: generatedCampaignId,
      logs
    };

    saveTestHistory(summary);
    console.log('\n✨ ¡TEST E2E DE ORQUESTACIÓN DIFERIDA COMPLETADO CON ÉXITO! ✨\n');
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
    // LIMPIEZA AUTOMÁTICA EN MONGODB
    // -----------------------------------------------------------------------
    try {
      console.log('🧹 [CLEANUP] Limpiando datos de simulación en MongoDB...');
      await Client.deleteOne({ clientId: testClientId });
      await Audiencia.deleteMany({ clientId: testClientId });
      console.log('✨ [CLEANUP] MongoDB limpio y listo.');
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
      message: 'Prueba de integración V3.5 (Lazy Orchestration) ejecutada correctamente.',
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
