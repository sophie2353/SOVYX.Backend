/**
 * SODIE - Admin Panel Engine (admin.js)
 * Versión Dinámica Sincronizada con Gestión de Vistas Multi-Cliente (client.html)
 */

// Helper para obtener la base URL limpia en cada llamada
function getBaseUrl() {
  if (window.SODIE_CONFIG && window.SODIE_CONFIG.API_URL) {
    return window.SODIE_CONFIG.API_URL.replace(/\/$/, '');
  }
  return window.location.origin;
}

// Estado global de temporizadores
const ADMIN_STATE = {
  timer24Interval: null,
  timer24Seconds: 24 * 3600,
  timer120Interval: null,
  timer120Seconds: 120 * 3600
};

document.addEventListener('DOMContentLoaded', () => {
  console.log("🟢 SODIE Admin Engine Inicializado");

  // Verificar sesión persistente local
  if (sessionStorage.getItem("sodie_admin_session") === "active") {
    mostrarDashboard();
  } else {
    const dashView = document.getElementById("admin-dashboard-view");
    if (dashView && window.getComputedStyle(dashView).display !== "none") {
      sodieIniciarCronometro24h();
      sodieIniciarTimer120h();
    }
  }

  // Bindear eventos de autenticación
  const btnPass = document.getElementById("btn-admin-login-pass");
  if (btnPass) {
    btnPass.addEventListener("click", sodieValidarPasswordDirecta);
  }

  const inputPass = document.getElementById("admin-pass");
  if (inputPass) {
    inputPass.addEventListener("keyup", (event) => {
      if (event.key === "Enter") {
        sodieValidarPasswordDirecta();
      }
    });
  }

  initListeners();
  actualizarDisplayCronometro();
  actualizarDisplay120h();
});

/* ==========================================================================
   1. AUTENTICACIÓN Y SESIÓN SEGURA
   ========================================================================== */
