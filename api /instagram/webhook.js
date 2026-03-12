// api/instagram/webhook.js
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const ACCOUNTS = require('../../config/accounts');
const config = require('../../config/tokens');
const sovyxLogger = require('../../modules/sovyxLogger');
const IA2 = require('../../modules/sovyxIA2Conversor');

// Verificación del webhook (GET)
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  sovyxLogger.info('Webhook verification', { mode, token });
  
  if (mode === 'subscribe' && token === config.instagram.verifyToken) {
    sovyxLogger.success('Webhook verified');
    res.status(200).send(challenge);
  } else {
    sovyxLogger.error('Webhook verification failed');
    res.sendStatus(403);
  }
});

// Recibir mensajes de Instagram (POST)
router.post('/webhook', async (req, res) => {
  try {
    sovyxLogger.info('Webhook received', { body: req.body });
    
    const { entry } = req.body;
    
    if (!entry || !entry.length) {
      return res.sendStatus(200);
    }
    
    for (const e of entry) {
      if (!e.messaging) continue;
      
      for (const messaging of e.messaging) {
        if (messaging.message && messaging.message.text) {
          const senderId = messaging.sender.id;
          const messageText = messaging.message.text;
          const recipientId = messaging.recipient.id;
          
          sovyxLogger.info('DM received', { senderId, messageText, recipientId });
          
          // Identificar qué cuenta recibió el mensaje
          let cuenta = null;
          for (const [key, acc] of Object.entries(ACCOUNTS)) {
            if (acc.instagram_id === recipientId) {
              cuenta = key;
              sovyxLogger.info('Cuenta identificada', { cuenta });
              break;
            }
          }
          
          if (!cuenta) {
            sovyxLogger.warn('Cuenta no identificada', { recipientId });
            continue;
          }
          
          // IA2 procesa
          const ia2 = new IA2(ACCOUNTS[cuenta].ia2_style);
          const respuesta = await ia2.generarRespuesta({
            mensaje: messageText,
            usuario: { id: senderId }
          });
          
          sovyxLogger.info('IA2 response', { respuesta: respuesta.mensaje });
          
          // Enviar respuesta por Instagram API
          const response = await fetch(`https://graph.instagram.com/v18.0/me/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${ACCOUNTS[cuenta].instagram_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              recipient: { id: senderId },
              message: { text: respuesta.mensaje }
            })
          });
          
          const result = await response.json();
          sovyxLogger.info('Instagram API response', { result });
        }
      }
    }
    
    res.sendStatus(200);
    
  } catch (error) {
    sovyxLogger.error('Error en webhook', { error: error.message });
    res.sendStatus(500);
  }
});

module.exports = router;
