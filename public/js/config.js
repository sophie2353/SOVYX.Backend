// config.js
window.SODIE_CONFIG = {
  // Fallback de rescate inmediato basado en la ubicación actual
  API_URL: window.location.origin
};

// Guardamos la promesa de carga para que otros scripts puedan esperarla si lo necesitan
window.SODIE_CONFIG_READY = (async function sodieCargarConfiguracion() {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    
    const data = await res.json();
    if (data && data.API_URL) {
      window.SODIE_CONFIG.API_URL = data.API_URL.replace(/\/$/, ''); // Limpia barra final
    }
  } catch (err) {
    console.warn('⚠️ No se pudo cargar /api/config. Usando URL de origen como fallback:', err);
    window.SODIE_CONFIG.API_URL = window.location.origin;
  }
})();