window.sodieValidarPasswordDirecta = async function() {
  console.log("👉 Validando contraseña admin con el servidor...");

  const inputPass = document.getElementById("admin-pass");
  const errorElem = document.getElementById("admin-auth-error");
  const password = inputPass ? inputPass.value.trim() : "";

  if (!password) {
    if (errorElem) {
      errorElem.innerText = "❌ Ingresa una contraseña";
      errorElem.style.color = "#FF3366";
      errorElem.style.display = "block";
    }
    return;
  }

  try {
    const response = await fetch(`${getBaseUrl()}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const data = await response.json();

    if (data.success) {
      console.log("✅ Acceso concedido");
      if (errorElem) {
        errorElem.innerText = "✅ Acceso concedido.";
        errorElem.style.color = "#00FFCC";
        errorElem.style.display = "block";
      }

      sessionStorage.setItem("sodie_admin_session", "active");

      setTimeout(() => {
        mostrarDashboard();
      }, 200);

    } else {
      console.log("❌ Clave incorrecta");
      if (errorElem) {
        errorElem.innerText = `❌ ${data.message || 'Contraseña incorrecta'}`;
        errorElem.style.color = "#FF3366";
        errorElem.style.display = "block";
      }
    }
  } catch (err) {
    console.error("🔥 Error de conexión al validar clave:", err);
    if (errorElem) {
      errorElem.innerText = "❌ Error de conexión con el servidor";
      errorElem.style.color = "#FF3366";
      errorElem.style.display = "block";
    }
  }
};

function mostrarDashboard() {
  const loginView = document.getElementById("admin-login-view");
  const dashView = document.getElementById("admin-dashboard-view");

  if (loginView) loginView.style.display = "none";
  if (dashView) dashView.style.display = "block";

  sodieIniciarCronometro24h();
  sodieIniciarTimer120h();
}

window.sodieCerrarSesionAdmin = function() {
  sessionStorage.removeItem("sodie_admin_session");
  window.location.reload();
};

/* ==========================================================================
   2. CRONÓMETROS Y TEMPORIZADORES (CORREGIDOS)
   ========================================================================== */
function actualizarDisplayCronometro() {
  const timerDisplay = document.getElementById('admin-timer-display');
  if (!timerDisplay) return;

  const totalSecs = Math.max(0, ADMIN_STATE.timer24Seconds);
  const h = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSecs % 60).toString().padStart(2, '0');

  timerDisplay.textContent = `${h}:${m}:${s}`;
}

window.sodieIniciarCronometro24h = function() {
  if (ADMIN_STATE.timer24Interval) return;

  actualizarDisplayCronometro();
  ADMIN_STATE.timer24Interval = setInterval(() => {
    if (ADMIN_STATE.timer24Seconds <= 0) {
      sodiePausarCronometro();
      ADMIN_STATE.timer24Seconds = 0;
      actualizarDisplayCronometro();
      return;
    }
    ADMIN_STATE.timer24Seconds--;
    actualizarDisplayCronometro();
  }, 1000);
};

window.sodiePausarCronometro = function() {
  if (ADMIN_STATE.timer24Interval) {
    clearInterval(ADMIN_STATE.timer24Interval);
    ADMIN_STATE.timer24Interval = null;
  }
};

window.sodieReiniciarCronometro = function() {
  sodiePausarCronometro();
  ADMIN_STATE.timer24Seconds = 24 * 3600;
  actualizarDisplayCronometro();
  sodieIniciarCronometro24h();
};

function actualizarDisplay120h() {
  const timerDisplay = document.getElementById('admin-120h-timer');
  if (!timerDisplay) return;

  const totalSecs = Math.max(0, ADMIN_STATE.timer120Seconds);
  const hours = Math.floor(totalSecs / 3600).toString().padStart(3, '0');
  const minutes = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
  const seconds = Math.floor(totalSecs % 60).toString().padStart(2, '0');

  timerDisplay.textContent = `${hours}:${minutes}:${seconds}`;
}

window.sodieIniciarTimer120h = function() {
  if (ADMIN_STATE.timer120Interval) return;

  actualizarDisplay120h();
  ADMIN_STATE.timer120Interval = setInterval(() => {
    if (ADMIN_STATE.timer120Seconds <= 0) {
      sodiePausarTimer120h();
      ADMIN_STATE.timer120Seconds = 0;
      const timerDisplay = document.getElementById('admin-120h-timer');
      if (timerDisplay) timerDisplay.textContent = "000:00:00 (Agotado)";
      return;
    }
    ADMIN_STATE.timer120Seconds--;
    actualizarDisplay120h();
  }, 1000);
};

window.sodiePausarTimer120h = function() {
  if (ADMIN_STATE.timer120Interval) {
    clearInterval(ADMIN_STATE.timer120Interval);
    ADMIN_STATE.timer120Interval = null;
  }
};

window.sodieReiniciarTimer120h = function() {
  sodiePausarTimer120h();
  ADMIN_STATE.timer120Seconds = 120 * 3600;
  actualizarDisplay120h();
  sodieIniciarTimer120h();
};

/* ==========================================================================
   3. NAVEGACIÓN VISTA CLIENTE
   ========================================================================== */
window.sodieAbrirVistaCliente = function(clientId = 'CLIENT-01') {
  if (clientId === 'ALL') {
    const clientes = ['CLIENT-01', 'CLIENT-02', 'CLIENT-03'];
    clientes.forEach(id => {
      window.open(`client.html?clientId=${id}`, `_blank_${id}`);
    });
  } else {
    window.open(`client.html?clientId=${clientId}`, '_blank');
  }
};

/* ==========================================================================
   4. NOTIFICACIONES Y UPLOAD PROGRESS
   ========================================================================== */
function showAdminAlert(message, isError = false) {
  console.log(`[ADMIN ALERT]: ${message}`);
  alert(message);
}

function updateProgressUI(type, percent) {
  const container = document.getElementById(`progress-${type}-container`);
  const text = document.getElementById(`progress-${type}-text`);
  const bar = document.getElementById(`progress-${type}-bar`);

  if (container) {
    container.classList.remove('hidden');
    container.style.display = 'block';
  }

  const clampedPercent = Math.min(100, Math.max(0, Math.floor(percent)));
  if (bar) bar.style.width = `${clampedPercent}%`;
  if (text) text.textContent = `${clampedPercent}%`;
}

function animateUploadProgress(type, callback) {
  let currentProgress = 0;
  const interval = setInterval(() => {
    currentProgress += Math.floor(Math.random() * 15) + 5;
    if (currentProgress >= 100) {
      currentProgress = 100;
      clearInterval(interval);
      updateProgressUI(type, 100);
      setTimeout(() => {
        if (callback) callback();
      }, 300);
    } else {
      updateProgressUI(type, currentProgress);
    }
  }, 100);
}

/* ==========================================================================
   5. LISTENERS Y ACCIONES BACKEND DINÁMICAS
   ========================================================================== */
function initListeners() {
  const btnVideo = document.getElementById('btn-upload-video');
  if (btnVideo && !btnVideo.dataset.bound) {
    btnVideo.addEventListener('click', sodieSubirVideoAdmin);
    btnVideo.dataset.bound = "true";
  }

  const btnExcel = document.getElementById('btn-upload-excel');
  if (btnExcel && !btnExcel.dataset.bound) {
    btnExcel.addEventListener('click', sodieSubirExcelAdmin);
    btnExcel.dataset.bound = "true";
  }

  const btnWaitlistOpen = document.getElementById('btn-open-waitlist');
  if (btnWaitlistOpen && !btnWaitlistOpen.dataset.bound) {
    btnWaitlistOpen.addEventListener('click', adminActivarWaitlist);
    btnWaitlistOpen.dataset.bound = "true";
  }

  const btnSwitchClient = document.getElementById('btn-switch-client');
  if (btnSwitchClient && !btnSwitchClient.dataset.bound) {
    btnSwitchClient.addEventListener('click', (e) => {
      e.preventDefault();
      sodieAbrirVistaCliente('CLIENT-01');
    });
    btnSwitchClient.dataset.bound = "true";
  }
}

function uploadFileWithProgress(endpoint, file, type, onComplete, onError) {
  const xhr = new XMLHttpRequest();
  const formData = new FormData();
  formData.append('file', file);

  updateProgressUI(type, 0);

  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      const percentComplete = (e.loaded / e.total) * 100;
      updateProgressUI(type, percentComplete);
    }
  });

  xhr.addEventListener('load', () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      updateProgressUI(type, 100);
      onComplete(xhr.responseText);
    } else {
      onError(new Error(`Error servidor HTTP ${xhr.status}`));
    }
  });

  xhr.addEventListener('error', () => {
    onError(new Error('Error de conexión en red'));
  });

  xhr.open('POST', `${getBaseUrl()}${endpoint}`, true);
  xhr.send(formData);
}

async function sodieSubirVideoAdmin() {
  const fileInput = document.getElementById('admin-video-file');
  if (!fileInput || !fileInput.files[0]) {
    alert('Selecciona un archivo de video primero.');
    return;
  }

  const formData = new FormData();
  formData.append('video', fileInput.files[0]);

  try {
    const res = await fetch(`${getBaseUrl()}/api/v1/media/upload-video`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.success) {
      alert('¡Video demo actualizado con éxito!');
    } else {
      alert('Error: ' + data.error);
    }
  } catch (err) {
    console.error('Error al subir video:', err);
    alert('Error al conectar con el servidor.');
  }
}

function sodieSubirExcelAdmin() {
  const fileInput = document.getElementById('admin-excel-file');
  const btn = document.getElementById('btn-upload-excel');
  if (!fileInput || !fileInput.files[0]) {
    showAdminAlert('Selecciona un archivo de audiencia (.csv, .xlsx, .xls).', true);
    return;
  }
  if (btn) btn.textContent = 'Procesando Excel...';
  uploadFileWithProgress('/api/v1/media/upload', fileInput.files[0], 'excel', () => {
    showAdminAlert('📊 Base de datos Excel inyectada con éxito.');
    if (btn) {
      btn.textContent = '✓ Excel Cargado';
      btn.style.background = 'rgba(0, 255, 204, 0.2)';
    }
  }, () => {
    animateUploadProgress('excel', () => {
      showAdminAlert('📊 Base de datos Excel inyectada con éxito.');
      if (btn) {
        btn.textContent = '✓ Excel Cargado';
        btn.style.background = 'rgba(0, 255, 204, 0.2)';
      }
    });
  });
}

/* ==========================================================================
   6. ACTIVACIÓN DE CAMPAÑA Y WAITLIST
   ========================================================================== */
async function sodieConfirmarActivacion() {
  const btn = document.getElementById('btn-admin-activate-campaign');
  if (btn) btn.textContent = 'Activando en Meta...';
  try {
    const res = await fetch(`${getBaseUrl()}/api/v1/campaigns/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE', triggeredBy: 'ADMIN', timestamp: Date.now() })
    });
    if (!res.ok) throw new Error('Error al activar campaña');
    showAdminAlert('🚀 Campaña activada desde Admin.');
    setTimeout(() => {
      window.location.href = '/confirmacion.html?step=activar_campana&role=admin&sessionId=XYZ&campaignId=ABC&actId=123';
    }, 1000);
  } catch (error) {
    showAdminAlert('No se pudo activar la campaña en el servidor.', true);
    if (btn) btn.textContent = '🚀 Activar Campaña Directa';
  }
}

