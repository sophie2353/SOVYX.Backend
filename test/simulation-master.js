/**
 * SODIE Core AI Engine - Suite Integrada de Simulación E2E v8.0
 * (Full E2E Frontend HTML & JS Audit + Dynamic Backend Route Engine + Multi-Repo Support)
 * 
 * - Valida existencia de IDs, selectores, inputs y onclicks en Vistas HTML.
 * - Módulo E2E: Inspecciona los archivos JS del cliente en public/js/.
 * - Realiza pruebas de endpoints descubiertos en index.js.
 * - Procesa y limpia el historial de errores previos (.test-history.json).
 */

const fs = require('fs');
const path = require('path');
const supertest = require('supertest');

// ==========================================================================
// CONFIGURACIÓN DE RUTAS Y FRONTEND EXTERNO
// ==========================================================================
const BASE_URL_FRONTEND = process.env.FRONTEND_URL || 'https://sodie.app';
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const HISTORY_FILE = path.join(__dirname, '.test-history.json');

const REPORT = {
  passed: [],
  failed: [],
  discoveredRoutes: [],
  jsAudits: []
};

// Carga de historial de errores
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
   1. EXTRACTOR DINÁMICO DE RUTAS EXPRESS
   ========================================================================== */
function extractAllRoutes(expressApp) {
  const routes = [];

  function print(pathPrefix, layer) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
      methods.forEach(method => {
        routes.push({ method, path: pathPrefix + layer.route.path });
      });
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
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

  if (expressApp && expressApp._router && expressApp._router.stack) {
    expressApp._router.stack.forEach(layer => {
      print('', layer);
    });
  }

  return routes.filter((r, idx, self) => 
    self.findIndex(t => t.method === r.method && t.path === r.path) === idx &&
    !r.path.includes('*')
  );
}

// Generadores Auxiliares de Datos
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

/* ==========================================================================
   2. MAPA MAESTRO DE SELECTORES Y CORRESPONDENCIA JS (public/js/)
   ========================================================================== */
