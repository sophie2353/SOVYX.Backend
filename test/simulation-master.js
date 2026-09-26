/**
 * SODIE Core AI Engine - Suite Integrada de Simulación E2E v4.0
 * Incluye: Subida a public/video, IA2 (conversar), IA3 (analyzer), 
 * Flujo Meta Graph API (200 registros de 3 países), Asignación CLIENT-#01 y Reset de Cupos.
 */

const fs = require('fs');
const path = require('path');
const supertest = require('supertest');

const BASE_URL = process.env.BACKEND_URL || 'https://api.sodie.app';
const request = supertest(BASE_URL);

const HISTORY_FILE = path.join(__dirname, '.test-history.json');

const REPORT = {
  passed: [],
  failed: []
};

let previousFailedModules = [];
if (fs.existsSync(HISTORY_FILE)) {
  try {
    const historyData = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    previousFailedModules = historyData.failedModules || [];
  } catch (e) {
    previousFailedModules = [];
  }
}

const isReTestMode = previousFailedModules.length > 0;

function shouldRunTest(moduleKey) {
  if (!isReTestMode) return true;
  return previousFailedModules.includes(moduleKey);
}

function logFail(moduleKey, moduleName, errorMsg, location, causa) {
  REPORT.failed.push({ key: moduleKey, module: moduleName, error: errorMsg, location, causa });
  console.log(`❌ [FALLA - ${moduleName}]`);
  console.log(`   Ubicación: ${location}`);
  console.log(`   Error: ${errorMsg}`);
  console.log(`   Causa estimada: ${causa}\n`);
}

function logPass(moduleKey, moduleName, detail) {
  REPORT.passed.push({ key: moduleKey, module: moduleName, detail });
  console.log(`✅ [OK / CORREGIDO - ${moduleName}] ${detail}`);
}

// Genera 200 datos sintéticos de audiencia con 3 países (VE, CO, MX) y valores entre $1,000 y $20,000
function generate200ExcelRecords() {
  const countries = ['VE', 'CO', 'MX'];
  let csvContent = "phone,email,first_name,country,value\n";
  
  for (let i = 1; i <= 200; i++) {
    const country = countries[i % 3];
    const value = Math.floor(Math.random() * (20000 - 1000 + 1)) + 1000;
    csvContent += `+58412${1000000 + i},user${i}@sodie.ai,Cliente${i},${country},${value}\n`;
  }
  return csvContent;
}

function generateMockVideoBuffer() {
  const header = Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
    0x6d, 0x70, 0x34, 0x32, 0x00, 0x00, 0x00, 0x00, 
    0x6d, 0x70, 0x34, 0x32, 0x69, 0x73, 0x6f, 0x6d
  ]);
  const dummyPayload = Buffer.alloc(1024 * 50, 0xAA);
  return Buffer.concat([header, dummyPayload]);
}

