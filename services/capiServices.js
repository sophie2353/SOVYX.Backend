// services/capiService.js
const axios = require('axios');

async function enviarEventoCompraCAPI({ email, monto = 10000, currency = 'USD', eventName = 'Purchase' }) {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!pixelId || !accessToken) {
    console.warn('⚠️ [CAPI] Faltan variables META_PIXEL_ID o META_ACCESS_TOKEN.');
    return { success: false, error: 'Credenciales incompletas' };
  }

  // Hash del email para cumplir las políticas de privacidad de Meta (SHA256)
  const crypto = require('crypto');
  const hashedEmail = crypto.createHash('sha256').update((email || '').trim().toLowerCase()).digest('hex');

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        user_data: {
          em: [hashedEmail]
        },
        custom_data: {
          currency: currency,
          value: monto
        }
      }
    ]
  };

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v25.0/${pixelId}/events?access_token=${accessToken}`,
      payload
    );
    console.log('🟢 [CAPI] Evento enviado a Meta con éxito:', response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('🔴 [CAPI] Error enviando evento a Meta:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { enviarEventoCompraCAPI };
