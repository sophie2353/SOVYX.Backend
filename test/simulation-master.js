/**
 * SODIE Core AI Engine - Suite de Auditoría Frontend ↔ Backend v11.0
 * 
 * - 0 Simulaciones de datos/endpoints.
 * - Registro exclusivo en `.test-history-Frontend.json`.
 * - Mapeo estático de IDs, onclicks, biometría, timer, videos y endpoints entre HTML/JS y Express.
 * - Reporte de errores con línea exacta y código de solución.
 */

const fs = require('fs');
const path = require('path');
const supertest = require('supertest');

// ==========================================================================
// CONFIGURACIÓN Y ARCHIVO DE HISTORIAL FRONTEND
// ==========================================================================
const BASE_URL_FRONTEND = process.env.FRONTEND_URL || 'https://sodie.app';
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const FRONTEND_HISTORY_FILE = path.join(__dirname, '.test-history-Frontend.json');

const REPORT = {
  passed: [],
  failed: [],
  discoveredRoutes: [],
  missingRoutesInFrontend: []
};

function logFail(moduleKey, moduleName, errorMsg, location, causa, lineExacta, solucion) {
  REPORT.failed.push({ 
    key: moduleKey, 
    module: moduleName, 
    error: errorMsg, 
    location, 
    causa,
    lineaExacta: lineExacta || 'N/A',
    solucion: solucion || 'Ajustar la referencia o declaración en el archivo correspondiente.'
  });

  console.log(`❌ [ERROR - ${moduleName}]`);
  console.log(`   📍 Ubicación: ${location} (Línea o Bloque: ${lineExacta || 'N/A'})`);
  console.log(`   ⚠️ Detalle: ${errorMsg}`);
  console.log(`   💡 Causa: ${causa}`);
  console.log(`   🔧 Solución Sugerida: ${solucion}\n`);
}

function logPass(moduleKey, moduleName, detail) {
  REPORT.passed.push({ key: moduleKey, module: moduleName, detail });
  console.log(`✅ [OK - ${moduleName}] ${detail}`);
}

/* ==========================================================================
   1. BUSCADOR DE LÍNEA EXACTA EN ARCHIVOS
   ========================================================================== */
function findExactLineInFile(filePath, searchText) {
  if (!fs.existsSync(filePath)) return null;
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(searchText)) {
      return i + 1; // Línea base 1
    }
  }
  return null;
}

/* ==========================================================================
   2. EXTRACTOR DE RUTAS REGISTRADAS EN INDEX.JS (BACKEND)
   ========================================================================== */
