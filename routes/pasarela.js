const express = require('express');
const router = express.Router();
const tokensConfig = require('../config/tokens');

// Obtener enlace de pago automático según Hora y Slot (#1 / #2)
router.get('/get-link', (req, res) => {
  try {
    const { stage, slotNumber, hours } = req.query;
    
    // Asignar número de slot (1 o 2) por defecto si no viene en la petición
    const slot = slotNumber === '2' ? 'slot2' : 'slot1';
    const elapsedHours = parseInt(hours, 10) || 0;

    let rawUrl = '';

    // Lógica de selección según la hora de la prueba
    if (stage === 'POST_48H' || elapsedHours >= 48) {
      if (elapsedHours >= 96) {
        rawUrl = tokensConfig.payments[`hora96_${slot}`];
      } else if (elapsedHours >= 72) {
        rawUrl = tokensConfig.payments[`hora72_${slot}`];
      } else {
        rawUrl = tokensConfig.payments[`hora48_${slot}`];
      }
    } else {
      // Por defecto: Hora 24 / Slot inicial via Kontigo
      rawUrl = tokensConfig.payments[`hora24_${slot}`];
    }

    if (!rawUrl) {
      // Fallback a Kontigo si no se ha configurado la variable específica
      rawUrl = tokensConfig.payments[`hora24_${slot}`];
    }

    // Inyección / Formateo automático de REDIRECT_URI en los enlaces
    let targetUrl = rawUrl;
    if (targetUrl) {
      const redirectUri = tokensConfig.REDIRECT_URI || `${tokensConfig.FRONTEND_URL}/confirmacion.html`;
      
      if (targetUrl.includes('{REDIRECT_URI}')) {
        // Reemplazo si la URL en la variable viene como plantilla
        targetUrl = targetUrl.replace('{REDIRECT_URI}', encodeURIComponent(redirectUri));
      } else if (!targetUrl.includes('redirect_uri=') && !targetUrl.includes('returnUrl=')) {
        // Adjunta dinámicamente el parámetro de retorno según el delimitador de query params
        const separator = targetUrl.includes('?') ? '&' : '?';
        targetUrl = `${targetUrl}${separator}redirect_uri=${encodeURIComponent(redirectUri)}`;
      }
    }

    return res.status(200).json({
      success: true,
      paymentUrl: targetUrl,
      stage,
      slot
    });
  } catch (error) {
    console.error('Error al resolver link de pago:', error);
    return res.status(500).json({ error: 'Error al consultar la pasarela' });
  }
});

module.exports = router;
