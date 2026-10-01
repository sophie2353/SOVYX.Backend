function getBaseUrl() {
  if (window.SODIE_CONFIG && window.SODIE_CONFIG.API_URL) {
    return window.SODIE_CONFIG.API_URL.replace(/\/$/, '');
  }
  return window.location.origin;
}

document.addEventListener('DOMContentLoaded', () => {
  // 1. Extraer y Persistir Parámetros URL (clientId y fbUser)
  const urlParams = new URLSearchParams(window.location.search);
  const clientId = urlParams.get('clientId') || localStorage.getItem('sodie_client_id') || 'CLIENT-#01';
  const fbUser = urlParams.get('fbUser') || localStorage.getItem('sodie_fb_user') || 'Evaluador';

  // Guardar en almacenamiento local para consistencia entre pantallas
  localStorage.setItem('sodie_client_id', clientId);
  localStorage.setItem('sodie_fb_user', fbUser);

  // Asignar Timestamp
  const timestampInput = document.getElementById('timestamp');
  if (timestampInput) {
    timestampInput.value = new Date().toISOString();
  }

  // Obtener la IP pública mediante API
  const ipInput = document.getElementById('ip_address');
  if (ipInput) {
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => {
        ipInput.value = data.ip;
      })
      .catch(() => {
        ipInput.value = "127.0.0.1 (Local/Simulado)";
      });
  }

  // Redirección centralizada a confirmacion.html
  function redirectToConfirmation() {
    const nextUrl = `confirmacion.html?step=excel_and_fb&clientId=${encodeURIComponent(clientId)}&fbUser=${encodeURIComponent(fbUser)}`;
    window.location.href = nextUrl;
  }

  // 2. Manejador del Formulario de Firma Digital
  const contractForm = document.getElementById('contract-form');
  if (contractForm) {
    contractForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      const btnSubmit = e.target.querySelector('.btn-submit');
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Procesando firma y vinculando evaluador...';
      }

      const payload = {
        clientId: clientId,
        fbUser: fbUser,
        fullName: document.getElementById('user_fullname').value,
        email: document.getElementById('user_email').value,
        ipAddress: document.getElementById('ip_address') ? document.getElementById('ip_address').value : '127.0.0.1',
        timestamp: document.getElementById('timestamp') ? document.getElementById('timestamp').value : new Date().toISOString(),
        acceptedTerms: document.getElementById('accept_terms').checked,
        softwareName: 'SODIE',
        softwareVersion: '3.5.0'
      };

      try {
        await fetch(`${getBaseUrl()}/api/webhook/contrato-firmado`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (error) {
        console.warn('Webhook no disponible, continuando flujo local...', error);
      }

      // Marcar contrato firmado localmente
      localStorage.setItem('sodie_contract_signed', 'true');

      // Redirigir a confirmacion.html?step=excel_and_fb
      redirectToConfirmation();
    });
  }
});
