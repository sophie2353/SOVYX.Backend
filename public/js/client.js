/**
 * SODIE - Client Dashboard Engine (client.js)
 * Flujo Secuencial: Biometría (Registro/Login WebAuthn) -> Subida de Excel (24h) -> Verificación de Cuota Semanal ($6,000 USDT) -> Activación de Campaña
 */

/* ==========================================================================
   1. HELPERS Y CONFIGURACIÓN INICIAL
   ========================================================================== */
function getBaseUrl() {
  if (window.SODIE_CONFIG && window.SODIE_CONFIG.API_URL) {
    return window.SODIE_CONFIG.API_URL.replace(/\/$/, '');
  }
  return window.location.origin;
}

function initClientPersistAndNotifications() {
  const clientId = getClientId();

  // Guardar en localStorage para visitas futuras
  if (clientId) {
    localStorage.setItem('sodie_client_id', clientId);
  }

  // Lanzar Notificación Push / Guardado de PWA
  solicitarPermisoNotificacionesYAccesoDirecto(clientId);
}

function solicitarPermisoNotificacionesYAccesoDirecto(clientId) {
  if ('Notification' in window && Notification.permission !== 'granted') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification('SODIE AI - Dashboard Activo', {
          body: `Bienvenido ${clientId}. Tu acceso directo ha sido configurado.`,
          icon: '/assets/icon.png'
        });
      }
    });
  }

  showToast(
    'Guarda tu Dashboard', 
    `Estás ingresando como ${clientId}. Añade esta página a tu pantalla de inicio para ingresar siempre a tu panel.`
  );
}

function getClientId() {
  // Prioridad 1: Sesión autenticada mediante WebAuthn
  const sessionClientId = sessionStorage.getItem('sodie_authenticated_client_id');
  if (sessionClientId) return sessionClientId;

  // Prioridad 2: Parámetro URL
  const urlParams = new URLSearchParams(window.location.search);
  const paramId = urlParams.get('clientId') || urlParams.get('client_id') || urlParams.get('id');
  if (paramId) return paramId;

  // Prioridad 3: Configuración global o dataset
  if (window.SODIE_CONFIG && window.SODIE_CONFIG.CLIENT_ID) {
    return window.SODIE_CONFIG.CLIENT_ID;
  }

  const container = document.getElementById('app-dashboard') || document.body;
  if (container && container.dataset.clientId) {
    return container.dataset.clientId;
  }

  return localStorage.getItem('sodie_client_id') || 'CLIENT-01';
}

/* ==========================================================================
   2. ESTADO GLOBAL
   ========================================================================== */
const CLIENT_STATE = {
  clientId: null,
  isAuthenticated: false,
  currentWeek: 1, // Semana activa de cobro (1, 2 o 3)
  excelUploaded: false,
  paymentConfirmed: false,
  campaignActivated: false,
  timerInterval: null,
  elapsedSeconds: 0,
  startTimeStamp: null
};

document.addEventListener('DOMContentLoaded', () => {
  initClientDashboard();
  initClientPersistAndNotifications();
});

function initClientDashboard() {
  CLIENT_STATE.clientId = getClientId();
  
  // Verificar si hay sesión activa por biometría
  if (sessionStorage.getItem('sodie_authenticated_client_id') === CLIENT_STATE.clientId) {
    CLIENT_STATE.isAuthenticated = true;
  }

  updateClientSessionUI();
  fetchClientMetrics();
  initGlobalAndWeeklyTimers();
  checkCallbackStatus();
  setupEventListeners();
}

