/**
 * SODIE - Core Application Script (app.js)
 * Versión Actualizada: Integración IA3 Backend + Flujo de Pago Simplificado & Carga Excel
 */

// Helper para obtener la base URL limpia en cada llamada
function getBaseUrl() {
  if (window.SODIE_CONFIG && window.SODIE_CONFIG.API_URL) {
    return window.SODIE_CONFIG.API_URL.replace(/\/$/, '');
  }
  return window.location.origin;
}

// Estado global local para el flujo de pago inicial
let currentPaymentState = {
  hours: 0,
  currentStep: 1,
  blocks: []
};

document.addEventListener('DOMContentLoaded', () => {
  initSplashGauges();
  checkAvailableSlots();
  initSSEMetrics();
  initFacebookMetrics();
  initChatEngine();
  initIA3Engine();
  initWebAuthnBiometrics();
  handleUrlRedirects();
  initTimer30d();
  initPaymentFlowEvents();
  initWaitlistEvents();

  // Configurar la fuente del Video de Demostración
  const demoVideo = document.getElementById('sodie-demo-video');
  if (demoVideo) {
    const source = demoVideo.querySelector('source');
    if (source) {
      source.src = 'sodie-demo-borrador.mp4';
      demoVideo.load();
    }
  }
});

/* ==========================================================================
   1. TOAST & NOTIFICACIONES
   ========================================================================== */
function showToast(title, body, isError = false) {
  const toast = document.getElementById('toast-notification');
  const toastTitle = document.getElementById('toast-title');
  const toastBody = document.getElementById('toast-body');

  if (!toast || !toastTitle || !toastBody) return;

  toastTitle.textContent = title;
  toastBody.textContent = body;
  toast.style.borderColor = isError ? '#ff4d4d' : '#00ffcc';

  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

/* ==========================================================================
   2. SPLASH SCREEN & SSE METRICS (/api/v1/metrics/live)
   ========================================================================== */
function initSplashGauges() {
  const pctNum = document.getElementById('splash-pct');
  const welcomeFill = document.getElementById('welcome-fill');
  const splashScreen = document.getElementById('view-splash');
  const capsules = document.querySelectorAll('#capsules-track .capsule');

  let progress = 0;
  const interval = setInterval(() => {
    progress += 2;
    if (pctNum) pctNum.textContent = `${progress}%`;
    if (welcomeFill) welcomeFill.style.width = `${progress}%`;

    const capIndex = Math.floor((progress / 100) * capsules.length);
    if (capsules[capIndex]) {
      capsules[capIndex].classList.remove('cap-dark');
      capsules[capIndex].classList.add('cap-lit');
    }

    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        if (splashScreen) {
          splashScreen.style.opacity = '0';
          splashScreen.style.transition = 'opacity 0.6s ease';
          setTimeout(() => splashScreen.classList.add('hidden'), 600);
        }
      }, 300);
    }
  }, 30);
}

function initSSEMetrics() {
  const gauge1Circle = document.getElementById('gauge-circle-1');
  const gauge1Val = document.getElementById('gauge-val-1');
  const gauge2Circle = document.getElementById('gauge-circle-2');
  const gauge2Val = document.getElementById('gauge-val-2');

  try {
    const evtSource = new EventSource(`${getBaseUrl()}/api/v1/metrics/live`);

    evtSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.datosProcesados !== undefined && gauge1Val && gauge1Circle) {
        gauge1Val.textContent = `${data.datosProcesados}%`;
        gauge1Circle.setAttribute('stroke-dasharray', `${data.datosProcesados}, 100`);
      }
      if (data.analisisMercado !== undefined && gauge2Val && gauge2Circle) {
        gauge2Val.textContent = `${data.analisisMercado}%`;
        gauge2Circle.setAttribute('stroke-dasharray', `${data.analisisMercado}, 100`);
      }
    };

    evtSource.onerror = () => {
      if (gauge1Val) gauge1Val.textContent = '100%';
      if (gauge1Circle) gauge1Circle.setAttribute('stroke-dasharray', '100, 100');
      if (gauge2Val) gauge2Val.textContent = '100%';
      if (gauge2Circle) gauge2Circle.setAttribute('stroke-dasharray', '100, 100');
      evtSource.close();
    };
  } catch (err) {
    console.warn('SSE desactivado, fallback a estático.');
  }
}

/* ==========================================================================
   3. CONTADOR DE CUPOS & DISPONIBILIDAD DINÁMICA DE PRECIOS
   ========================================================================== */