const FRONTEND_AUDIT_MAP = [
  {
    html: 'index.html',
    jsFile: 'js/app.js',
    elements: [
      { id: 'card-demo-video', type: 'ID Section', selector: 'id="card-demo-video"' },
      { id: 'sodie-demo-video', type: 'ID Video', selector: 'id="sodie-demo-video"' },
      { id: 'ia3-calculator-analyzer', type: 'ID Section IA3', selector: 'id="ia3-calculator-analyzer"' },
      { id: 'btn-ia3-analizar', type: 'ID Botón IA3', selector: 'id="btn-ia3-analizar"' },
      { id: 'ia3-modal-result', type: 'ID Modal IA3', selector: 'id="ia3-modal-result"' },
      { id: 'pf-card', type: 'ID Section Pago Final', selector: 'id="pf-card"' },
      { id: 'btn-iniciar-pago', type: 'ID Botón Iniciar Pago', selector: 'id="btn-iniciar-pago"' },
      { id: 'pf-step-billing', type: 'ID Billing / UserFB', selector: 'id="pf-step-billing"' },
      { id: 'btn-procesar-pago-pasarela', type: 'ID Botón Pago Pasarela', selector: 'id="btn-procesar-pago-pasarela"' },
      { id: 'pf-step-excel', type: 'ID Step Excel', selector: 'id="pf-step-excel"' },
      { id: 'btn-client-upload-file', type: 'ID Botón Upload Excel', selector: 'id="btn-client-upload-file"' },
      { id: 'pf-waitlist-block', type: 'ID Waitlist Block', selector: 'id="pf-waitlist-block"' },
      { id: 'btn-waitlist-access', type: 'ID Botón Waitlist Access', selector: 'id="btn-waitlist-access"' },
      { id: 'timer-main-display', type: 'ID Main Timer Display', selector: 'id="timer-main-display"' }
    ]
  },
  {
    html: 'admin.html',
    jsFile: 'js/admin.js',
    elements: [
      { id: 'admin-login-view', type: 'ID Admin Login View', selector: 'id="admin-login-view"' },
      { id: 'step-password', type: 'ID Step Password Input', selector: 'id="step-password"' },
      { id: 'btn-admin-login-pass', type: 'ID Botón Pass Login', selector: 'id="btn-admin-login-pass"' },
      { id: 'step-biometric', type: 'ID Biometric Step', selector: 'id="step-biometric"' },
      { id: 'admin-biometric', type: 'ID Botón Admin Biometrics', selector: 'id="admin-biometric"' },
      { fn: 'sodieCerrarSesionAdmin', type: 'OnClick Cerrar Sesión', selector: 'sodieCerrarSesionAdmin()' },
      { id: 'admin-timer-display', type: 'ID Admin Timer Display', selector: 'id="admin-timer-display"' },
      { fn: 'sodieIniciarCronometro24h', type: 'OnClick Iniciar Cronómetro', selector: 'sodieIniciarCronometro24h()' },
      { fn: 'sodiePausarCronometro', type: 'OnClick Pausar Cronómetro', selector: 'sodiePausarCronometro()' },
      { fn: 'sodieReiniciarCronometro', type: 'OnClick Reiniciar Cronómetro', selector: 'sodieReiniciarCronometro()' },
      { id: 'dashboard-video', type: 'ID Dashboard Video Container', selector: 'id="dashboard-video"' },
      { id: 'btn-upload-video', type: 'ID Botón Upload Video', selector: 'id="btn-upload-video"' },
      { fn: 'sodieSubirVideoDemo', type: 'OnClick Subir Video Demo', selector: 'sodieSubirVideoDemo()' },
      { id: 'admin-excel-id', type: 'ID Admin Excel Container', selector: 'id="admin-excel-id"' },
      { id: 'admin-excel-file', type: 'ID Admin Excel Input File', selector: 'id="admin-excel-file"' },
      { id: 'btn-upload-excel', type: 'ID Botón Upload Excel', selector: 'id="btn-upload-excel"' },
      { fn: 'sodieInyectarExcel', type: 'OnClick Inyectar Excel', selector: 'sodieInyectarExcel()' },
      { id: 'admin-activate-close', type: 'ID Activar Campaña Block', selector: 'id="admin-activate-close"' },
      { id: 'btn-admin-activate-campaign', type: 'ID Botón Activate Campaign', selector: 'id="btn-admin-activate-campaign"' },
      { fn: 'sodieConfirmarActivacion', type: 'OnClick Confirmar Activación', selector: 'sodieConfirmarActivacion()' },
      { id: 'btn-close-waitlist', type: 'ID Botón Close Waitlist', selector: 'id="btn-close-waitlist"' },
      { fn: 'sodieCerrarListaEspera', type: 'OnClick Cerrar Lista Espera', selector: 'sodieCerrarListaEspera()' }
    ]
  },
  {
    html: 'client.html',
    jsFile: 'js/client.js',
    elements: [
      { id: 'toast-notification', type: 'ID Toast Notification', selector: 'id="toast-notification"' },
      { id: 'toast-title', type: 'ID Toast Title', selector: 'id="toast-title"' },
      { id: 'toast-body', type: 'ID Toast Body', selector: 'id="toast-body"' },
      { id: 'client-auth-view', type: 'ID Client Auth View', selector: 'id="client-auth-view"' },
      { id: 'app-dashboard', type: 'ID App Dashboard', selector: 'id="app-dashboard"' },
      { id: 'client-id-badge', type: 'ID Client ID Badge', selector: 'id="client-id-badge"' },
      { id: 'header-brand-title', type: 'ID Header Brand Title', selector: 'id="header-brand-title"' },
      { id: 'client-login-box', type: 'ID Client Login Box', selector: 'id="client-login-box"' },
      { id: 'btn-client-biometric-login', type: 'ID Botón Client Biometric Login', selector: 'id="btn-client-biometric-login"' },
      { fn: 'sodieLoginBiometricoCliente', type: 'OnClick Login Biométrico', selector: 'sodieLoginBiometricoCliente()' },
      { fn: 'sodieMostrarRegistroBiometrico', type: 'OnClick Mostrar Registro', selector: 'sodieMostrarRegistroBiometrico()' },
      { id: 'client-register-box', type: 'ID Client Register Box', selector: 'id="client-register-box"' },
      { id: 'client-email-reg', type: 'ID Client Email Input', selector: 'id="client-email-reg"' },
      { id: 'btn-client-biometric-reg', type: 'ID Botón Biometric Reg', selector: 'id="btn-client-biometric-reg"' },
      { fn: 'sodieRegistrarBiometriaCliente', type: 'OnClick Registrar Biometría', selector: 'sodieRegistrarBiometriaCliente()' },
      { fn: 'sodieOcultarRegistroBiometrico', type: 'OnClick Ocultar Registro', selector: 'sodieOcultarRegistroBiometrico()' },
      { id: 'client-auth-error', type: 'ID Client Auth Error', selector: 'id="client-auth-error"' },
      { id: 'metrics-slider', type: 'ID Metrics Slider Container', selector: 'id="metrics-slider"' },
      { id: 'metric-spend', type: 'ID Metric Spend', selector: 'id="metric-spend"' },
      { id: 'metric-spend-status', type: 'ID Metric Spend Status', selector: 'id="metric-spend-status"' },
      { id: 'metric-reach', type: 'ID Metric Reach', selector: 'id="metric-reach"' },
      { id: 'metric-reach-status', type: 'ID Metric Reach Status', selector: 'id="metric-reach-status"' },
      { id: 'metric-visitors', type: 'ID Metric Visitors', selector: 'id="metric-visitors"' },
      { id: 'metric-activos', type: 'ID Metric Activos', selector: 'id="metric-activos"' },
      { id: 'card-injection-flow', type: 'ID Card Injection Flow', selector: 'id="card-injection-flow"' },
      { id: 'timer-24h-display', type: 'ID Timer 24h Display', selector: 'id="timer-24h-display"' },
      { id: 'client-file-input', type: 'ID Client File Input', selector: 'id="client-file-input"' },
      { id: 'btn-client-upload-excel', type: 'ID Botón Client Upload Excel', selector: 'id="btn-client-upload-excel"' },
      { id: 'btn-client-activate-campaign', type: 'ID Botón Client Activate Campaign', selector: 'id="btn-client-activate-campaign"' },
      { id: 'weekly-payment-lock-warning', type: 'ID Weekly Payment Lock Warning', selector: 'id="weekly-payment-lock-warning"' },
      { id: 'timer-weekly-pay-display', type: 'ID Timer Weekly Pay Display', selector: 'id="timer-weekly-pay-display"' },
      { id: 'payment-options-container', type: 'ID Payment Options Container', selector: 'id="payment-options-container"' },
      { id: 'btn-pay-semana1', type: 'ID Botón Pay Semana 1', selector: 'id="btn-pay-semana1"' },
      { id: 'desc-semana-1', type: 'ID Desc Semana 1', selector: 'id="desc-semana-1"' },
      { id: 'btn-pay-semana2', type: 'ID Botón Pay Semana 2', selector: 'id="btn-pay-semana2"' },
      { id: 'desc-semana-2', type: 'ID Desc Semana 2', selector: 'id="desc-semana-2"' },
      { id: 'btn-pay-semana3', type: 'ID Botón Pay Semana 3', selector: 'id="btn-pay-semana3"' },
      { id: 'desc-semana-3', type: 'ID Desc Semana 3', selector: 'id="desc-semana-3"' },
      { id: 'section-week-4-complete', type: 'ID Section Week 4 Complete', selector: 'id="section-week-4-complete"' },
      { id: 'global-timer-display', type: 'ID Global Timer Display', selector: 'id="global-timer-display"' }
    ]
  },
  {
    html: 'contrato.html',
    jsFile: 'js/contrato.js',
    elements: [
      { id: 'signature-box', type: 'ID Signature Box Audit', selector: 'id="signature-box"' },
      { id: 'contract-form', type: 'ID Contract Form', selector: 'id="contract-form"' },
      { id: 'user_fullname', type: 'ID User Fullname Input', selector: 'id="user_fullname"' },
      { id: 'user_email', type: 'ID User Email Input', selector: 'id="user_email"' },
      { id: 'ip_address', type: 'ID IP Address Input', selector: 'id="ip_address"' },
      { id: 'timestamp', type: 'ID Timestamp Input', selector: 'id="timestamp"' },
      { id: 'accept_terms', type: 'ID Checkbox Accept Terms', selector: 'id="accept_terms"' }
    ]
  },
  {
    html: 'confirmacion.html',
    jsFile: 'js/app.js',
    elements: [
      { id: 'main-card', type: 'ID Main Card Container', selector: 'id="main-card"' },
      { id: 'conf-badge', type: 'ID Conf Badge', selector: 'id="conf-badge"' },
      { id: 'conf-title', type: 'ID Conf Title', selector: 'id="conf-title"' },
      { id: 'conf-body', type: 'ID Conf Body', selector: 'id="conf-body"' },
      { id: 'loader-box', type: 'ID Loader Box', selector: 'id="loader-box"' },
      { id: 'steps-container', type: 'ID Steps Container', selector: 'id="steps-container"' },
      { id: 'conf-action-btn', type: 'ID Conf Action Button', selector: 'id="conf-action-btn"' },
      { id: 'conf-verify-btn', type: 'ID Conf Verify Button', selector: 'id="conf-verify-btn"' }
    ]
  }
];