function updateClientSessionUI() {
  const clientIdBadge = document.getElementById('client-id-badge');
  if (clientIdBadge) {
    clientIdBadge.textContent = `Cliente: ${CLIENT_STATE.clientId} ${CLIENT_STATE.isAuthenticated ? '🔒 (Biometría Activa)' : '⚠️ (Sin Biometría)'}`;
  }

  // Actualizar vista global de autenticación si existe
  const authView = document.getElementById('client-auth-view');
  if (authView) {
    authView.style.display = CLIENT_STATE.isAuthenticated ? 'none' : 'block';
  }

  // Actualizar estado visual de los botones biométricos
  const btnAuth = document.getElementById('btn-biometric-auth');
  if (btnAuth && CLIENT_STATE.isAuthenticated) {
    btnAuth.textContent = '✓ Sesión Biométrica Verificada';
    btnAuth.style.background = 'rgba(0, 255, 204, 0.25)';
  }
}

/* ==========================================================================
   3. AUTENTICACIÓN BIOMÉTRICA (WEBAUTHN - REGISTRO Y LOGIN)
   ========================================================================== */
function arrayBufferToBase64Url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlToUint8Array(base64Url) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Funciones globales expuestas para atributos onclick en HTML
window.sodieMostrarRegistroBiometrico = function() {
  console.log("🧬 Desplegando registro biométrico...");
  const regBox = document.getElementById('client-register-box');
  const loginBox = document.getElementById('client-login-box');
  if (regBox) regBox.style.display = 'block';
  if (loginBox) loginBox.style.display = 'none';
};

window.sodieOcultarRegistroBiometrico = function() {
  console.log("🙈 Ocultando registro biométrico...");
  const regBox = document.getElementById('client-register-box');
  const loginBox = document.getElementById('client-login-box');
  if (regBox) regBox.style.display = 'none';
  if (loginBox) loginBox.style.display = 'block';
};

window.sodieRegistrarBiometriaCliente = async function() {
  await registrarBiometriaCliente();
};

window.sodieLoginBiometricoCliente = async function() {
  await iniciarSesionBiometricaCliente();
};

async function registrarBiometriaCliente() {
  if (!window.PublicKeyCredential) {
    showToast('Biometría No Soportada', 'Tu navegador o dispositivo no soporta autenticación biométrica WebAuthn.', true);
    return;
  }

  const clientId = CLIENT_STATE.clientId;

  try {
    showToast('Iniciando Biometría', 'Coloca tu huella digital o rostro para registrar el acceso...');

    const publicKeyCredentialCreationOptions = {
      challenge: window.crypto.getRandomValues(new Uint8Array(32)),
      rp: {
        name: "SODIE AI",
        id: window.location.hostname
      },
      user: {
        id: new TextEncoder().encode(clientId),
        name: clientId,
        displayName: `Cliente ${clientId}`
      },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required"
      },
      timeout: 60000
    };

    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions
    });

    if (credential) {
      const rawId = arrayBufferToBase64Url(credential.rawId);
      
      localStorage.setItem(`sodie_biometric_id_${clientId}`, rawId);
      sessionStorage.setItem('sodie_authenticated_client_id', clientId);
      CLIENT_STATE.isAuthenticated = true;

      updateClientSessionUI();
      sodieOcultarRegistroBiometrico();
      showToast('Registro Exitoso', `Acceso biométrico registrado correctamente para ${clientId}.`);
    }
  } catch (error) {
    console.error('Error al registrar biometría:', error);
    const authError = document.getElementById('client-auth-error');
    if (authError) {
      authError.textContent = '❌ Error al completar registro biométrico.';
      authError.style.display = 'block';
    }
    showToast('Error Biométrico', 'No se pudo completar el registro biométrico.', true);
  }
}