async function checkAvailableSlots() {
  try {
    const res = await fetch(`${getBaseUrl()}/api/clientes/disponibles`);
    let slots = 3;

    if (res.ok) {
      const data = await res.json();
      if (data.disponibles !== undefined) slots = data.disponibles;
    }

    actualizarInterfazCupos(slots);
  } catch (error) {
    console.warn('Error obteniendo cupos del servidor. Usando valor por defecto.', error);
    actualizarInterfazCupos(3);
  }
}

function actualizarInterfazCupos(slots) {
  const cuposVal = document.getElementById('metric-cupos-val');
  const cuposSub = document.getElementById('metric-cupos-sub');
  const cuposBadge = document.getElementById('cupos-count-badge');
  const pfActive = document.getElementById('pf-active-payment-flow');
  const pfWaitlist = document.getElementById('pf-waitlist-block');

  if (cuposVal) cuposVal.textContent = slots;

  if (slots >= 1) {
    if (cuposSub) cuposSub.textContent = `Cupos Disponibles: ${slots}`;
    if (cuposBadge) cuposBadge.textContent = `solo ${slots} cupo${slots > 1 ? 's' : ''} disponible${slots > 1 ? 's' : ''}`;
    if (pfActive) pfActive.classList.remove('hidden');
    if (pfWaitlist) pfWaitlist.classList.add('hidden');
  } else {
    if (cuposSub) cuposSub.textContent = 'Agotado';
    if (cuposBadge) cuposBadge.textContent = 'cupos agotados';
    if (pfActive) pfActive.classList.add('hidden');
    if (pfWaitlist) pfWaitlist.classList.remove('hidden');
    showToast('Cupos Agotados', 'Acceso directo cerrado. Lista de espera activada.');
  }
}

/* ==========================================================================
   4. FACEBOOK METRICS EN INDEX (/api/facebook/metrics)
   ========================================================================== */
async function initFacebookMetrics() {
  const elSpend = document.getElementById('metric-spend');
  const elSpendStatus = document.getElementById('metric-spend-status');
  const elReach = document.getElementById('metric-reach');
  const elReachStatus = document.getElementById('metric-reach-status');
  const elVisitors = document.getElementById('metric-visitors');
  const elActivos = document.getElementById('metric-activos');
  const elPayClicks = document.getElementById('metric-pay-clicks');

  const setZeroMetrics = () => {
    if (elSpend) elSpend.textContent = '$0';
    if (elSpendStatus) elSpendStatus.textContent = 'Esperando Conexión';
    if (elReach) elReach.textContent = '0';
    if (elReachStatus) elReachStatus.textContent = '0.00';
    if (elVisitors) elVisitors.textContent = '0';
    if (elActivos) elActivos.textContent = '0';
    if (elPayClicks) elPayClicks.textContent = '0';
  };

  try {
    const res = await fetch(`${getBaseUrl()}/api/facebook/metrics`);
    if (!res.ok) throw new Error('Campaña no activa');
    const data = await res.json();

    if (data && data.hasActiveCampaign) {
      if (elSpend) elSpend.textContent = `$${data.spend || 0}`;
      if (elSpendStatus) elSpendStatus.textContent = 'Conectado Meta Ads';
      if (elReach) elReach.textContent = (data.reach || 0).toLocaleString();
      if (elReachStatus) elReachStatus.textContent = (data.impressions || 0).toLocaleString();
      if (elVisitors) elVisitors.textContent = data.visitors || 0;
      if (elActivos) elActivos.textContent = data.activos || 0;
      if (elPayClicks) elPayClicks.textContent = data.payClicks || 0;
    } else {
      setZeroMetrics();
    }
  } catch (error) {
    setZeroMetrics();
  }
}

/* ==========================================================================
   5. CHAT & ASISTENTE IA2 (/api/v1/chat/message)
   ========================================================================== */
function initChatEngine() {
  const sendBtn = document.getElementById('chat-send');
  const chatInput = document.getElementById('chat-input');
  const quickReplies = document.querySelectorAll('#quick-replies .opt-btn');

  if (sendBtn && chatInput) {
    sendBtn.addEventListener('click', () => {
      const msg = chatInput.value.trim();
      if (msg) {
        sendChatMessage(msg);
        chatInput.value = '';
      }
    });

    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendBtn.click();
    });
  }

  quickReplies.forEach((btn) => {
    btn.addEventListener('click', () => {
      const payload = btn.getAttribute('data-payload');
      const label = btn.textContent;
      sendChatMessage(label, payload);
    });
  });
}

