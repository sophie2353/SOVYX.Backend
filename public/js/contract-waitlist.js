function getBaseUrl() {
  if (window.SODIE_CONFIG && window.SODIE_CONFIG.API_URL) {
    return window.SODIE_CONFIG.API_URL.replace(/\/$/, '');
  }
  return window.location.origin;
}

document.addEventListener('DOMContentLoaded', async () => {
  // Esperar a la inicialización dinámica de configuración
  if (window.SODIE_CONFIG_READY) {
    await window.SODIE_CONFIG_READY;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const clientId = urlParams.get('clientId') || localStorage.getItem('sodie_v4_client_id') || 'CLIENT-V4-#1';
  const email = urlParams.get('email') || localStorage.getItem('sodie_v4_email') || '';

  localStorage.setItem('sodie_v4_client_id', clientId);
  if (email) {
    localStorage.setItem('sodie_v4_email', email);
    const emailInput = document.getElementById('user_email');
    if (emailInput && !emailInput.value) {
      emailInput.value = email;
    }
  }

  const timestampInput = document.getElementById('timestamp');
  if (timestampInput) {
    timestampInput.value = new Date().toISOString();
  }

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

  function finalizeAndRedirect() {
    alert("Cupo Reservado. Redirigiendo a dashboard principal para ver cuántos cupos están disponibles. Activa las notificaciones para saber nuevas actualizaciones y cuándo estará activa la V4 🚀");
    window.location.href = 'index.html';
  }

  const contractForm = document.getElementById('contract-waitlist-form');
  if (contractForm) {
    contractForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      const btnSubmit = e.target.querySelector('.btn-submit');
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Procesando firma y asegurando cupo V4...';
      }

      const payload = {
        clientId: clientId,
        fullName: document.getElementById('user_fullname').value,
        email: document.getElementById('user_email').value,
        ipAddress: document.getElementById('ip_address') ? document.getElementById('ip_address').value : '127.0.0.1',
        timestamp: document.getElementById('timestamp') ? document.getElementById('timestamp').value : new Date().toISOString(),
        acceptedTerms: document.getElementById('accept_terms').checked,
        softwareName: 'SODIE',
        softwareVersion: '4.0.0',
        tipoContrato: 'LISTA_DE_ESPERA_V4'
      };

      try {
        await fetch(`${getBaseUrl()}/api/webhook/contrato-waitlist-firmado`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (error) {
        console.warn('Webhook de waitlist no disponible, continuando flujo local...', error);
      }

      localStorage.setItem('sodie_v4_contract_signed', 'true');
      finalizeAndRedirect();
    });
  }
});