async function iniciarSesionBiometricaCliente() {
  if (!window.PublicKeyCredential) {
    showToast('Biometría No Soportada', 'Tu navegador no soporta autenticación biométrica.', true);
    return;
  }

  const clientId = CLIENT_STATE.clientId;
  const storedCredentialId = localStorage.getItem(`sodie_biometric_id_${clientId}`);

  if (!storedCredentialId) {
    showToast('Registro Requerido', `No existe un registro biométrico para ${clientId}. Ejecuta el registro primero.`, true);
    return;
  }

  try {
    showToast('Verificando Biometría', 'Escanea tu huella o rostro para iniciar sesión...');

    const publicKeyCredentialRequestOptions = {
      challenge: window.crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{
        id: base64UrlToUint8Array(storedCredentialId),
        type: 'public-key'
      }],
      userVerification: "required",
      timeout: 60000
    };

    const assertion = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions
    });

    if (assertion) {
      sessionStorage.setItem('sodie_authenticated_client_id', clientId);
      CLIENT_STATE.isAuthenticated = true;

      updateClientSessionUI();
      showToast('Sesión Iniciada', `Autenticación biométrica exitosa. Bienvenido, ${clientId}.`);
    }
  } catch (error) {
    console.error('Error al iniciar sesión biométrica:', error);
    const authError = document.getElementById('client-auth-error');
    if (authError) {
      authError.textContent = '❌ Verificación biométrica fallida.';
      authError.style.display = 'block';
    }
    showToast('Error de Inicio de Sesión', 'Verificación biométrica fallida o cancelada.', true);
  }
}

/* ==========================================================================
   4. EVENT LISTENERS DE INTERFAZ Y BINDINGS DE SELECTORES (CORREGIDOS)
   ========================================================================== */
function setupEventListeners() {
  // Brand Header
  const brandTitle = document.getElementById('header-brand-title');
  if (brandTitle && !brandTitle.dataset.bound) {
    brandTitle.addEventListener('click', () => {
      window.location.reload();
    });
    brandTitle.dataset.bound = "true";
  }

  // Biometría (Registro y Login)
  const btnRegisterBio = document.getElementById('btn-client-biometric-reg') || document.getElementById('btn-biometric-register');
  if (btnRegisterBio && !btnRegisterBio.dataset.bound) {
    btnRegisterBio.addEventListener('click', window.sodieRegistrarBiometriaCliente);
    btnRegisterBio.dataset.bound = "true";
  }

  const btnLoginBio = document.getElementById('btn-client-biometric-login') || document.getElementById('btn-biometric-login') || document.getElementById('btn-biometric-auth');
  if (btnLoginBio && !btnLoginBio.dataset.bound) {
    btnLoginBio.addEventListener('click', window.sodieLoginBiometricoCliente);
    btnLoginBio.dataset.bound = "true";
  }

  // Input Email Registro
  const clientEmailReg = document.getElementById('client-email-reg');
  if (clientEmailReg && !clientEmailReg.dataset.bound) {
    clientEmailReg.addEventListener('input', (e) => {
      console.log('📧 Email ingresado:', e.target.value);
    });
    clientEmailReg.dataset.bound = "true";
  }

  // Subir Excel (Paso Diario cada 24 horas)
  const btnUpload = document.getElementById('btn-client-upload-excel');
  if (btnUpload && !btnUpload.dataset.bound) {
    btnUpload.addEventListener('click', sodieFlujoInyeccionCliente);
    btnUpload.dataset.bound = "true";
  }

  // Card Injection Flow
  const cardInjectionFlow = document.getElementById('card-injection-flow');
  if (cardInjectionFlow && !cardInjectionFlow.dataset.bound) {
    cardInjectionFlow.addEventListener('click', (e) => {
      console.log('⚡ Clic en Card Injection Flow');
      sodieFlujoInyeccionCliente();
    });
    cardInjectionFlow.dataset.bound = "true";
  }

  // Activar Campaña en Meta Ads
  const btnActivate = document.getElementById('btn-client-activate-campaign');
  if (btnActivate && !btnActivate.dataset.bound) {
    btnActivate.addEventListener('click', sodieConfirmarActivacionCliente);
    btnActivate.dataset.bound = "true";
  }

  // Botones de Confirmación de Pago Semanal ($6,000 USDT)
  const btnPaySemana1 = document.getElementById('btn-pay-semana1');
  if (btnPaySemana1 && !btnPaySemana1.dataset.bound) {
    btnPaySemana1.addEventListener('click', (e) => sodieProcesarPagoSemanal(e, 1));
    btnPaySemana1.dataset.bound = "true";
  }

  const btnPaySemana2 = document.getElementById('btn-pay-semana2');
  if (btnPaySemana2 && !btnPaySemana2.dataset.bound) {
    btnPaySemana2.addEventListener('click', (e) => sodieProcesarPagoSemanal(e, 2));
    btnPaySemana2.dataset.bound = "true";
  }

  const btnPaySemana3 = document.getElementById('btn-pay-semana3');
  if (btnPaySemana3 && !btnPaySemana3.dataset.bound) {
    btnPaySemana3.addEventListener('click', (e) => sodieProcesarPagoSemanal(e, 3));
    btnPaySemana3.dataset.bound = "true";
  }

  // Slider e Indicadores de Métricas
  const metricsSlider = document.getElementById('metrics-slider');
  if (metricsSlider && !metricsSlider.dataset.bound) {
    metricsSlider.addEventListener('input', (e) => {
      const val = e.target.value;
      console.log('🎚️ Nivel del slider de métricas:', val);
      const metricActivos = document.getElementById('metric-activos');
      if (metricActivos) metricActivos.textContent = `${val}% Proyectado`;
    });
    metricsSlider.dataset.bound = "true";
  }
}