function extractAllRoutes(expressApp) {
  const routes = [];

  function cleanPrefix(regexSource) {
    if (!regexSource || regexSource === '^\\/?(?=\\/|$)') return '';

    let cleaned = regexSource
      .replace(/^\^\\?\/?/, '/')
      .replace(/\\\/|\//g, '/')
      .replace(/\(\?:\/\(\?=\$\vert{}\\\/\vert{}\$\)\)\?/g, '')
      .replace(/\/\?\(\?=\/\Vert{}\$\)/g, '')
      .replace(/\?\(\?=\/\Vert{}\$\)/g, '')
      .replace(/\$\/?$/g, '');

    if (cleaned.includes(',')) cleaned = cleaned.split(',')[0];
    if (cleaned.includes('|')) cleaned = cleaned.split('|')[0];

    cleaned = cleaned.replace(/[\^\$\?\*\+\(\)]/g, '');

    if (!cleaned.startsWith('/')) cleaned = '/' + cleaned;
    return cleaned.replace(/\/+/g, '/');
  }

  function print(pathPrefix, layer) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
      const subPaths = Array.isArray(layer.route.path) 
        ? layer.route.path 
        : String(layer.route.path).split(',');

      subPaths.forEach(rawSubPath => {
        let cleanSub = rawSubPath.trim();
        if (cleanSub.includes('|')) cleanSub = cleanSub.split('|')[0];
        cleanSub = cleanSub.replace(/[\^\$\?\*\+\(\)]/g, '');

        methods.forEach(method => {
          let fullPath = (pathPrefix + cleanSub).replace(/\/+/g, '/');
          if (fullPath.length > 1 && fullPath.endsWith('/')) {
            fullPath = fullPath.slice(0, -1);
          }
          routes.push({ method, path: fullPath });
        });
      });
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      let extraPrefix = '';
      if (layer.regexp && layer.regexp.source) {
        extraPrefix = cleanPrefix(layer.regexp.source);
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
    !r.path.includes('*') &&
    r.path !== '/'
  );
}

/* ==========================================================================
   3. MAPA DE ESTRUCTURA FRONTEND
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
      { id: 'desc-semana-3', type: 'ID Desc Semana-3', selector: 'id="desc-semana-3"' },
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
   4. AUDITORÍA ESPECÍFICA: BIA, CLAVE TEMPORAL, TIMERS Y VIDEO DEMO
   ========================================================================== */
function auditAdminClientSpecialFlows() {
  console.log("\n🔐 Auditoría de Flujos Especiales: Acceso Admin por Clave, Biometría, Timers y Video...");

  // 1. Acceso Admin por Clave Temporal & ByPass Biométrico
  const adminJsPath = path.join(PUBLIC_DIR, 'js/admin.js');
  if (fs.existsSync(adminJsPath)) {
    const adminJs = fs.readFileSync(adminJsPath, 'utf8');

    // Verificar si el formulario o botón de clave temporal existe y no requiere WebAuthn obligatoriamente
    const hasPassHandler = adminJs.includes('POST') && (adminJs.includes('/api/admin/login') || adminJs.includes('password'));
    if (!hasPassHandler) {
      const line = findExactLineInFile(adminJsPath, 'btn-admin-login-pass') || 1;
      logFail(
        'ADMIN_LOGIN_PASS_FAIL',
        'Acceso por Clave Temporal Admin',
        'El script admin.js no maneja el envío directo de la contraseña temporal al endpoint /api/admin/login',
        'public/js/admin.js',
        'El botón de login por clave no responde o se queda esperando la confirmación biométrica.',
        line,
        'Añadir manejador click en #btn-admin-login-pass enviando fetch POST a /api/admin/login con { password }.'
      );
    } else {
      logPass('ADMIN_LOGIN_PASS_OK', 'Acceso por Clave Temporal Admin', 'Configurado para validar clave en backend.');
    }

    // Verificar Biometría Admin
    const hasBiometricFallback = adminJs.includes('PublicKeyCredential') || adminJs.includes('biometrics');
    if (!hasBiometricFallback) {
      const line = findExactLineInFile(adminJsPath, 'step-biometric') || 1;
      logFail(
        'ADMIN_BIOMETRIC_FAIL',
        'Soporte de Biometría Admin',
        'El frontend lanza error o no responde en navegadores sin soporte WebAuthn/Biometría',
        'public/js/admin.js',
        'No hay chequeo previo window.PublicKeyCredential antes de iniciar el reto biométrico.',
        line,
        'Añadir bloque try/catch y fallback visual cuando window.PublicKeyCredential no esté disponible.'
      );
    }

    // Verificar Subida y Emisión de Video hacia el Frontend
    const hasVideoUpload = adminJs.includes('/api/v1/media/upload') || adminJs.includes('upload-video') || adminJs.includes('sodieSubirVideoDemo');
    if (!hasVideoUpload) {
      const line = findExactLineInFile(adminJsPath, 'btn-upload-video') || 1;
      logFail(
        'ADMIN_VIDEO_UPLOAD_FAIL',
        'Envío de Video Demo desde Admin',
        'El script admin.js no tiene la función para subir/transmitir el video a la vista de cliente/index',
        'public/js/admin.js',
        'El botón #btn-upload-video no ejecuta sodieSubirVideoDemo() ni actualiza el tag <video src="...">.',
        line,
        'Implementar sodieSubirVideoDemo() usando FormData y actualizando la URL devuelta en localStorage o DOM.'
      );
    } else {
      logPass('ADMIN_VIDEO_UPLOAD_OK', 'Envío de Video Demo desde Admin', 'El controlador de subida de video está presente.');
    }
  }

  // 2. Transmisión del Video en index.html
  const indexHtmlPath = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexHtmlPath)) {
    const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
    const hasVideoTag = indexHtml.includes('id="sodie-demo-video"') || indexHtml.includes('id="card-demo-video"');
    if (!hasVideoTag) {
      logFail(
        'INDEX_VIDEO_TAG_MISSING',
        'Tag de Video Demo en index.html',
        'Falta el elemento <video id="sodie-demo-video"> para reproducir el video cargado por el admin',
        'public/index.html',
        'Al subir un video desde el admin, la vista principal no tiene el ID objetivo para incrustarlo.',
        1,
        'Agregar <video id="sodie-demo-video" controls autoplay class="w-full"></video> dentro de #card-demo-video.'
      );
    } else {
      logPass('INDEX_VIDEO_TAG_OK', 'Tag de Video Demo en index.html', 'Elemento encontrado correctamente.');
    }
  }

  // 3. Revisión de Timers (admin.js y client.js)
  const clientJsPath = path.join(PUBLIC_DIR, 'js/client.js');
  if (fs.existsSync(clientJsPath)) {
    const clientJs = fs.readFileSync(clientJsPath, 'utf8');
    const hasTimerLogic = clientJs.includes('setInterval') && (clientJs.includes('timer-24h-display') || clientJs.includes('timer-main-display') || clientJs.includes('timer'));
    if (!hasTimerLogic) {
      const line = findExactLineInFile(clientJsPath, 'timer-24h-display') || 1;
      logFail(
        'CLIENT_TIMER_FAIL',
        'Cronómetro/Timer 24h Cliente',
        'El timer no responde o permanece estático en 00:00:00',
        'public/js/client.js',
        'No se está ejecutando un setInterval activo actualizando el innerText de los IDs de temporizador.',
        line,
        'Implementar función sodieIniciarCronometro24h() ejecutando setInterval cada 1000ms.'
      );
    } else {
      logPass('CLIENT_TIMER_OK', 'Cronómetro/Timer 24h Cliente', 'Sincronización de timer detectada.');
    }
  }
}