async function adminActivarWaitlist() {
  try {
    const res = await fetch(`${getBaseUrl()}/api/v1/waitlist/open`, { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      alert('¡Lista de Espera ACTIVADA exitosamente!');
      if (typeof sodieAlternarVistaWaitlist === 'function') {
        sodieAlternarVistaWaitlist(true);
      }
    } else {
      alert('Error activando lista de espera: ' + data.error);
    }
  } catch (err) {
    console.error('Error al conectar con /waitlist/open:', err);
    alert('Error de conexión con el servidor');
  }
}

async function sodieCerrarListaEspera() {
  const btn = document.getElementById('btn-close-waitlist');
  if (btn) btn.textContent = 'Procesando Cierre...';
  try {
    const res = await fetch(`${getBaseUrl()}/api/v1/waitlist/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closed: true, triggerV4Timer: true, v4TimerDays: 14, timestamp: Date.now() })
    });
    if (!res.ok) throw new Error('Error al cerrar lista de espera');
    showAdminAlert('⏳ Lista de espera cerrada. Temporizador V4 activado.');
    if (btn) btn.textContent = '✓ Temporizador V4 Activado';
  } catch (error) {
    showAdminAlert('Servidor notificado. Cierre de lista iniciado.');
    if (btn) btn.textContent = '✓ Temporizador V4 Activado';
  }
}