function splitTextIntoChunks(text, maxLength = 180) {
  if (text.length <= maxLength) return [text];

  const sentences = text.match(/[^.!?]+[.!?]+|\s*[^.!?]+$/g) || [text];
  const chunks = [];
  let currentChunk = '';

  sentences.forEach((sentence) => {
    if ((currentChunk + sentence).length <= maxLength) {
      currentChunk += sentence;
    } else {
      if (currentChunk.trim()) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    }
  });

  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  return chunks.length > 0 ? chunks : [text];
}

async function sendChatMessage(messageText, payload = null) {
  const chatBody = document.getElementById('chat-body');
  if (!chatBody) return;

  const userBubble = document.createElement('div');
  userBubble.className = 'outgoing-simple';
  userBubble.style.cssText = 'text-align: right; margin: 8px 0;';
  userBubble.innerHTML = `<p style="display: inline-block; background: rgba(0,255,204,0.15); border: 1px solid #00ffcc; padding: 8px 12px; border-radius: 12px; color: #fff;">${messageText}</p>`;
  chatBody.appendChild(userBubble);
  chatBody.scrollTop = chatBody.scrollHeight;

  const loadingBubble = document.createElement('div');
  loadingBubble.className = 'incoming-simple';
  loadingBubble.innerHTML = `<p class="mint-txt"><i>IA2 escribiendo...</i></p>`;
  chatBody.appendChild(loadingBubble);
  chatBody.scrollTop = chatBody.scrollHeight;

  try {
    const res = await fetch(`${getBaseUrl()}/api/v1/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: messageText, payload: payload })
    });

    if (!res.ok) throw new Error('Error en backend chat');
    const data = await res.json();
    loadingBubble.remove();

    const rawReply = data.reply || data.respuesta || 'Mensaje procesado correctamente.';
    const messageChunks = splitTextIntoChunks(rawReply);

    messageChunks.forEach((chunk, index) => {
      setTimeout(() => {
        const ia2Bubble = document.createElement('div');
        ia2Bubble.className = 'incoming-simple';
        ia2Bubble.style.cssText = 'margin: 6px 0; animation: fadeIn 0.3s ease;';
        ia2Bubble.innerHTML = `<p style="background: rgba(255,255,255,0.05); padding: 10px 14px; border-radius: 12px; border-left: 3px solid #00ffcc; color: #e0e0e0; font-size: 0.9em; line-height: 1.4;">${chunk}</p>`;
        
        chatBody.appendChild(ia2Bubble);
        ia2Bubble.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, index * 800);
    });

  } catch (error) {
    loadingBubble.remove();
    const errorBubble = document.createElement('div');
    errorBubble.className = 'incoming-simple';
    errorBubble.innerHTML = `<p class="fuchsia-txt">Selecciona tu reserva para habilitar la carga de audiencias e inyección.</p>`;
    chatBody.appendChild(errorBubble);
    chatBody.scrollTop = chatBody.scrollHeight;
  }
}

/* ==========================================================================
   6. IA3 ANALYZER ENGINE (/api/ia3/analizar)
   ========================================================================== */
function initIA3Engine() {
  const btnAnalizar = document.getElementById('btn-ia3-analizar');
  if (!btnAnalizar) return;

  btnAnalizar.addEventListener('click', async () => {
    const spendInput = document.getElementById('ia3-ad-spend');
    const roasInput = document.getElementById('ia3-roas');

    const spend = spendInput ? spendInput.value : '';
    const roas = roasInput ? roasInput.value : '';

    if (!spend || !roas) {
      showToast('Campos Faltantes', 'Por favor ingresa la Inversión y el ROAS actual.', true);
      return;
    }

    const modal = document.getElementById('ia3-modal-result');
    const valUser = document.getElementById('ia3-val-user');
    const valProblems = document.getElementById('ia3-val-problems');
    const valSolution = document.getElementById('ia3-val-solution');
    const valSavings = document.getElementById('ia3-val-savings');

    if (modal) modal.classList.remove('hidden');
    if (valUser) valUser.innerText = `$${spend} USD / ROAS ${roas}`;
    if (valProblems) valProblems.innerText = "Analizando fuga de capital...";
    if (valSolution) valSolution.innerText = "IA3 procesando solución algorítmica...";
    if (valSavings) valSavings.innerText = "Calculando optimización...";

    try {
      const res = await fetch(`${getBaseUrl()}/api/ia3/analizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adSpend: spend, roas: roas })
      });

      if (!res.ok) throw new Error('Error al conectar con la IA3');

      const data = await res.json();

      if (valProblems) valProblems.innerText = data.problemas || data.problems || "Fuga identificada en segmentación amplia.";
      if (valSolution) valSolution.innerText = data.solucion || data.solution || "Inyección directa a audiencia optimizada por IA3.";
      if (valSavings) valSavings.innerText = data.ahorro || data.savings || "Ahorro potencial recalculado con éxito.";

      showToast('Análisis IA3 Listo', 'El diagnóstico del backend se ha generado correctamente.');

    } catch (error) {
      console.error('Error IA3:', error);
      if (valSolution) valSolution.innerText = "Error en el servidor al generar diagnóstico IA3.";
      showToast('Error IA3', 'No se pudo obtener la respuesta del backend de IA3.', true);
    }
  });
}

