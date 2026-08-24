// backend/controllers/metaCapi.js
const axios = require('axios');
const crypto = require('crypto');

// Función helper para encriptar en SHA256 (Requisito estricto de Meta CAPI)
function hashData(data) {
  if (!data) return '';
  return crypto.createHash('sha256').update(data.trim().toLowerCase()).digest('hex');
}

/**
 * Envia el evento Purchase directamente a Meta CAPI
 */
async function sendPurchaseToMeta({ email, phone, amount = 10000.00, currency = 'USD', sessionId }) {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!pixelId || !accessToken) {
    console.warn('⚠️ [SOVYX CAPI] META_PIXEL_ID o META_ACCESS_TOKEN no están configurados en .env');
    return { ok: false, reason: 'Missing env vars' };
  }

  try {
    const response = await axios.post(`https://graph.facebook.com/v19.0/${pixelId}/events`, {
      data: [{
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_id: `pur_${sessionId}_${Date.now()}`, // Previene duplicados con el Pixel Web
        user_data: {
          em: email ? [hashData(email)] : [],
          ph: phone ? [hashData(phone)] : []
        },
        custom_data: {
          currency: currency,
          value: parseFloat(amount)
        }
      }],
      access_token: accessToken
    });

    console.log(`✅ [SOVYX CAPI] Ticket de $${amount} USD enviado exitosamente a Meta Ads.`);
    return { ok: true, data: response.data };
  } catch (error) {
    console.error('❌ [SOVYX CAPI] Error enviando evento a Meta:', error.response?.data || error.message);
    return { ok: false, error: error.response?.data || error.message };
  }
}

module.exports = { sendPurchaseToMeta };