/* ==========================================================================
   5. AUDITORÍA JS Y VINCULARIDAD DE ELEMENTOS
   ========================================================================== */
/* ==========================================================================
   5. AUDITORÍA JS Y VINCULARIDAD DE ELEMENTOS
   ========================================================================== */
function auditFrontendJSFiles() {
  console.log("\n📜 Auditando vincularidad JS ↔ HTML en public/js/...");

  FRONTEND_AUDIT_MAP.forEach(pageConfig => {
    if (!pageConfig.jsFile) return;

    const jsPath = path.join(PUBLIC_DIR, pageConfig.jsFile);
    if (!fs.existsSync(jsPath)) {
      logFail(
        `JS_MISSING_${pageConfig.jsFile}`,
        `Archivo JS faltante: ${pageConfig.jsFile}`,
        `No existe el archivo de scripts en ${jsPath}`,
        `public/${pageConfig.jsFile}`,
        "El botón/vista no funcionará porque el script asociado no existe.",
        1,
        `Crear el archivo public/${pageConfig.jsFile} e incluirlo en ${pageConfig.html}.`
      );
      return;
    }

    const jsContent = fs.readFileSync(jsPath, 'utf8');

    pageConfig.elements.forEach(elem => {
      // Ignorar contenedores/secciones estáticas que no requieren listener en JS obligatoriamente
      const isInteractive = elem.id && (elem.id.startsWith('btn-') || elem.id.startsWith('input-') || elem.id.includes('file') || elem.id.includes('pass'));

      if (elem.id && isInteractive) {
        const idReferenced = jsContent.includes(elem.id);
        if (!idReferenced) {
          const lineHtml = findExactLineInFile(path.join(PUBLIC_DIR, pageConfig.html), elem.id) || 'N/A';
          logFail(
            `JS_ID_MISMATCH_${pageConfig.jsFile}_${elem.id}`,
            `Selector Inexistente: #${elem.id}`,
            `El elemento interactivo '${elem.id}' de ${pageConfig.html} no se está escuchando en ${pageConfig.jsFile}`,
            `public/${pageConfig.jsFile}`,
            `El botón/input no reacciona porque ${pageConfig.jsFile} no le hace getElementById('${elem.id}') ni addEventListener.`,
            `Línea HTML: ${lineHtml}`,
            `Agregar listener para '#${elem.id}' en public/${pageConfig.jsFile}.`
          );
        } else {
          logPass(`JS_ID_OK_${pageConfig.jsFile}_${elem.id}`, `Selector #${elem.id}`, `El JS escucha y manipula el elemento.`);
        }
      }

      if (elem.fn) {
        const fnName = elem.fn.replace(/\(\)/g, '');
        const fnDefined = jsContent.includes(`function ${fnName}`) || jsContent.includes(`${fnName} =`) || jsContent.includes(`${fnName}(`);
        if (!fnDefined) {
          const lineHtml = findExactLineInFile(path.join(PUBLIC_DIR, pageConfig.html), fnName) || 'N/A';
          logFail(
            `JS_FN_MISSING_${pageConfig.jsFile}_${fnName}`,
            `Evento Inexistente: ${fnName}()`,
            `El evento onclick '${fnName}()' de ${pageConfig.html} no está definido en ${pageConfig.jsFile}`,
            `public/${pageConfig.jsFile}`,
            `El botón arroja ReferenceError: ${fnName} is not defined al hacer clic.`,
            `Línea HTML: ${lineHtml}`,
            `Declarar window.${fnName} o function ${fnName}() en public/${pageConfig.jsFile}.`
          );
        } else {
          logPass(`JS_FN_OK_${pageConfig.jsFile}_${fnName}`, `Evento ${fnName}()`, `La función está declarada correctamente.`);
        }
      }
    });
  });
}