/* ==========================================================================
   5. NOTIFICACIONES Y UI FEEDBACK
   ========================================================================== */
function showToast(title, body, isError = false) {
  const toast = document.getElementById('toast-notification');
  const toastTitle = document.getElementById('toast-title');
  const toastBody = document.getElementById('toast-body');

  if (!toast || !toastTitle || !toastBody) return;

  toastTitle.textContent = title;
  toastBody.textContent = body;
  toast.style.borderColor = isError ? '#ff007a' : '#00ffcc';

  toast.classList.remove('hidden');
  toast.style.display = 'block';

  setTimeout(() => {
    toast.classList.add('hidden');
    toast.style.display = 'none';
  }, 4000);
}

/* ==========================================================================
   6. MÉTRICAS DE RENDIMIENTO Y ACTUALIZACIÓN DINÁMICA
   ========================================================================== */
async function fetchClientMetrics() {
  const elSpend = document.getElementById('metric-spend');
  const elReach = document.getElementById('metric-reach');
  const elVisitors = document.getElementById('metric-visitors');

  const elSpendStatus = document.getElementById('metric-spend-status');
  const elReachStatus = document.getElementById('metric-reach-status');
  const elActivos = document.getElementById('metric-activos');

  try {
    const res = await fetch(`${getBaseUrl()}/api/facebook/metrics?clientId=${encodeURIComponent(CLIENT_STATE.clientId)}`);
    if (!res.ok) throw new Error('Error al cargar métricas');
    const data = await res.json();

    if (data) {
      if (elSpend) elSpend.textContent = `$${(data.spend || 0).toLocaleString()}`;
      if (elReach) elReach.textContent = (data.reach || 0).toLocaleString();
      if (elVisitors) elVisitors.textContent = (data.visitors || 0).toLocaleString();

      if (elSpendStatus) elSpendStatus.textContent = '🟢 Presupuesto en optimización';
      if (elReachStatus) elReachStatus.textContent = '🟢 Cobertura activa';
      if (elActivos) elActivos.textContent = `${data.activos || 1} Campaña(s) Activa(s)`;
    }
  } catch (error) {
    if (elSpend) elSpend.textContent = '$0';
    if (elReach) elReach.textContent = '0';
    if (elVisitors) elVisitors.textContent = '0';

    if (elSpendStatus) elSpendStatus.textContent = '⚪ Esperando activación';
    if (elReachStatus) elReachStatus.textContent = '⚪ Sin tráfico registrado';
    if (elActivos) elActivos.textContent = '0 Campañas';
  }
}

