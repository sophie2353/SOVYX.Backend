const axios = require('axios');
const config = require('../config/tokens');
const sovyxLogger = require('./sovyxLogger');

/**
 * Envía un mensaje de texto a un usuario de Instagram mediante su ID de chat (PSID).
 * @param {string} userId - El ID interno que Meta asigna al chat del cliente.
 * @param {string} texto - El contenido del mensaje.
 */
async function enviarMensajeIG(userId, texto) {
  try {
    const url = `https://graph.facebook.com/v19.0/me/messages`;
    
    await axios.post(url, {
      recipient: { id: userId },
      message: { text: texto },
      access_token: config.metaAccessToken // Tu token de 60 días
    });

    sovyxLogger.info(`Mensaje enviado a IG: ${userId}`);
  } catch (error) {
    const errorData = error.response ? error.response.data : error.message;
    sovyxLogger.error('Error enviando mensaje a Instagram API', errorData);
    throw error;
  }
}

module.exports = { enviarMensajeIG };