/* ==========================================================================
   6. AUDITORÍA INTEGRAL FRONTEND ↔ BACKEND
   ========================================================================== */
async function runFrontendAudit(targetApp) {
  let app = targetApp || global.expressApp;

  if (!app) {
    try {
      app = require('../index');
    } catch (e) {
      console.error("❌ Fallback de carga Express:", e.message);
    }
  }

  if (!app) {
    console.error("❌ Error crítico: No se encontró la app de Express.");
    return;
  }

  const request = supertest(app);

  console.log("\n🤠👺 === INICIANDO AUDITORÍA INTEGRAL DE FRONTEND ↔ BACKEND ===");
  console.log(`URL Base: ${BASE_URL_FRONTEND}`);

  // A. AUDITORÍA DE ARCHIVOS JS Y SUS ELEMENTOS
  auditFrontendJSFiles();

  // B. AUDITORÍA DE BIA, CLAVE TEMPORAL, TIMERS Y VIDEO
  auditAdminClientSpecialFlows();

  // C. OBTENER RUTAS EXPRESS EN INDEX.JS
  const discoveredRoutes = extractAllRoutes(app);
  REPORT.discoveredRoutes = discoveredRoutes;

  console.log(`\n🔍 Rutas activas encontradas en index.js: ${discoveredRoutes.length}`);
  discoveredRoutes.forEach(r => console.log(`   -> [${r.method}] ${r.path}`));

  // D. VERIFICACIÓN DE VISTAS HTML
  console.log("\n🌐 Auditando integridad de vistas HTML...");
  for (const pageConfig of FRONTEND_AUDIT_MAP) {
    const pageKey = `FRONTEND_VIEW_${pageConfig.html.replace('.', '_')}`;

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
          logPass(pageKey, `Vista HTML: /${pageConfig.html}`, `Contiene todos sus selectores, IDs e instancias onclick.`);
        } else {
          logFail(
            pageKey,
            `Vista HTML: /${pageConfig.html}`,
            `Faltan elementos estructurales:\n      - ` + missingElements.join('\n      - '),
            `public/${pageConfig.html}`,
            "El JS intenta engancharse a elementos que no existen en el DOM de esta plantilla HTML.",
            "N/A",
            "Añadir los IDs/onclicks faltantes en el HTML correspondiente."
          );
        }
      } else {
        logFail(
          pageKey,
          `Vista HTML: /${pageConfig.html}`,
          `Código de respuesta: HTTP ${resStatus}`,
          `public/${pageConfig.html}`,
          `El servidor no puede servir el archivo /${pageConfig.html}. Revisa express.static().`,
          "index.js",
          "Asegurarse de incluir app.use(express.static(path.join(__dirname, '../public'))); en index.js."
        );
      }
    } catch (err) {
      logFail(pageKey, `Vista HTML: /${pageConfig.html}`, err.message, `public/${pageConfig.html}`, "Error al intentar leer la vista.", "N/A", "Verificar permisos de archivo o existencia de la plantilla.");
    }
  }

  // E. MAPEO DE LLAMADAS DESDE EL JS HACIA EL BACKEND (INDEX.JS)
  console.log("\n🔌 Mapeando llamadas de red en JS contra endpoints de index.js...");
  const backendPaths = discoveredRoutes.map(r => r.path);

  FRONTEND_AUDIT_MAP.forEach(pageConfig => {
    const jsPath = path.join(PUBLIC_DIR, pageConfig.jsFile);
    if (!fs.existsSync(jsPath)) return;

    const jsContent = fs.readFileSync(jsPath, 'utf8');
    const fetchMatches = jsContent.match(/(?:fetch|axios\.(?:get|post|put|delete))\s*\(\s*['"`]([^'"`]+)['"`]/g) || [];

    fetchMatches.forEach(match => {
      const extractedPath = match.replace(/^(?:fetch|axios\.(?:get|post|put|delete))\s*\(\s*['"`]/, '');
      
      if (extractedPath.startsWith('/') && !extractedPath.startsWith('//')) {
        const cleanPath = extractedPath.split('?')[0];
        const routeExists = backendPaths.some(bp => bp === cleanPath || cleanPath.startsWith(bp));

        if (!routeExists) {
          const lineExact = findExactLineInFile(jsPath, cleanPath) || 'N/A';
          logFail(
            `BROKEN_ENDPOINT_${cleanPath}`,
            `Llamada Frontend ↔ Backend Rota: ${cleanPath}`,
            `El script ${pageConfig.jsFile} intenta hacer fetch a '${cleanPath}', pero no está declarada en index.js`,
            `public/${pageConfig.jsFile}`,
            `Al hacer clic en el botón se genera un error 404 Not Found porque la ruta Express no existe.`,
            lineExact,
            `Crear el endpoint en index.js o en su router correspondiente (ej. app.post('${cleanPath}', ...)).`
          );
        } else {
          logPass(`ENDPOINT_OK_${cleanPath}`, `Conexión de Endpoint '${cleanPath}'`, `Existe y coincide con index.js.`);
        }
      }
    });
  });

  /* ==========================================================================
     F. ESCRITURA EXCLUSIVA EN .test-history-Frontend.json
     ========================================================================== */
  const historyData = {
    updatedAt: new Date().toISOString(),
    summary: {
      passed: REPORT.passed.length,
      failed: REPORT.failed.length,
      routesCount: REPORT.discoveredRoutes.length
    },
    failedElements: REPORT.failed
  };

  fs.writeFileSync(FRONTEND_HISTORY_FILE, JSON.stringify(historyData, null, 2), 'utf8');
  console.log(`\n💾 Historial guardado en: .test-history-Frontend.json`);

  /* ==========================================================================
     G. RESUMEN EN CONSOLA
     ========================================================================== */
  console.log("\n==================================================");
  console.log("📊 RESUMEN DE LA AUDITORÍA FRONTEND ↔ BACKEND");
  console.log("==================================================");

  if (REPORT.failed.length > 0) {
    console.log(`❌ SE ENCONTRARON ${REPORT.failed.length} BOTONES/ELEMENTOS CON PROBLEMAS:\n`);
    REPORT.failed.forEach((item, idx) => {
      console.log(`${idx + 1}. Elemento: ${item.module}`);
      console.log(`   📍 Ubicación: ${item.location} (Línea: ${item.lineaExacta})`);
      console.log(`   ⚠️ Detalle: ${item.error}`);
      console.log(`   💡 Por qué no funciona: ${item.causa}`);
      console.log(`   🔧 Solución: ${item.solucion}\n`);
    });
  } else {
    console.log("🎉 🤠🙌🏼 ¡PERFECTO! Todos los botones, biometría, timers, videos, eventos onclick e IDs de las vistas coinciden con los JS y los endpoints de index.js.");
  }
}

// Exportar para ejecución directa o módulo
if (require.main === module) {
  runFrontendAudit();
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
      await runFrontendAudit(appInstance);
    } catch (error) {
      console.error("Error en auditoría Frontend:", error?.message || error);
    } finally {
      console.log = oldLog;
    }

    if (res && typeof res.status === 'function') {
      return res.status(200).json({
        success: REPORT.failed.length === 0,
        historyFile: '.test-history-Frontend.json',
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