async function runAllSimulations() {
  console.log("\n👺💅🏽 === INICIANDO SIMULACIÓN INTEGRAL SODIE v4.0 ===");
  console.log(`🎯 Objetivo del Backend: ${BASE_URL}\n`);

  /* ==========================================================================
     1. ASIGNACIÓN DE ID DE CLIENTE (routes/clientIDroutes)
     ========================================================================== */
  const K_CLIENT_ID = "CLIENT_ID_ASSIGNMENT";
  if (shouldRunTest(K_CLIENT_ID)) {
    try {
      const res = await request.post('/api/client/assign-id').send({ userEmail: "test@sodie.ai" });
      if (res.status === 200 && (res.body.clientId === 'CLIENT-#01' || res.text.includes('CLIENT-#01'))) {
        logPass(K_CLIENT_ID, "Client ID Routes: Asignación ID", "Respondió asignando 'CLIENT-#01' correctamente.");
      } else {
        logFail(
          K_CLIENT_ID, 
          "Client ID Routes: Asignación ID", 
          `HTTP ${res.status} - ${JSON.stringify(res.body || res.text)}`, 
          "routes/clientIDroutes.js", 
          "Verifica el endpoint '/api/client/assign-id' en index.js o la lógica de generación del prefijo CLIENT-#01."
        );
      }
    } catch (err) {
      logFail(K_CLIENT_ID, "Client ID Routes: Asignación ID", err.message, "routes/clientIDroutes.js", "Error al conectar con la ruta de ID de cliente.");
    }
  }

  /* ==========================================================================
     2. SUBIDA Y OBTENCIÓN DE VIDEO DEMO (routes/mediaRoutes)
     ========================================================================== */
  const K_VIDEO_UPLOAD = "ADMIN_VIDEO_UPLOAD";
  if (shouldRunTest(K_VIDEO_UPLOAD)) {
    try {
      const videoBuffer = generateMockVideoBuffer();
      const tempVideoPath = path.join(__dirname, 'temp_render_25s.mp4');
      fs.writeFileSync(tempVideoPath, videoBuffer);

      // A. Subida del video desde admin.js usando el campo 'video'
      const resUpload = await request
        .post('/api/media/upload-video') 
        .attach('video', tempVideoPath, 'test_25s.mp4');

      // B. Verificación de lectura del video activo (consumido por app.js y client.js)
      const resActive = await request.get('/api/media/active-video');

      if (
        (resUpload.status === 200 || resUpload.status === 201) &&
        resUpload.body.success === true &&
        resActive.status === 200 &&
        resActive.body.videoUrl === '/video_demo.mp4'
      ) {
        logPass(
          K_VIDEO_UPLOAD, 
          "Media Routes: Subida y Obtención de Video Demo", 
          "Video 'video_demo.mp4' subido a /public y endpoint activo respondiendo OK."
        );
      } else {
        logFail(
          K_VIDEO_UPLOAD,
          "Media Routes: Subida de Video",
          `Upload Status: ${resUpload.status} | Active Status: ${resActive.status} | Res: ${JSON.stringify(resUpload.body)}`,
          "routes/mediaRoutes.js",
          "Verifica si en index.js tienes app.use('/api/media', mediaRoutes) o si el prefijo de la ruta cambia."
        );
      }

      if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
    } catch (err) {
      logFail(K_VIDEO_UPLOAD, "Media Routes: Subida de Video", err.message, "routes/mediaRoutes.js", "Error en el pipeline de Multer o sistema de archivos.");
    }
  }
  /* ==========================================================================
     3. MÓDULOS DE INTELIGENCIA ARTIFICIAL (IA2 Y IA3)
     ========================================================================== */
  const K_IA = "BACKEND_IA_ENGINES";
  if (shouldRunTest(K_IA)) {
    try {
      const resIA2 = await request.post('/api/modules/ia2-conversar').send({ message: "Hola, iniciando simulación B2B" });
      const resIA3 = await request.post('/api/modules/ia3-analyzer').send({ campaignId: "CMP-META-01", metrics: { roas: 3.2 } });

      if (resIA2.status === 200 && resIA3.status === 200) {
        logPass(K_IA, "Motores IA2 e IA3", "Módulos modules/ia2-conversar y modules/ia3-analyzer respondiendo OK.");
      } else {
        logFail(
          K_IA, 
          "Motores IA2 e IA3", 
          `IA2 (conversar): HTTP ${resIA2.status} | IA3 (analyzer): HTTP ${resIA3.status}`, 
          "modules/ia2-conversar.js / modules/ia3-analyzer.js", 
          "Verifica el mapeo exacto de las rutas de Express para ambos módulos de IA."
        );
      }
    } catch (err) {
      logFail(K_IA, "Motores IA2 e IA3", err.message, "modules/", "Error invocando los archivos de IA.");
    }
  }

  /* ==========================================================================
     4. SIMULACIÓN DE FLUJO META (Graph API + MetaServices + 200 Datas Excel)
     ========================================================================== */
  const K_META = "FACEBOOK_META_SUITE";
  if (shouldRunTest(K_META)) {
    try {
      console.log("📊 Generando 200 registros de audiencia (VE, CO, MX | $1k-$20k)...");
      const csvData = generate200ExcelRecords();
      const csvPath = path.join(__dirname, 'temp_meta_200.csv');
      fs.writeFileSync(csvPath, csvData);

      // Paso A: Callback de usuario para obtener pixel_id y act_id
      const resAuth = await request.get('/api/facebook/callback').query({ code: 'mock_code_meta_123', user: 'CLIENT-#01' });
      
      // Paso B: Cargar la data masiva al servicio
      const resData = await request
        .post('/api/facebook/upload-audience')
        .field('clientId', 'CLIENT-#01')
        .attach('file', csvPath);

      // Paso C: Crear Borrador, Solicitar Métricas y Activar Campaña
      const resDraft = await request.post('/api/facebook/create-borrador').send({ clientId: 'CLIENT-#01', audienceCount: 200 });
      const resMetrics = await request.get('/api/facebook/metrics').query({ clientId: 'CLIENT-#01' });
      const resActivate = await request.post('/api/facebook/activar-campana').send({ clientId: 'CLIENT-#01' });

      if (
        (resAuth.status === 200 || resAuth.status === 302) &&
        (resData.status === 200 || resData.status === 201) &&
        resDraft.status === 200 &&
        resMetrics.status === 200 &&
        resActivate.status === 200
      ) {
        logPass(K_META, "Flujo Completo Meta Graph API & Services", "Simulación con 200 datos de 3 países ejecutada, borrador creado y notificado.");
      } else {
        logFail(
          K_META,
          "Flujo Completo Meta Graph API & Services",
          `Auth: ${resAuth.status} | Data: ${resData.status} | Draft: ${resDraft.status} | Metrics: ${resMetrics.status} | Act: ${resActivate.status}`,
          "routes/facebookRoutes.js / services/metaServices.js",
          "Revisa las rutas de facebookRoutes y que metaServices esté procesando el CSV correctamente."
        );
      }

      if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
    } catch (err) {
      logFail(K_META, "Flujo Completo Meta Graph API", err.message, "routes/facebookRoutes.js", "Error en el ciclo de vida de Meta.");
    }
  }

  /* ==========================================================================
     5. RESTAURAR ESTADO Y DEVOLVER CUPOS A CERO (RESET)
     ========================================================================== */
  const K_RESET = "SYSTEM_SLOTS_RESET";
  if (shouldRunTest(K_RESET)) {
    try {
      const resReset = await request.post('/api/system/reset-slots').send({ adminSecret: 'SIMULATION_BYPASS', setSlotsAvailable: 3 });
      
      if (resReset.status === 200) {
        logPass(K_RESET, "Reset de Entorno & Cupos", "Estado restablecido exitosamente: 3 cupos disponibles liberados.");
      } else {
        logFail(
          K_RESET,
          "Reset de Entorno & Cupos",
          `HTTP ${resReset.status}`,
          "routes/admin.js o systemRoutes",
          "Falta el endpoint para resetear cupos a 3 tras la prueba de simulación."
        );
      }
    } catch (err) {
      logFail(K_RESET, "Reset de Entorno & Cupos", err.message, "system", "Error intentando ejecutar el reset final.");
    }
  }

  /* ==========================================================================
     RESUMEN FINAL
     ========================================================================== */
  console.log("\n==================================================");
  console.log("📊 RESULTADO DEL DIAGNÓSTICO TOTAL v4.0");
  console.log("==================================================");

  if (REPORT.failed.length > 0) {
    const remainingFails = REPORT.failed.map(f => f.key);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify({ failedModules: remainingFails }, null, 2));

    console.log(`❌ SE ENCONTRARON ${REPORT.failed.length} ERRORES A CORREGIR:`);
    REPORT.failed.forEach((item, idx) => {
      console.log(`\n${idx + 1}. Módulo: ${item.module}`);
      console.log(`   Ubicación: ${item.location}`);
      console.log(`   Error: ${item.error}`);
      console.log(`   Causa sugerida: ${item.causa}`);
    });
  } else {
    if (fs.existsSync(HISTORY_FILE)) fs.unlinkSync(HISTORY_FILE);
    console.log("🎉 ¡EXCELENTE! La simulación con 200 datos de Meta, asignación de CLIENT-#01 y reset de 3 cupos fue un éxito total.");
  }
}

runAllSimulations();