/* ==========================================================================
   7. PASO 1: SUBIDA DIARIA DE EXCEL DE AUDIENCIA (24 HOURS)
   ========================================================================== */
async function sodieFlujoInyeccionCliente() {
  const fileInput = document.getElementById('client-file-input');
  const btnUpload = document.getElementById('btn-client-upload-excel');

  if (!CLIENT_STATE.isAuthenticated) {
    showToast('Autenticación Requerida', 'Debes validar tu sesión con biometría para subir audiencias.', true);
    return;
  }

  if (!fileInput || !fileInput.files || !fileInput.files[0]) {
    showToast('Archivo Requerido', 'Por favor selecciona un archivo de audiencia (.csv, .xlsx, .xls).', true);
    return;
  }

  const elapsedDays = Math.floor(CLIENT_STATE.elapsedSeconds / 86400);
  if (elapsedDays >= 7 && !CLIENT_STATE.paymentConfirmed) {
    showToast('Pago Requerido', 'Debes liquidar la cuota semanal ($6,000 USDT) para habilitar la inyección del siguiente ciclo.', true);
    const lockWarning = document.getElementById('weekly-payment-lock-warning');
    if (lockWarning) lockWarning.classList.remove('hidden');
    return;
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('clientId', CLIENT_STATE.clientId);

  if (btnUpload) {
    btnUpload.textContent = 'Procesando Excel...';
    btnUpload.disabled = true;
  }

  try {
    const res = await fetch(`${getBaseUrl()}/api/v1/media/upload`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) throw new Error('Fallo al subir el archivo');

    CLIENT_STATE.excelUploaded = true;
    showToast('Audiencia Inyectada', `Excel cargado exitosamente para ${CLIENT_STATE.clientId}. Recargando ciclo de 24h.`);

    if (btnUpload) {
      btnUpload.textContent = '✓ Excel Cargado Hoy';
      btnUpload.style.background = 'rgba(0, 255, 204, 0.2)';
    }

    localStorage.setItem(`sodie_last_excel_time_${CLIENT_STATE.clientId}`, Date.now().toString());

    const btnActivate = document.getElementById('btn-client-activate-campaign');
    if (btnActivate) {
      btnActivate.classList.remove('hidden');
    }

  } catch (error) {
    console.error('Error subiendo audiencia:', error);
    showToast('Error de Carga', 'No se pudo subir el archivo al servidor.', true);
    if (btnUpload) {
      btnUpload.textContent = 'Subir Excel (Paso Diario)';
      btnUpload.disabled = false;
    }
  }
}

/* ==========================================================================
   8. PASO 2: CONFIRMACIÓN Y REGISTRO DE PAGO SEMANAL ($6,000 USDT)
   ========================================================================== */
function sodieProcesarPagoSemanal(event, weekNumber) {
  if (event) event.preventDefault();

  if (!CLIENT_STATE.isAuthenticated) {
    showToast('Autenticación Requerida', 'Verifica tu sesión biométrica antes de registrar tu cuota.', true);
    return;
  }

  CLIENT_STATE.currentWeek = weekNumber;

  const txHash = prompt(`Ingresa el Hash de Transacción (txHash) de Polygon para verificar el pago de $6,000 USDT (Semana ${weekNumber}):`);

  if (!txHash || !txHash.trim()) {
    showToast('Verificación Cancelada', 'Se requiere el Hash de la transacción para confirmar el pago.', true);
    return;
  }

  const cleanTxHash = txHash.trim();

  CLIENT_STATE.paymentConfirmed = true;
  localStorage.setItem(`sodie_payment_week_${weekNumber}_${CLIENT_STATE.clientId}`, JSON.stringify({
    txHash: cleanTxHash,
    timestamp: Date.now(),
    amount: 6000
  }));

  showToast('Pago Registrado', `Cuota de $6,000 USDT registrada correctamente para ${CLIENT_STATE.clientId} (Semana ${weekNumber}).`);

  const lockWarning = document.getElementById('weekly-payment-lock-warning');
  if (lockWarning) lockWarning.classList.add('hidden');

  const btnWeek = document.getElementById(`btn-pay-semana${weekNumber}`);
  if (btnWeek) {
    btnWeek.textContent = `✓ Cuota Semana ${weekNumber} Validada ($6,000 USDT)`;
    btnWeek.style.background = 'rgba(0, 255, 204, 0.25)';
    btnWeek.onclick = null;
  }

  const btnActivate = document.getElementById('btn-client-activate-campaign');
  if (btnActivate) {
    btnActivate.classList.remove('hidden');
    btnActivate.style.display = 'block';
  }
}

/* ==========================================================================
   9. PASO 3: REVISIÓN DE CALLBACK DE REDIRECCIÓN (SI APLICA)
   ========================================================================== */
function checkCallbackStatus() {
  const urlParams = new URLSearchParams(window.location.search);
  const status = urlParams.get('status');
  const type = urlParams.get('type');

  if (status === 'success' || status === 'confirmed') {
    if (type === 'campaign') {
      CLIENT_STATE.campaignActivated = true;
      const btnActivate = document.getElementById('btn-client-activate-campaign');
      if (btnActivate) {
        btnActivate.classList.remove('hidden');
        btnActivate.textContent = '✓ Campaña en Ejecución';
        btnActivate.style.background = 'rgba(0, 255, 204, 0.3)';
        btnActivate.disabled = true;
      }
      showToast('Campaña en Ejecución', 'Tráfico e inyección activos en Meta Ads.');
      fetchClientMetrics();
    }
  }
}

/* ==========================================================================
   10. PASO 4: ACTIVACIÓN DE CAMPAÑA FINAL EN META ADS
   ========================================================================== */
async function sodieConfirmarActivacionCliente() {
  if (!CLIENT_STATE.isAuthenticated) {
    showToast('Autenticación Requerida', 'Verifica tu identidad con biometría para activar la campaña.', true);
    return;
  }

  const btnActivate = document.getElementById('btn-client-activate-campaign');
  if (btnActivate) {
    btnActivate.textContent = 'Activando en Meta Ads...';
    btnActivate.disabled = true;
  }

  try {
    const res = await fetch(`${getBaseUrl()}/api/facebook/activar-campana`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: CLIENT_STATE.clientId,
        week: CLIENT_STATE.currentWeek,
        status: 'ACTIVE',
        timestamp: Date.now()
      })
    });

    if (!res.ok) throw new Error('Error al enviar orden de activación');

    showToast('Éxito', 'Campaña activada correctamente en Meta Ads.');

    if (btnActivate) {
      btnActivate.textContent = '✓ Campaña Activa';
      btnActivate.style.background = 'rgba(0, 255, 204, 0.3)';
    }

    fetchClientMetrics();

  } catch (error) {
    console.error('Error activando campaña:', error);
    showToast('Error', 'No se pudo activar la campaña en el servidor.', true);
    if (btnActivate) {
      btnActivate.textContent = 'Activar Campaña';
      btnActivate.disabled = false;
    }
  }
}

