/**
 * SODIE Core AI Engine - Suite Integrada de Simulación E2E v5.0 (Dynamic Route Discovery)
 * 
 * Descubre dinámicamente el 100% de las rutas registradas en `index.js`, las clasifica y las ejecuta.
 * Diseñado para correr en el entorno de Render o localmente enviando logs detallados.
 */

const fs = require('fs');
const path = require('path');
const supertest = require('supertest');

// Importar la app de Express principal desde index.js
let app;
try {
  app = require('../index'); 
} catch (e) {
  try {
    app = require('./index');
  } catch (err) {
    console.error("❌ No se pudo importar app desde index.js. Asegúrate de exportar `module.exports = app` en tu index.js.");
    process.exit(1);
  }
}

const request = supertest(app);
const HISTORY_FILE = path.join(__dirname, '.test-history.json');

const REPORT = {
  passed: [],
  failed: [],
  discoveredRoutes: []
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

/* ==========================================================================
   EXTRACTOR DINÁMICO DE RUTAS (Inspecciona Express Router Stack)
   ========================================================================== */
function extractAllRoutes(expressApp) {
  const routes = [];

  function print(pathPrefix, layer) {
    if (layer.route) {
      // Ruta directa registrada en app
      const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
      methods.forEach(method => {
        routes.push({ method, path: pathPrefix + layer.route.path });
      });
    } else if (layer.name === 'router' && layer.handle.stack) {
      // Router montado vía app.use()
      let extraPrefix = '';
      if (layer.regexp) {
        const match = layer.regexp.source
          .replace('^\\', '')
          .replace('\\/?(?=\\/|$)', '')
          .replace('(?:\\/(?=$))?', '')
          .replace(/\\\//g, '/');
        extraPrefix = match.startsWith('/') ? match : '/' + match;
      }

      layer.handle.stack.forEach(handler => {
        print(pathPrefix + extraPrefix, handler);
      });
    }
  }

  if (expressApp._router && expressApp._router.stack) {
    expressApp._router.stack.forEach(layer => {
      print('', layer);
    });
  }

  // Filtrar duplicados o rutas wildcard genéricas de error
  return routes.filter((r, idx, self) => 
    self.findIndex(t => t.method === r.method && t.path === r.path) === idx &&
    !r.path.includes('*')
  );
}

// Helper para generar CSV con 200 registros de VE, CO, MX ($1k - $20k)
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

// Helper para generar buffer de video .mp4 válido
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
  console.log("\n👺💅🏽 === INICIANDO SIMULACIÓN INTEGRAL SODIE v5.0 (Dynamic Engine) ===");
  
  // 1. Descubrimiento de rutas
  const discoveredRoutes = extractAllRoutes(app);
  REPORT.discoveredRoutes = discoveredRoutes;
  
  console.log(`🔍 Total de rutas descubiertas en index.js: ${discoveredRoutes.length}`);
  discoveredRoutes.forEach(r => console.log(`   -> [${r.method}] ${r.path}`));
  console.log("\n--------------------------------------------------\n");

  // Preparar archivos temporales
  const videoBuffer = generateMockVideoBuffer();
  const tempVideoPath = path.join(__dirname, 'temp_render_25s.mp4');
  fs.writeFileSync(tempVideoPath, videoBuffer);

  const csvData = generate200ExcelRecords();
  const csvPath = path.join(__dirname, 'temp_meta_200.csv');
  fs.writeFileSync(csvPath, csvData);

  /* ==========================================================================
     SIMULACIÓN DINÁMICA POR ENDPOINTS
     ========================================================================== */
  
  for (const route of discoveredRoutes) {
    const moduleKey = `ROUTE_${route.method}_${route.path.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    if (!shouldRunTest(moduleKey)) continue;

    try {
      let req;

      // Configurar método HTTP
      if (route.method === 'GET') {
        req = request.get(route.path).query({ clientId: 'CLIENT-#01', userEmail: 'test@sodie.ai' });
      } else if (route.method === 'POST') {
        req = request.post(route.path);

        // Si la ruta maneja subidas de archivos (media/excel)
        if (route.path.includes('video') || route.path.includes('media')) {
          req = req.attach('video', tempVideoPath).field('clientId', 'CLIENT-#01');
        } else if (route.path.includes('excel') || route.path.includes('upload') || route.path.includes('connect')) {
          req = req.attach('file', csvPath).field('clientId', 'CLIENT-#01');
        } else {
          // Payload estándar JSON para simular flujos B2B
          req = req.send({
            clientId: 'CLIENT-#01',
            userEmail: 'test@sodie.ai',
            message: 'Hola, iniciando simulación B2B',
            campaignId: 'CMP-META-01',
            adminKey: process.env.ADMIN_KEY || 'SODIE_ADMIN_SECRET',
            usersPayload: [
              { email: 'cliente1@sodie.app', phone: '584120000000', value: 150, country: 'VE' }
            ],
            dailyBudget: 2000
          });
        }
      } else if (route.method === 'PUT') {
        req = request.put(route.path).send({ clientId: 'CLIENT-#01' });
      } else if (route.method === 'DELETE') {
        req = request.delete(route.path).send({ clientId: 'CLIENT-#01' });
      }

      const res = await req;

      // Validación de códigos esperados (200, 201, 302 o 401/403 si requiere credenciales privadas)
      if ([200, 201, 302, 401, 403].includes(res.status)) {
        logPass(moduleKey, `Endpoint [${route.method}] ${route.path}`, `Respondió con HTTP ${res.status}`);
      } else {
        logFail(
          moduleKey,
          `Endpoint [${route.method}] ${route.path}`,
          `HTTP ${res.status} - ${JSON.stringify(res.body || res.text).substring(0, 150)}`,
          "index.js / Controller",
          `Comprueba la lógica de la función asociada a [${route.method}] ${route.path}`
        );
      }
    } catch (err) {
      logFail(
        moduleKey,
        `Endpoint [${route.method}] ${route.path}`,
        err.message,
        "Router Execution",
        "Error inesperado durante la ejecución de la petición."
      );
    }
  }

  /* ==========================================================================
     AUDITORÍA DE FRONTEND (IDs Clave en Plantillas HTML)
     ========================================================================== */
  const K_FRONTEND = "FRONTEND_FULL_AUDIT";
  if (shouldRunTest(K_FRONTEND)) {
    console.log("\n🌐 Iniciando auditoría estática de Frontend (Plantillas y IDs exactos)...");
    
    const pagesToTest = [
      { 
        html: 'admin.html', 
        requiredSelectors: [
          'id="timer"', 
          'id="btn-biometria"', 
          'id="ia3-roas-comparison"', 
          'id="input-video-sodie"'
        ] 
      },
      { 
        html: 'client.html', 
        requiredSelectors: [
          'id="client-container"', 
          'id="sodie-cycle-timer"', 
          'id="btn-auth-biometric-client"', 
          'id="btn-meta-ads-direct-link"'
        ] 
      },
      { html: 'index.html', requiredSelectors: ['<body'] },
      { html: 'contrato.html', requiredSelectors: ['<body'] }
    ];

    for (const pageItem of pagesToTest) {
      try {
        const res = await request.get(`/${pageItem.html}`);

        if (res.status === 200) {
          const htmlContent = res.text || '';
          const missingSelectors = pageItem.requiredSelectors.filter(s => !htmlContent.includes(s));

          if (missingSelectors.length === 0) {
            logPass(K_FRONTEND, `Frontend: ${pageItem.html}`, "Plantilla HTML activa con todos sus IDs y componentes.");
          } else {
            logFail(
              K_FRONTEND,
              `Frontend: ${pageItem.html}`,
              `Faltan selectores o IDs en la vista: ${missingSelectors.join(', ')}`,
              `public/${pageItem.html}`,
              "Asegúrate de que los IDs del frontend coincidan con los esperados por los scripts."
            );
          }
        } else {
          logFail(
            K_FRONTEND,
            `Frontend: ${pageItem.html}`,
            `HTTP ${res.status}`,
            `public/${pageItem.html}`,
            `La vista /${pageItem.html} no devolvió 200 OK.`
          );
        }
      } catch (err) {
        logFail(K_FRONTEND, `Frontend: ${pageItem.html}`, err.message, "public/", "Error al consultar las plantillas HTML.");
      }
    }
  }

  // Limpieza de temporales
  if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
  if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);

  /* ==========================================================================
     RESUMEN FINAL
     ========================================================================== */
  console.log("\n==================================================");
  console.log("📊 RESULTADO DEL DIAGNÓSTICO TOTAL v5.0");
  console.log("==================================================");

  if (REPORT.failed.length > 0) {
    const remainingFails = REPORT.failed.map(f => f.key);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify({ failedModules: remainingFails }, null, 2));

    console.log(`❌ SE ENCONTRARON ${REPORT.failed.length} ERRORES/ADVERTENCIAS A CORREGIR:`);
    REPORT.failed.forEach((item, idx) => {
      console.log(`\n${idx + 1}. Módulo/Ruta: ${item.module}`);
      console.log(`   Ubicación: ${item.location}`);
      console.log(`   Error: ${item.error}`);
      console.log(`   Causa sugerida: ${item.causa}`);
    });
  } else {
    if (fs.existsSync(HISTORY_FILE)) fs.unlinkSync(HISTORY_FILE);
    console.log("🎉 ¡EXCELENTE! Todas las rutas declaradas en index.js y las vistas del Frontend respondieron de manera impecable.");
  }
}

// Ejecutar la simulación
runAllSimulations();