/* ==========================================================================
   3. AUDITORÍA DE ARCHIVOS JAVASCRIPT DEL CLIENTE
   ========================================================================== */
function auditFrontendJSFiles() {
  console.log("\n📜 Auditando correspondencia entre HTML e integración JavaScript (public/js/)...");

  FRONTEND_AUDIT_MAP.forEach(pageConfig => {
    if (!pageConfig.jsFile) return;

    const jsPath = path.join(PUBLIC_DIR, pageConfig.jsFile);
    if (!fs.existsSync(jsPath)) {
      logFail(`JS_MISSING_${pageConfig.jsFile}`, `Script Frontend: ${pageConfig.jsFile}`, `No existe en la ruta ${jsPath}`, `public/${pageConfig.jsFile}`, "Si el frontend está en otro repo, sincroniza las vistas/scripts en public/ o configura FRONTEND_URL.");
      return;
    }

    const jsContent = fs.readFileSync(jsPath, 'utf8');

    pageConfig.elements.forEach(elem => {
      if (elem.id) {
        const idReferenced = jsContent.includes(elem.id);
        if (!idReferenced) {
          logFail(
            `JS_ID_MISMATCH_${pageConfig.jsFile}_${elem.id}`,
            `Sincronización JS: ${pageConfig.jsFile} ↔ #${elem.id}`,
            `El ID '${elem.id}' de ${pageConfig.html} no se referencia en ${pageConfig.jsFile}`,
            `public/${pageConfig.jsFile}`,
            `Revisa si el script selecciona el elemento con getElementById('${elem.id}') o querySelector('#${elem.id}').`
          );
        } else {
          logPass(`JS_ID_OK_${pageConfig.jsFile}_${elem.id}`, `Sincronización JS: ${pageConfig.jsFile} ↔ #${elem.id}`, `ID vinculado correctamente.`);
        }
      }

      if (elem.fn) {
        const fnName = elem.fn.replace(/\(\)/g, '');
        const fnDefined = jsContent.includes(`function ${fnName}`) || jsContent.includes(`${fnName} =`) || jsContent.includes(`${fnName}(`);
        if (!fnDefined) {
          logFail(
            `JS_FN_MISSING_${pageConfig.jsFile}_${fnName}`,
            `Sincronización JS: ${pageConfig.jsFile} ↔ ${fnName}()`,
            `La función '${fnName}()' declarada en ${pageConfig.html} no se encuentra definida en ${pageConfig.jsFile}`,
            `public/${pageConfig.jsFile}`,
            `Define 'function ${fnName}()' o asigna 'window.${fnName} = ...' en el archivo JS.`
          );
        } else {
          logPass(`JS_FN_OK_${pageConfig.jsFile}_${fnName}`, `Sincronización JS: ${pageConfig.jsFile} ↔ ${fnName}()`, `Función declarada.`);
        }
      }
    });
  });
}