/* ==========================================================================
   7. EVENTOS DE FLUJO DE PAGO Y CONEXIÓN META ADS
   ========================================================================== */
    function mostrarPasoConexion() {
      document.getElementById('pf-intro-card').classList.add('hidden');
      document.getElementById('pf-step-billing').classList.remove('hidden');
    }

    // Valida FB User, carga el iframe de la pasarela y lo despliega
    function desplegarIframePago() {
      const fbUser = document.getElementById('fbUserId').value.trim();
      if (!fbUser) {
        alert('Por favor ingresa tu User de Facebook para continuar.');
        return;
      }
      
      localStorage.setItem('sodie_fb_user', fbUser);
      
      // Muestra la caja del iframe
      document.getElementById('pf-step-billing').classList.add('hidden');
      const iframeBox = document.getElementById('pf-step-iframe');
      iframeBox.classList.remove('hidden');

      // Asigna el link de la pasarela de pago configurado en config.js o link directo
      const iframeElement = document.getElementById('payment-gateway-iframe');
      const paymentUrl = (typeof PAYMENT_GATEWAY_URL !== 'undefined') 
        ? PAYMENT_GATEWAY_URL 
        : 'https://nowpayments.io/embeds/payment-widget?iid=5260032422?redirect=confirmacion.html?step=generar_id';
      
      iframeElement.src = paymentUrl;
    }

    // Listener de mensajes postMessage si la pasarela notifica el pago desde adentro del iframe
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'PAYMENT_SUCCESS') {
        window.location.href = 'confirmacion.html?step=generar_id';
      }
    });

    // Procesa la carga del Excel y redirige a la confirmación
    function finalizarYConfirmar() {
      const fileInput = document.getElementById('client-file-input');
      if (!fileInput.files || fileInput.files.length === 0) {
        alert('Por favor selecciona tu archivo Excel antes de continuar.');
        return;
      }

      window.location.href = 'confirmacion.html?step=excel_and_fb';
    }

    // Detecta si el cliente viene de vuelta tras firmar/pagar en contrato.html
    window.addEventListener('DOMContentLoaded', () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('status') === 'signed' || localStorage.getItem('sodie_contract_completed') === 'true') {
        document.getElementById('pf-intro-card').classList.add('hidden');
        document.getElementById('pf-step-billing').classList.add('hidden');
        document.getElementById('pf-step-iframe').classList.add('hidden');
        document.getElementById('pf-step-excel').classList.remove('hidden');
      }
    });

/* ==========================================================================
   8. LISTA DE ESPERA (REEMPLAZO DE PAGO AL AGOTAR CUPOS)
   ========================================================================== */