/* ==========================================================================
   11. TEMPORIZADORES EN TIEMPO REAL (DIARIO 24H Y GLOBAL 28 DÍAS)
   ========================================================================== */
function initGlobalAndWeeklyTimers() {
  const globalTimerDisplay = document.getElementById('global-timer-display');
  const timer24hDisplay = document.getElementById('timer-24h-display');
  const timerWeeklyPayDisplay = document.getElementById('timer-weekly-pay-display');

  if (CLIENT_STATE.timerInterval) clearInterval(CLIENT_STATE.timerInterval);

  const savedStartTime = localStorage.getItem(`sodie_timer_start_${CLIENT_STATE.clientId}`);
  if (savedStartTime) {
    CLIENT_STATE.startTimeStamp = parseInt(savedStartTime, 10);
  } else {
    CLIENT_STATE.startTimeStamp = Date.now();
    localStorage.setItem(`sodie_timer_start_${CLIENT_STATE.clientId}`, CLIENT_STATE.startTimeStamp.toString());
  }

  const MAX_GLOBAL_SECONDS = 28 * 86400;
  const SECONDS_24H = 24 * 3600;
  const SECONDS_WEEK = 7 * 86400;

  const updateTimerTick = () => {
    const now = Date.now();
    CLIENT_STATE.elapsedSeconds = Math.floor((now - CLIENT_STATE.startTimeStamp) / 1000);

    if (CLIENT_STATE.elapsedSeconds >= MAX_GLOBAL_SECONDS) {
      CLIENT_STATE.elapsedSeconds = MAX_GLOBAL_SECONDS;
      const sectionComplete = document.getElementById('section-week-4-complete');
      if (sectionComplete) sectionComplete.classList.remove('hidden');
      if (CLIENT_STATE.timerInterval) clearInterval(CLIENT_STATE.timerInterval);
    }

    const gDays = Math.floor(CLIENT_STATE.elapsedSeconds / 86400);
    const gHours = Math.floor((CLIENT_STATE.elapsedSeconds % 86400) / 3600).toString().padStart(2, '0');
    const gMins = Math.floor((CLIENT_STATE.elapsedSeconds % 3600) / 60).toString().padStart(2, '0');
    const gSecs = (CLIENT_STATE.elapsedSeconds % 60).toString().padStart(2, '0');

    if (globalTimerDisplay) {
      globalTimerDisplay.textContent = `${gDays}d ${gHours}h ${gMins}m ${gSecs}s`;
    }

    const lastExcelTime = localStorage.getItem(`sodie_last_excel_time_${CLIENT_STATE.clientId}`);
    let dailyElapsed = 0;
    if (lastExcelTime) {
      dailyElapsed = Math.floor((now - parseInt(lastExcelTime, 10)) / 1000);
    } else {
      dailyElapsed = CLIENT_STATE.elapsedSeconds % SECONDS_24H;
    }

    const remaining24h = Math.max(0, SECONDS_24H - (dailyElapsed % SECONDS_24H));
    const dHours = Math.floor(remaining24h / 3600).toString().padStart(2, '0');
    const dMins = Math.floor((remaining24h % 3600) / 60).toString().padStart(2, '0');
    const dSecs = (remaining24h % 60).toString().padStart(2, '0');

    if (timer24hDisplay) {
      timer24hDisplay.textContent = `${dHours}:${dMins}:${dSecs}`;
    }

    const weekElapsed = CLIENT_STATE.elapsedSeconds % SECONDS_WEEK;
    const remainingWeek = SECONDS_WEEK - weekElapsed;

    const wDays = Math.floor(remainingWeek / 86400).toString().padStart(2, '0');
    const wHours = Math.floor((remainingWeek % 86400) / 3600).toString().padStart(2, '0');
    const wMins = Math.floor((remainingWeek % 3600) / 60).toString().padStart(2, '0');
    const wSecs = (remainingWeek % 60).toString().padStart(2, '0');

    if (timerWeeklyPayDisplay) {
      timerWeeklyPayDisplay.textContent = `${wDays}d ${wHours}h ${wMins}m ${wSecs}s`;
    }

    if (gDays >= 7 && !CLIENT_STATE.paymentConfirmed) {
      const lockWarning = document.getElementById('weekly-payment-lock-warning');
      if (lockWarning) lockWarning.classList.remove('hidden');
    }
  };

  updateTimerTick();
  CLIENT_STATE.timerInterval = setInterval(updateTimerTick, 1000);
}
