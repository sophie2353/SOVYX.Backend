const express = require('express');
const router = express.Router();
const sovyxLogger = require('../../modules/sovyxLogger');
const SOVYXIA2Conversor = require('../../modules/sovyxIA2Conversor');
const { enviarMensajeIG } = require('../../modules/instagramApi');
const config = require('../../config/tokens'); // Donde tienes el VERIFY_TOKEN

const ia2 = new SOVYXIA2Conversor();

/**
 * RECEPCIÓN DE MENSAJES (POST)
 * Aquí es donde Meta envía los DMs y SOVYX responde.
 */
router.post('/', async (req, res) => {
  // 1. Meta exige un 200 OK veloz para no reintentar el envío
  res.sendStatus(200);

  try {
    const { object, entry } = req.body;

    if (object === 'instagram') {
      for (const e of entry) {
        const messagingEvent = e.messaging[0];

        // Procesar solo si el cliente envió texto
        if (messagingEvent && messagingEvent.message && messagingEvent.message.text) {
          const senderId = messagingEvent.sender.id;
          const textoRecibido = messagingEvent.message.text;

          sovyxLogger.info(`SOVYX: DM recibido de ${senderId}`);

          // 2. La IA2 genera la respuesta con autoridad de 5,000 USDT
          const respuestaIA2 = await ia2.generarRespuesta({
            mensaje: textoRecibido,
            usuario: { id: senderId }
          });

          // 3. Envío directo a los DMs de Instagram
          await enviarMensajeIG(senderId, respuestaIA2.mensaje);
          
          sovyxLogger.info(`SOVYX: Respuesta enviada a ${senderId} | Etapa: ${respuestaIA2.etapa}`);
        }
      }
    }
  } catch (error) {
    sovyxLogger.error('Error procesando Webhook de Meta', { error: error.message });
  }
});

/**
 * VERIFICACIÓN DEL WEBHOOK (GET)
 * Usando el token que ya tienes configurado y aceptado por Meta.
 */
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Usamos el token de tu config para mantener la validación de Render
  if (mode && token === config.metaVerifyToken) {
    sovyxLogger.info('Webhook de Meta verificado con éxito en Render 👺');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

module.exports = router;