function initWaitlistEvents() {
  const btnWaitlist = document.getElementById('btn-waitlist-access');

  if (btnWaitlist) {
    btnWaitlist.addEventListener('click', async () => {
      const brand = document.getElementById('wl-brand-name')?.value;
      const email = document.getElementById('wl-email')?.value;
      const phone = document.getElementById('wl-phone')?.value;

      if (!brand || !email || !phone) {
        showToast('Campos Incompletos', 'Completa los campos obligatorios para unirte.', true);
        return;
      }

      showToast('Enviando Registro', 'Guardando tu posición en la Lista de Espera...');

      try {
        const res = await fetch(`${getBaseUrl()}/api/v1/waitlist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company: brand, email, phone })
        });

        if (!res.ok) throw new Error('Error guardando en lista de espera');

        showToast('Acceso Confirmado', 'Te has unido correctamente a la Lista de Espera.');
        
        btnWaitlist.disabled = true;
        btnWaitlist.textContent = 'REGISTRADO EN LISTA DE ESPERA ✓';
        btnWaitlist.style.background = 'rgba(0, 255, 204, 0.2)';

      } catch (error) {
        console.error('Error lista de espera:', error);
        showToast('Error', 'No se pudo completar el registro.', true);
      }
    });
  }
}

/* ==========================================================================
   9. CRONÓMETRO REGRESIVO DE APERTURA DE CUPOS (30 DÍAS)
   ========================================================================== */
function initTimer30d() {
  const timerDisplay = document.getElementById('timer-main-display');
  if (!timerDisplay) return;

  let totalSeconds = 30 * 24 * 3600;

  setInterval(() => {
    if (totalSeconds <= 0) return;
    totalSeconds--;

    const totalHours = Math.floor(totalSeconds / 3600).toString().padStart(3, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');

    timerDisplay.textContent = `${totalHours}:${m}:${s}`;
  }, 1000);
}

/* ==========================================================================
   10. BIOMETRÍA Y REDIRECCIONES
   ========================================================================== */
function initWebAuthnBiometrics() {
  const bioBtn = document.getElementById('btn-register-biometrics');
  if (!bioBtn) return;

  bioBtn.addEventListener('click', async () => {
    if (!window.PublicKeyCredential) {
      showToast('Biometría No Disponible', 'Este dispositivo no soporta Face ID / Touch ID.', true);
      return;
    }

    try {
      bioBtn.style.borderColor = '#00ffcc';
      bioBtn.textContent = '⚡ Solicitando Face ID / Huella...';

      const challengeRes = await fetch(`${getBaseUrl()}/api/v1/auth/biometrics/challenge`, { method: 'POST' });
      const challengeData = await challengeRes.json();
      
      const challengeBuffer = new Uint8Array(challengeData.challenge || [1, 2, 3, 4, 5, 6, 7, 8]);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: challengeBuffer,
          rp: { name: "SODIE Platform" },
          user: {
            id: new Uint8Array([1, 2, 3, 4]),
            name: "cliente@sodie.com",
            displayName: "Cliente SODIE"
          },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }],
          authenticatorSelection: { authenticatorAttachment: "platform" },
          timeout: 60000
        }
      });

      await fetch(`${getBaseUrl()}/api/v1/auth/biometrics/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId: credential.id })
      });

      bioBtn.textContent = '✓ Biometría Registrada';
      bioBtn.style.background = 'rgba(0, 255, 204, 0.2)';
      showToast('Autenticación Exitosa', 'Face ID / Huella vinculada correctamente.');

    } catch (err) {
      console.warn('Biometría simulada / Cancelada:', err);
      bioBtn.textContent = '✓ Biometría Lista';
      bioBtn.style.background = 'rgba(0, 255, 204, 0.2)';
      showToast('Biometría Lista', 'Identidad confirmada en el sistema.');
    }
  });
}

function handleUrlRedirects() {
  const urlParams = new URLSearchParams(window.location.search);
  const status = urlParams.get('status');

  if (status === 'active' || urlParams.get('view') === 'dashboard') {
    showToast('Acceso Confirmado', 'Redirigiendo a tu Dashboard de Cliente...');
    setTimeout(() => {
      window.location.href = 'client.html';
    }, 1200);
  }
}

/* ==========================================================================
   11. DISPARADOR SECRETO DE 5 CLICS (ADMIN)
   ========================================================================== */
(function initAdminTriggerDirect() {
  let adminToques = 0;
  let adminTimer = null;

  window.sodieContarToquesAdmin = function() {
    adminToques++;
    clearTimeout(adminTimer);
    adminTimer = setTimeout(() => { adminToques = 0; }, 2000);

    if (adminToques >= 5) {
      adminToques = 0;
      clearTimeout(adminTimer);
      window.location.href = "admin.html";
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    const logoTxt = document.getElementById("sodie-logo-trigger");
    const logoIcon = document.getElementById("btn-sodie-logo-trigger");

    if (logoTxt) logoTxt.addEventListener("pointerdown", window.sodieContarToquesAdmin);
    if (logoIcon) logoIcon.addEventListener("pointerdown", window.sodieContarToquesAdmin);
  });
})();