/* ==========================================================================
   4. FUNCIÓN PRINCIPAL DE SIMULACIÓN
   ========================================================================== */
async function runAllSimulations(targetApp) {
  let app = targetApp || global.expressApp;

  if (!app) {
    try {
      app = require('../index');
    } catch (e) {
      console.error("❌ Fallback de carga en simulación:", e.message);
    }
  }

  if (!app) {
    console.error("❌ Error crítico: No se encontró la instancia de la app de Express.");
    return;
  }

  const request = supertest(app);

  console.log("\n👺💅🏽 === INICIANDO SIMULACIÓN INTEGRAL SODIE v8.0 ===");
  if (isReTestMode) {
    console.log(`⚠️ MODO RE-TEST ACTIVADO: Reevaluando ${previousFailedModules.length} errores registrados previamente en .test-history.json`);
  }
  console.log(`URL Frontend de Referencia Configurada: ${BASE_URL_FRONTEND}`);

  // A. AUDITORÍA DE ARCHIVOS JS
  auditFrontendJSFiles();

  // B. DESCUBRIMIENTO DE RUTAS EN EXPRESS
  const discoveredRoutes = extractAllRoutes(app);
  REPORT.discoveredRoutes = discoveredRoutes;
  
  console.log(`\n🔍 Total de rutas registradas en index.js: ${discoveredRoutes.length}`);
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
     C. PRUEBAS DE ENDPOINTS DINÁMICOS
     ========================================================================== */
  for (const route of discoveredRoutes) {
    const moduleKey = `ROUTE_${route.method}_${route.path.replace(/[^a-zA-Z0-9]/g, '_')}`;
    if (!shouldRunTest(moduleKey)) continue;

    try {
      let req;
      if (route.method === 'GET') {
        req = request.get(route.path).query({ clientId: 'CLIENT-#01', userEmail: 'test@sodie.ai' });
      } else if (route.method === 'POST') {
        req = request.post(route.path);

        if (route.path.includes('video') || route.path.includes('media')) {
          req = req.attach('video', tempVideoPath).field('clientId', 'CLIENT-#01');
        } else if (route.path.includes('excel') || route.path.includes('upload') || route.path.includes('connect')) {
          req = req.attach('file', csvPath).field('clientId', 'CLIENT-#01');
        } else {
          req = req.send({
            clientId: 'CLIENT-#01',
            userEmail: 'test@sodie.ai',
            message: 'Simulación B2B SODIE',
            campaignId: 'CMP-META-01',
            adminKey: process.env.ADMIN_KEY || 'SODIE_ADMIN_SECRET',
            usersPayload: [{ email: 'cliente1@sodie.app', phone: '584120000000', value: 150, country: 'VE' }],
            dailyBudget: 2000
          });
        }
      } else if (route.method === 'PUT') {
        req = request.put(route.path).send({ clientId: 'CLIENT-#01' });
      } else if (route.method === 'DELETE') {
        req = request.delete(route.path).send({ clientId: 'CLIENT-#01' });
      }

      const res = await req;
      const resStatus = res?.status || 500;

      if ([200, 201, 302, 401, 403].includes(resStatus)) {
        logPass(moduleKey, `Endpoint [${route.method}] ${route.path}`, `Respondió con HTTP ${resStatus}`);
      } else {
        const bodyPreview = res?.body || res?.text ? JSON.stringify(res.body || res.text).substring(0, 150) : "Sin respuesta de red";
        logFail(
          moduleKey,
          `Endpoint [${route.method}] ${route.path}`,
          `HTTP ${resStatus} - ${bodyPreview}`,
          "index.js / Controller",
          `Comprueba la lógica interna de la función asignada a la ruta [${route.method}] ${route.path}`
        );
      }
    } catch (err) {
      logFail(moduleKey, `Endpoint [${route.method}] ${route.path}`, err.message, "Router Execution", "Error de ejecución.");
    }
  }

  /* ==========================================================================
     D. AUDITORÍA PROFUNDA DE FRONTEND HTML
     ========================================================================== */
  console.log("\n🌐 Iniciando auditoría estática y profunda de Frontend HTML...");

  for (const pageConfig of FRONTEND_AUDIT_MAP) {
    const pageKey = `FRONTEND_VIEW_${pageConfig.html.replace('.', '_')}`;
    if (!shouldRunTest(pageKey)) continue;

    try {
      const res = await request.get(`/${pageConfig.html}`);
      const resStatus = res?.status || 500;

      if (resStatus === 200 && res?.text) {
        const htmlContent = res.text || '';
        const missingElements = [];

        pageConfig.elements.forEach(elem => {
          if (!htmlContent.includes(elem.selector)) {
            missingElements.push(`${elem.type} [${elem.selector}]`);
          }
        });

        if (missingElements.length === 0) {
          logPass(pageKey, `Frontend HTML: /${pageConfig.html}`, `Perfecto. Se encontraron los ${pageConfig.elements.length} IDs, Onclicks y selectores declarados.`);
        } else {
          logFail(
            pageKey,
            `Frontend HTML: /${pageConfig.html}`,
            `Faltan los siguientes ${missingElements.length} elementos en el HTML:\n      - ` + missingElements.join('\n      - '),
            `public/${pageConfig.html}`,
            "Revisa la plantilla HTML y asegúrate de añadir los IDs u onclicks faltantes."
          );
        }
      } else {
        logFail(
          pageKey,
          `Frontend HTML: /${pageConfig.html}`,
          `HTTP ${resStatus}`,
          `public/${pageConfig.html}`,
          `La vista /${pageConfig.html} no devolvió un código HTTP 200 OK en el servidor Express local.`
        );
      }
    } catch (err) {
      logFail(pageKey, `Frontend HTML: /${pageConfig.html}`, err.message, `public/${pageConfig.html}`, "No se pudo acceder a la vista HTML.");
    }
  }

  // Limpieza de temporales
  if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
  if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);

  /* ==========================================================================
     E. RESUMEN FINAL Y GESTIÓN DE TEST HISTORY
     ========================================================================== */
  console.log("\n==================================================");
  console.log("📊 RESULTADO DEL DIAGNÓSTICO TOTAL v8.0");
  console.log("==================================================");

  if (REPORT.failed.length > 0) {
    const remainingFails = REPORT.failed.map(f => f.key);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify({ failedModules: remainingFails }, null, 2));

    console.log(`❌ SE ENCONTRARON ${REPORT.failed.length} ERRORES O ELEMENTOS FALTANTES:`);
    REPORT.failed.forEach((item, idx) => {
      console.log(`\n${idx + 1}. Módulo/Vista: ${item.module}`);
      console.log(`   Ubicación: ${item.location}`);
      console.log(`   Detalle del Error:\n   ${item.error}`);
      console.log(`   Causa / Sugerencia: ${item.causa}`);
    });
  } else {
    if (fs.existsSync(HISTORY_FILE)) fs.unlinkSync(HISTORY_FILE);
    console.log("🎉 🗿🙌🏼 ¡EXCELENTE! Todos los errores registrados previamente fueron corregidos con éxito. La simulación ha pasado limpia.");
  }
}

// Exportar controlador para el endpoint en index.js o ejecutar en CLI
if (require.main === module) {
  runAllSimulations();
} else {
  module.exports = async (req, res) => {
    const oldLog = console.log;
    let logs = [];
    console.log = (...args) => {
      logs.push(args.join(' '));
      oldLog.apply(console, args);
    };

    try {
      const appInstance = req?.app || global.expressApp;
      await runAllSimulations(appInstance);
    } catch (error) {
      console.error("Error durante la simulación:", error?.message || error);
    } finally {
      console.log = oldLog;
    }

    if (res && typeof res.status === 'function') {
      return res.status(200).json({
        success: REPORT.failed.length === 0,
        summary: {
          passedCount: REPORT.passed.length,
          failedCount: REPORT.failed.length,
          discoveredRoutesCount: REPORT.discoveredRoutes.length
        },
        report: REPORT,
        executionLogs: logs
      });
    }
  };
}
