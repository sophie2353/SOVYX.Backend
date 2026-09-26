/**
 * SODIE Core AI Engine - Suite Integrada de Simulación E2E
 * Incluye: Subida de videos cortos (20-30s), escaneo dinámico de rutas de Express,
 * módulos IA2/IA3, Meta Graph API, Auth Admin, Contratos y Frontend Playwright.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const supertest = require('supertest');

// 1. Apuntar directamente a la URL del backend en producción / Render
const BASE_URL = process.env.BACKEND_URL || 'https://api.sodie.app';
const request = supertest(BASE_URL);

const HISTORY_FILE = path.join(__dirname, '.test-history.json');

const REPORT = {
  passed: [],
  failed: []
};

// Leer historia de fallas anteriores
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

// Genera un buffer sintáctico de video MP4 (~25s mockup)
function generateMockVideoBuffer() {
  const header = Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, // ftyp box
    0x6d, 0x70, 0x34, 0x32, 0x00, 0x00, 0x00, 0x00, 
    0x6d, 0x70, 0x34, 0x32, 0x69, 0x73, 0x6f, 0x6d
  ]);
  const dummyPayload = Buffer.alloc(1024 * 50, 0xAA);
  return Buffer.concat([header, dummyPayload]);
}

async function runAllSimulations() {
  console.log("\n👺💅🏽 === INICIANDO SIMULACIÓN INTEGRAL SODIE v3.5 ===");
  console.log(`🎯 Objetivo del Backend: ${BASE_URL}`);

  if (isReTestMode) {
    console.log(`🔄 MODO RE-PRUEBA ACTIVO: Re-evaluando únicamente los ${previousFailedModules.length} módulos con fallas...\n`);
  } else {
    console.log("🌐 MODO COMPLETO ACTIVO: Evaluando suite E2E en Render por primera vez...\n");
  }

  /* ==========================================================================
     1. SUBIDA DE VIDEO DESDE ADMIN.JS HACIA EL BACKEND
     ========================================================================== */
  const K_VIDEO_UPLOAD = "ADMIN_VIDEO_UPLOAD";
  if (shouldRunTest(K_VIDEO_UPLOAD)) {
    try {
      const videoBuffer = generateMockVideoBuffer();
      const tempVideoPath = path.join(__dirname, 'temp_render_25s.mp4');
      fs.writeFileSync(tempVideoPath, videoBuffer);

      const res = await request
        .post('/api/video/upload')
        .field('clientId', 'CLIENT-#01')
        .field('durationSeconds', '25')
        .field('sourceModule', 'admin.js')
        .attach('videoFile', tempVideoPath, 'render_25s.mp4');

      if (res.status === 200 || res.status === 201) {
        logPass(K_VIDEO_UPLOAD, "Admin Frontend -> Backend: Subida de Video", "Video de 25s recibido y procesado correctamente.");
      } else {
        logFail(
          K_VIDEO_UPLOAD,
          "Admin Frontend -> Backend: Subida de Video",
          `HTTP ${res.status} - ${JSON.stringify(res.body || res.text)}`,
          "routes/video.js",
          "La ruta POST de subida no existe o el campo esperado no coincide con 'videoFile'."
        );
      }

      if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
    } catch (err) {
      logFail(K_VIDEO_UPLOAD, "Subida de Video (20-30s)", err.message, "index.js", "Error al procesar la transmisión del archivo MP4.");
    }
  }

  /* ==========================================================================
     2. AUDITORÍA AUTOMÁTICA DE RUTAS REGISTRADAS
     ========================================================================== */
  const K_ROUTES_SCAN = "BACKEND_EXPRESS_ROUTES";
  if (shouldRunTest(K_ROUTES_SCAN)) {
    try {
      let registeredRoutes = [];

      // Si existe el objeto app local lo inspecciona, si no, ejecuta un barrido predeterminado
      if (typeof app !== 'undefined' && app._router && app._router.stack) {
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
        extractRoutes(app._router.stack);
      } else {
        // Fallback para pruebas HTTP remotas en Render
        registeredRoutes = [
          { path: '/api/v1/media/upload', method: 'POST' },
          { path: '/api/ia/ia2/segmentar', method: 'POST' },
          { path: '/api/ia/ia3/optimizar', method: 'POST' },
          { path: '/api/admin/update-password', method: 'POST' }
        ];
      }

      console.log(`🔥 [ROUTES SCANNER] Evaluando ${registeredRoutes.length} endpoints en ${BASE_URL}...`);
      let failedRoutesCount = 0;

      for (const route of registeredRoutes) {
        const testPath = route.path.replace(/:[a-zA-Z0-9_]+/g, 'test_param_123');

        try {
          let res;
          if (route.method === 'GET') res = await request.get(testPath);
          else if (route.method === 'POST') res = await request.post(testPath).send({ test: "ping", clientId: "CLIENT-#01" });
          else if (route.method === 'PUT') res = await request.put(testPath).send({ test: "ping" });
          else if (route.method === 'DELETE') res = await request.delete(testPath);

          if (res && res.status >= 500) {
            failedRoutesCount++;
            logFail(
              K_ROUTES_SCAN,
              `Endpoint [${route.method}] ${route.path}`,
              `HTTP ${res.status} - ${res.text ? res.text.substring(0, 150) : 'Internal Error'}`,
              "Controlador asociado",
              "Excepción no capturada o error interno de servidor (500)."
            );
          }
        } catch (routeErr) {
          failedRoutesCount++;
          logFail(
            K_ROUTES_SCAN,
            `Endpoint [${route.method}] ${route.path}`,
            routeErr.message,
            "Ruta / Middleware",
            "Falla de conexión o middleware colapsado."
          );
        }
      }

      if (failedRoutesCount === 0 && registeredRoutes.length > 0) {
        logPass(K_ROUTES_SCAN, "Escaneo de Rutas", `Las rutas respondieron sin crashes HTTP 500.`);
      }

    } catch (err) {
      logFail(K_ROUTES_SCAN, "Escaneo Masivo de Rutas", err.message, "index.js", "Error general durante el escaneo.");
    }
  }

  /* ==========================================================================
     3. BACKEND: EXCEL / CSV DE AUDIENCIA
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
        logPass(K_EXCEL, "Backend: Carga Excel/CSV", "Archivo enviado e inyectado correctamente.");
      } else {
        logFail(K_EXCEL, "Backend: Carga Excel/CSV", `HTTP ${res.status}`, "routes/media.js", "Error en el parser CSV o middleware de carga.");
      }
      if (fs.existsSync(dummyCsvPath)) fs.unlinkSync(dummyCsvPath);
    } catch (err) {
      logFail(K_EXCEL, "Backend: Carga Excel/CSV", err.message, "routes/media.js", "Error al procesar la solicitud.");
    }
  }

  /* ==========================================================================
     4. MÓDULOS IA (IA2 Y IA3)
     ========================================================================== */
  const K_IA = "BACKEND_IA_ENGINES";
  if (shouldRunTest(K_IA)) {
    try {
      const resIA2 = await request.post('/api/ia/ia2/segmentar').send({ prompt: "Test B2B" });
      const resIA3 = await request.post('/api/ia/ia3/optimizar').send({ campaignId: "CMP-01", metrics: { roas: 2.5 } });

      if (resIA2.status === 200 && resIA3.status === 200) {
        logPass(K_IA, "Backend: Motores IA2 e IA3", "Módulos de IA operativos.");
      } else {
        logFail(K_IA, "Backend: Motores IA2 e IA3", `IA2: HTTP ${resIA2.status} | IA3: HTTP ${resIA3.status}`, "routes/ia.js", "Falta API Key o endpoint inaccesible.");
      }
    } catch (err) {
      logFail(K_IA, "Backend: Motores IA2 e IA3", err.message, "routes/ia.js", "Falla al conectar con los servicios de IA.");
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
        logPass(K_AUTH, "Backend: Auth Admin", "Endpoint de credenciales verificado.");
      } else {
        logFail(K_AUTH, "Backend: Auth Admin", `HTTP ${res.status}`, "routes/admin.js", "Respuesta inesperada al actualizar credenciales.");
      }
    } catch (err) {
      logFail(K_AUTH, "Backend: Auth Admin", err.message, "routes/admin.js", "Error en el manejador de contraseñas.");
    }
  }

  /* ==========================================================================
     6. FRONTEND: AUDITORÍA PLAYWRIGHT
     ========================================================================== */
  const K_FRONTEND = "FRONTEND_FULL_AUDIT";
  if (shouldRunTest(K_FRONTEND)) {
    console.log(" 🌐 Iniciando auditoría de Frontend con Playwright...");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();

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

        if (item.html === 'admin.html') {
          const timerExists = await page.$('#timer, .timer, [data-timer]');
          if (!timerExists) {
            logFail(K_FRONTEND, `Admin: Timers`, "Elemento del timer no encontrado", "admin.html", "Falta ID '#timer' o clase '.timer'.");
          }

          const bioBtn = await page.$('#btn-biometria, #btn-inicio, .btn-biometric, #btn-login');
          if (bioBtn) {
            await bioBtn.click({ force: true, timeout: 1000 }).catch(e => {
              logFail(K_FRONTEND, `Admin: Botón Biometría`, e.message, "admin.js", "Falla al ejecutar clic en el botón.");
            });
          } else {
            logFail(K_FRONTEND, `Admin: Botón Biometría`, "Botón no encontrado", "admin.html", "Falta ID '#btn-biometria' o '#btn-inicio'.");
          }
        }

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
            `Excepción JS detectada en ${item.html}.`
          );
        } else {
          logPass(K_FRONTEND, `Frontend (${item.html} / ${item.js})`, "Cargado y validado sin errores en consola.");
        }

      } catch (err) {
        logFail(K_FRONTEND, `Frontend (${item.html})`, err.message, item.html, `No se pudo acceder a ${item.url}.`);
      } finally {
        await page.close();
      }
    }

    await browser.close();
  }

  /* ==========================================================================
     RESUMEN FINAL
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
      console.log(`   Ubicación: ${item.location}`);
      console.log(`   Error: ${item.error}`);
      console.log(`   Causa sugerida: ${item.causa}`);
    });
  } else {
    if (fs.existsSync(HISTORY_FILE)) {
      fs.unlinkSync(HISTORY_FILE);
    }
    console.log("🎉 ¡EXCELENTE! Todas las pruebas pasaron al 100%.");
  }
}

runAllSimulations();
