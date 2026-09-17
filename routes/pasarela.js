/**
 * Pasarela Payment Router - routes/pasarela.js
 * Ruteo de bloques múltiples con redirección final en el último bloque.
 */
const express = require('express');
const router = express.Router();
const tokensConfig = require('../config/tokens');

/**
 * Helper para inyectar la URL de redirección (confirmacion.html)
 */
function attachRedirectUri(url, clientId, isFinal = false) {
  if (!url || typeof url !== 'string' || !url.trim()) return '';

  let formattedUrl = url.trim();

  // Solo inyectamos el redirect si es el paso final del cobro
  if (isFinal) {
    const redirectUri = tokensConfig.REDIRECT_URI || 
      `${tokensConfig.FRONTEND_URL || ''}/confirmacion.html?clientId=${clientId}&status=success`;

    if (formattedUrl.includes('{REDIRECT_URI}')) {
      formattedUrl = formattedUrl.replace('{REDIRECT_URI}', encodeURIComponent(redirectUri));
    } else if (!formattedUrl.includes('redirect_uri=') && !formattedUrl.includes('returnUrl=')) {
      const separator = formattedUrl.includes('?') ? '&' : '?';
      formattedUrl = `${formattedUrl}${separator}redirect_uri=${encodeURIComponent(redirectUri)}`;
    }
  }

  return formattedUrl;
}

router.get('/get-link', (req, res) => {
  try {
    const { clientId, client_id, hours, slotNumber, stage } = req.query;

    // Normalizar ID del cliente
    const rawId = (clientId || client_id || 'CLIENT-01').toString().toUpperCase();
    let idNumber = '1';
    if (rawId.includes('3') || slotNumber === '3') idNumber = '3';
    else if (rawId.includes('2') || slotNumber === '2') idNumber = '2';
    else idNumber = '1';

    const normalizedClientId = `CLIENT-0${idNumber}`;
    const elapsedHours = parseInt(hours, 10) || 0;

    const payments = tokensConfig.PAYMENTS || {};
    let blocks = [];
    let methodType = '';

    // ==========================================
    // REGLA 1: HORA 0 (PAGO INICIAL) 👺💅🏽
    // ==========================================
    if (elapsedHours === 0 || stage === 'HORA_0') {
      methodType = 'HELIO_PAY_INITIAL';

      if (idNumber === '3') {
        // Cupo 3: $2,500 + $2,500 (Redirect en el 2do)
        blocks = [
          { step: 1, amount: 2500, url: attachRedirectUri(payments.HELIO_2500, normalizedClientId, false) },
          { step: 2, amount: 2500, url: attachRedirectUri(payments.HELIO_2500, normalizedClientId, true) }
        ];
      } else {
        // Cupos 1 y 2: $2,500 + $500 (Redirect en el 2do)
        blocks = [
          { step: 1, amount: 2500, url: attachRedirectUri(payments.HELIO_2500, normalizedClientId, false) },
          { step: 2, amount: 500,  url: attachRedirectUri(payments.HELIO_500_CLIEN_1_2, normalizedClientId, true) }
        ];
      }
    } 
    // ==========================================
    // REGLA 2: HORA 24 (KONTIGO)
    // ==========================================
    else if (elapsedHours === 24 || stage === 'HORA_24') {
      methodType = 'KONTIGO';
      let link = payments.KONTIGO?.HORA24_CUPO_1;

      if (idNumber === '3') link = payments.KONTIGO?.HORA24_CLIENT_3 || link;
      else if (idNumber === '2') link = payments.KONTIGO?.HORA24_CUPO_2 || link;

      blocks = [
        { step: 1, amount: 1000, url: attachRedirectUri(link, normalizedClientId, true) }
      ];
    }
    // ==========================================
    // REGLA 3: HORA 48+ (HELIO LIQUIDACIÓN)
    // ==========================================
    else {
      methodType = 'HELIO_PAY_SETTLEMENT';

      if (idNumber === '3') {
        // Ejemplo $5,000 en Hora 48: $2,500 + $2,500
        blocks = [
          { step: 1, amount: 2500, url: attachRedirectUri(payments.HELIO_2500, normalizedClientId, false) },
          { step: 2, amount: 2500, url: attachRedirectUri(payments.HELIO_2500, normalizedClientId, true) }
        ];
      } else {
        // Cupos 1 y 2
        blocks = [
          { step: 1, amount: 2500, url: attachRedirectUri(payments.HELIO_2500, normalizedClientId, false) },
          { step: 2, amount: 500,  url: attachRedirectUri(payments.HELIO_500_CLIEN_1_2, normalizedClientId, true) }
        ];
      }
    }

    return res.status(200).json({
      success: true,
      clientId: normalizedClientId,
      hours: elapsedHours,
      method: methodType,
      totalSteps: blocks.length,
      blocks: blocks,
      // Primer link listo para abrir
      paymentUrl: blocks[0]?.url || ''
    });

  } catch (error) {
    console.error('🔥 Error al resolver link de pago en pasarela:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Error al consultar las variables de la pasarela' 
    });
  }
});

module.exports = router;
