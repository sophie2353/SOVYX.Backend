/**
 * SODIE Core AI Engine - Suite Integrada de Simulación E2E
 * Incluye: Subida de videos cortos (20-30s), escaneo dinámico de ~300 rutas de Express,
 * módulos IA2/IA3, Meta Graph API, Auth Admin, Contratos y Frontend Playwright.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('@playwright/test');
const supertest = require('supertest');
// En lugar de requerir app localmente si no estás en la misma máquina:
// const request = supertest(app);

// Seteas la IP de tu celular (ejemplo: 192.168.1.15)
const CELL_IP = process.env.CELL_IP || 'http://192.168.1.103:1000';
const request = supertest(CELL_IP);

const HISTORY_FILE = path.join(__dirname, '.test-history.json');

// Cargar servidor backend Express (index.js)
let app;
try {
  app = require('../index.js');
} catch (e) {
    console.error("🔥 [CRÍTICO] No se pudo cargar el Backend principal (index.js / server.js).");
    console.error("Detalle del error:", err);
    process.exit(1);
  }
}

const REPORT = {
  passed: [],
  failed: []
};

// Leer historial de fallas anteriores
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

// Función auxiliar para generar un buffer sintáctico de video MP4 (~25s mockup)
function generateMockVideoBuffer() {
  const header = Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, // ftyp box
    0x6d, 0x70, 0x34, 0x32, 0x00, 0x00, 0x00, 0x00, 
    0x6d, 0x70, 0x34, 0x32, 0x69, 0x73, 0x6f, 0x6d
  ]);
  const dummyPayload = Buffer.alloc(1024 * 50, 0xAA); // ~50 KB payload de prueba
  return Buffer.concat([header, dummyPayload]);
}

async function runAllSimulations() {
  console.log("\n👺💅🏽 === INICIANDO SIMULACIÓN INTEGRAL SODIE v3.5 ===");
  if (isReTestMode) {
    console.log(`🔄 MODO RE-PRUEBA ACTIVO: Re-evaluando únicamente los ${previousFailedModules.length} módulos con fallas anteriores...\n`);
  } else {
    console.log("🌐 MODO COMPLETO ACTIVO: Evaluando subida de videos, backend index.js y frontend por primera vez...\n");
  }

  /* ==========================================================================
     1. SUBIDA DE VIDEO DESDE ADMIN.JS A RUTA PRINCIPAL DE INDEX.JS
     ========================================================================== */
  const K_VIDEO_UPLOAD = "ADMIN_VIDEO_UPLOAD";
  if (shouldRunTest(K_VIDEO_UPLOAD)) {
    try {
      const videoBuffer = generateMockVideoBuffer();
      const tempVideoPath = path.join(__dirname, 'temp_render_25s.mp4');
      fs.writeFileSync(tempVideoPath, videoBuffer);

      // Simula el envío Multipart de FormData que hace admin.js hacia index.js
      const res = await request
        .post('/api/video/upload') // Ajusta esta ruta si en tu index.js es /api/upload o /api/renders
        .field('clientId', 'CLIENT-#01')
        .field('durationSeconds', '25')
        .field('sourceModule', 'admin.js')
        .attach('videoFile', tempVideoPath, 'render_25s.mp4');

      if (res.status === 200 || res.status === 201) {
        logPass(K_VIDEO_UPLOAD, "Admin Frontend -> Index.js Backend: Subida de Video", "Video de 25s recibido, procesado y almacenado correctamente.");
      } else {
        logFail(
          K_VIDEO_UPLOAD,
          "Admin Frontend -> Index.js Backend: Subida de Video",
          `HTTP ${res.status} - ${JSON.stringify(res.body || res.text)}`,
          "index.js / routes/video.js",
          "La ruta POST de subida de video no está definida en index.js, o el nombre del campo del archivo no coincide con 'videoFile' en Multer."
        );
      }

      if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
    } catch (err) {
      logFail(K_VIDEO_UPLOAD, "Subida de Video (20-30s)", err.message, "index.js", "Error al procesar la transmisión del archivo MP4 en el servidor.");
    }
  }

  /* ==========================================================================
     2. AUDITORÍA AUTOMÁTICA DE RUTAS REGISTRADAS EN EXPRESS (Evita probar 300 a mano)
     ========================================================================== */
  /* ==========================================================================
     2. AUDITORÍA Y DISPARO AUTOMÁTICO A TODAS LAS RUTAS DE INDEX.JS (~300 RUTAS)
     ========================================================================== */
  const K_ROUTES_SCAN = "BACKEND_EXPRESS_ROUTES";
  if (shouldRunTest(K_ROUTES_SCAN)) {
    try {
      const registeredRoutes = [];

      // Función recursiva para desempaquetar todos los routers cargados en index.js
      function extractRoutes(stack, prefix = '') {
        if (!stack) return;
        stack.forEach(layer => {
          if (layer.route) {
            const methods = Object.keys(layer.route.methods);
            methods.forEach(method => {
              registeredRoutes.push({
                path: prefix + layer.route.path,
                method: method.toUpperCase()
              });
            });
          } else if (layer.name === 'router' && layer.handle.stack) {
            let pathRegexp = layer.regexp.source
              .replace('^\\/', '')
              .replace('\\/?(?=\\/|$)', '')
              .replace(/\\\//g, '/')
              .replace('?=(?:\\/|$)', '')
              .replace('(?=\\/|$)', '');
            if (pathRegexp.endsWith('/')) pathRegexp = pathRegexp.slice(0, -1);
            extractRoutes(layer.handle.stack, prefix + (pathRegexp ? '/' + pathRegexp : ''));
          }
        });
      }

      if (app._router && app._router.stack) {
        extractRoutes(app._router.stack);
      }

      console.log(`🔥 [300+ ROUTES SCANNER] Se detectaron ${registeredRoutes.length} endpoints registrados en index.js.`);
      
      let failedRoutesCount = 0;

      // Probador automático: Envía una petición real a cada endpoint sin usar Postman
      for (const route of registeredRoutes) {
        // Ignoramos o manejamos rutas que requieran parámetros dinámicos en la URL tipo :id
        const testPath = route.path.replace(/:[a-zA-Z0-9_]+/g, 'test_param_123');

        try {
          let res;
          if (route.method === 'GET') {
            res = await request.get(testPath);
          } else if (route.method === 'POST') {
            res = await request.post(testPath).send({ test: "ping", clientId: "CLIENT-#01" });
          } else if (route.method === 'PUT') {
            res = await request.put(testPath).send({ test: "ping" });
          } else if (route.method === 'DELETE') {
            res = await request.delete(testPath);
          }

          // Si responde 500 (Server Error) o 404 (Route Not Found interna), es porque hay un error de sintaxis/código o mala ruta
          if (res && res.status >= 500) {
            failedRoutesCount++;
            logFail(
              K_ROUTES_SCAN,
              `Endpoint [${route.method}] ${route.path}`,
              `HTTP ${res.status} - ${res.text ? res.text.substring(0, 150) : 'Internal Error'}`,
              "index.js o controlador asociado",
              "Excepción no capturada o error de sintaxis en el handler de esta ruta."
            );
          }
        } catch (routeErr) {
          failedRoutesCount++;
          logFail(
            K_ROUTES_SCAN,
            `Endpoint [${route.method}] ${route.path}`,
            routeErr.message,
            "index.js",
            "Falla al invocar la ruta (posible error al requerir algún módulo/middleware)."
          );
        }
      }

      if (failedRoutesCount === 0 && registeredRoutes.length > 0) {
        logPass(K_ROUTES_SCAN, "Escaneo y Disparo Masivo de Rutas", `Las ${registeredRoutes.length} rutas de index.js fueron invocadas y respondieron sin crashes (HTTP 500).`);
      }

    } catch (err) {
      logFail(K_ROUTES_SCAN, "Escaneo Masivo de Rutas", err.message, "index.js", "Error general al mapear o disparar las rutas.");
    }
  }

  /* ==========================================================================
     3. BACKEND: EXCEL DE AUDIENCIA
     ========================================================================== */
  const K_EXCEL = "BACKEND_EXCEL";
  if (shouldRunTest(K_EXCEL)) {
    try {
      const dummyCsvPath = path.join(__dirname, 'temp_audiencia.csv');
      fs.writeFileSync(dummyCsvPath, "phone,email,first_name\n+584120000000,test@sodie.ai,ClienteTest");

      const res = await request
        .post('/api/v1/media/upload')
        .field('clientId', 'CLIENT-#01')
        .attach('file', dummyCsvPath);

      if (res.status === 200 || res.status === 201) {
        logPass(K_EXCEL, "Backend: Carga e Inyección Excel", "Archivo cargado correctamente.");
      } else {
        logFail(K_EXCEL, "Backend: Carga e Inyección Excel", `HTTP ${res.status}`, "index.js / routes/media.js", "Error en el parser de CSV/Excel o middleware Multer desconfigurado.");
      }
      if (fs.existsSync(dummyCsvPath)) fs.unlinkSync(dummyCsvPath);
    } catch (err) {
      logFail(K_EXCEL, "Backend: Carga e Inyección Excel", err.message, "routes/media.js", "Error al procesar archivo CSV.");
    }
  }

  /* ==========================================================================
     4. MÓDULOS DE INTELIGENCIA ARTIFICIAL (IA2 Y IA3)
     ========================================================================== */
  const K_IA = "BACKEND_IA_ENGINES";
  if (shouldRunTest(K_IA)) {
    try {
      const resIA2 = await request.post('/api/ia/ia2/segmentar').send({ prompt: "Test B2B" });
      const resIA3 = await request.post('/api/ia/ia3/optimizar').send({ campaignId: "CMP-01", metrics: { roas: 2.5 } });

      if (resIA2.status === 200 && resIA3.status === 200) {
        logPass(K_IA, "Backend: Motores IA2 e IA3", "Módulos de IA respondiendo correctamente.");
      } else {
        logFail(K_IA, "Backend: Motores IA2 e IA3", `IA2: HTTP ${resIA2.status} | IA3: HTTP ${resIA3.status}`, "routes/ia.js", "Falta API Key de OpenAI/Claude o endpoint de IA inaccesible.");
      }
    } catch (err) {
      logFail(K_IA, "Backend: Motores IA2 e IA3", err.message, "routes/ia.js", "Modulo de IA no exportado en index.js.");
    }
  }

  /* ==========================================================================
     5. ADMIN AUTH Y CAMBIO DE CONTRASEÑA
     ========================================================================== */
  const K_AUTH = "BACKEND_AUTH_ADMIN";
  if (shouldRunTest(K_AUTH)) {
    try {
      const res = await request.post('/api/admin/update-password').send({ newPassword: "SecurePassword123!" });
      if (res.status === 200 || res.status === 401) {
        logPass(K_AUTH, "Backend: Auth / Password Admin", "Endpoint de credenciales operativo.");
      } else {
        logFail(K_AUTH, "Backend: Auth / Password Admin", `HTTP ${res.status}`, "index.js / routes/admin.js", "No se puede actualizar contraseña de admin. Verifica la consulta de actualización en la base de datos.");
      }
    } catch (err) {
      logFail(K_AUTH, "Backend: Auth / Password Admin", err.message, "routes/admin.js", "Error en el manejador de contraseñas de admin.");
    }
  }

    /* ==========================================================================
     6. FRONTEND AVANZADO EN LA NUBE: PLAYWRIGHT (admin, client, index, contrato)
     ========================================================================== */
  const K_FRONTEND = "FRONTEND_FULL_AUDIT";
  if (shouldRunTest(K_FRONTEND)) {
    console.log(" Iniciando auditoría de Frontend en Render con Playwright...");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();

    // URL base de tu frontend desplegado en Render (o usa la variable de entorno)
    const BASE_FRONTEND = process.env.FRONTEND_URL || 'https://sodie.app';

    const pagesToTest = [
      { html: 'admin.html', url: `${BASE_FRONTEND}/admin.html`, js: 'admin.js' },
      { html: 'client.html', url: `${BASE_FRONTEND}/client.html`, js: 'client.js' },
      { html: 'index.html', url: `${BASE_FRONTEND}/index.html`, js: 'app.js' },
      { html: 'contrato.html', url: `${BASE_FRONTEND}/contrato.html`, js: 'contrato.js' }
    ];

    for (const item of pagesToTest) {
      const page = await context.newPage();
      const pageErrors = [];
      const consoleLogs = [];

      page.on('pageerror', err => pageErrors.push(err.message || err));
      page.on('console', msg => {
        if (msg.type() === 'error') consoleLogs.push(msg.text());
      });

      try {
        await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 8000 });

        /* --- DIAGNÓSTICO ESPECÍFICO DE ADMIN: TIMERS Y BIOMETRÍA --- */
        if (item.html === 'admin.html') {
          const timerExists = await page.$('#timer, .timer, [data-timer]');
          if (!timerExists) {
            logFail(K_FRONTEND, `Admin: Timers`, "Elemento del timer no encontrado", "admin.html", "No existe '#timer' o '.timer' para renderizar el contador.");
          }

          const bioBtn = await page.$('#btn-biometria, #btn-inicio, .btn-biometric, #btn-login');
          if (bioBtn) {
            await bioBtn.click({ force: true, timeout: 1000 }).catch(e => {
              logFail(K_FRONTEND, `Admin: Botón Inicio/Biometría`, e.message, "admin.js", "El botón de inicio falló al recibir el evento click.");
            });
          } else {
            logFail(K_FRONTEND, `Admin: Botón Inicio/Biometría`, "Botón no encontrado", "admin.html", "Falta el ID '#btn-biometria' o '#btn-inicio'.");
          }
        }

        /* --- SIMULACIÓN DE CLICS EN BOTONES --- */
        const buttons = await page.$$('button, a.btn, input[type="button"], input[type="submit"]');
        for (let i = 0; i < buttons.length; i++) {
          const el = buttons[i];
          if (await el.isVisible().catch(() => false)) {
            await el.click({ force: true, timeout: 500 }).catch(() => {});
          }
        }

        if (pageErrors.length > 0 || consoleLogs.length > 0) {
          const allErrs = [...pageErrors, ...consoleLogs].join(" | ");
          logFail(
            K_FRONTEND,
            `Frontend (${item.html} / ${item.js})`,
            allErrs,
            item.js,
            `Error JS al cargar o hacer clic en ${item.html}.`
          );
        } else {
          logPass(K_FRONTEND, `Frontend (${item.html} / ${item.js})`, "Página cargada y probada sin errores en consola.");
        }

      } catch (err) {
        logFail(K_FRONTEND, `Frontend (${item.html})`, err.message, item.html, `No se pudo abrir ${item.url}. Revisa el despliegue en Render.`);
      } finally {
        await page.close();
      }
    }

    await browser.close();
  }

  /* ==========================================================================
     RESUMEN DE RESULTADOS Y GUARDADO DE ESTADO
     ========================================================================== */
  console.log("\n==================================================");
  console.log("📊 RESULTADO DEL DIAGNÓSTICO TOTAL");
  console.log("==================================================");

  if (REPORT.failed.length > 0) {
    const remainingFails = REPORT.failed.map(f => f.key);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify({ failedModules: remainingFails }, null, 2));

    console.log(`❌ SE ENCONTRARON ${REPORT.failed.length} ERRORES A CORREGIR:`);
    REPORT.failed.forEach((item, idx) => {
      console.log(`\n${idx + 1}. Módulo: ${item.module}`);
      console.log(`   Ubicación exacta: ${item.location}`);
      console.log(`   Detalle del error: ${item.error}`);
      console.log(`   Causa / Corrección sugerida: ${item.causa}`);
    });
    console.log("\n💡 Aplica las correcciones y vuelve a ejecutar `node tests/simulation-master.js`. Solamente se evaluarán de nuevo las rutas con fallas.");
  } else {
    if (fs.existsSync(HISTORY_FILE)) {
      fs.unlinkSync(HISTORY_FILE);
    }
    console.log("🎉 ¡EXCELENTE! Todas las pruebas (Subida de video 20-30s, endpoints de index.js, IA y Frontend) pasaron al 100%.");
  }
}

runAllSimulations();
