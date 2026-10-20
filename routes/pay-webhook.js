// routes/pay-webhook.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Client = require('../models/clients'); // Modelo de clientes

// Clave secreta IPN almacenada de forma segura en variables de entorno
const IPN_SECRET = process.env.NOW_IPN_SECRET || '';

/**
 * Función auxiliar para ordenar objetos alfabéticamente 
 * (Requisito estricto de NOWPayments para validar la firma HMAC-SHA512)
 */
function sortObject(obj) {
  return Object.keys(obj)
    .sort()
    .reduce((result, key) => {
      result[key] = (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key]))
        ? sortObject(obj[key])
        : obj[key];
      return result;
    }, {});
}

/**
 * Endpoint POST para recibir el Webhook IPN de NOWPayments
 */
router.post('/', async (req, res) => {
  try {
    const sigHeader = req.headers['x-nowpayments-sig'];
    const paymentData = req.body;

    if (!sigHeader) {
      console.warn('⚠️ [IPN WARNING] Petición recibida sin firma x-nowpayments-sig.');
      return res.status(400).json({ success: false, error: 'Firma IPN faltante' });
    }

    // Validación de seguridad por firma HMAC si el secreto está configurado
    if (IPN_SECRET) {
      const sortedPayload = sortObject(paymentData);
      const hmac = crypto.createHmac('sha512', IPN_SECRET);
      hmac.update(JSON.stringify(sortedPayload));
      const calculatedSig = hmac.digest('hex');

      if (calculatedSig !== sigHeader) {
        console.error('❌ [IPN ERROR] La firma criptográfica no coincide. Posibleplantilla maliciosa.');
        return res.status(401).json({ success: false, error: 'Firma IPN inválida' });
      }
    }

    const { payment_status, order_id, payment_id, customer_email } = paymentData;
    console.log(`🔔 [IPN RECIBIDO] ID Pago: ${payment_id} | Estado: ${payment_status} | Order/Client: ${order_id}`);

    // Estados exitosos en NOWPayments: 'finished' o 'confirmed'
    if (['finished', 'confirmed'].includes(payment_status)) {
      // Identificar al cliente por su clientId (order_id) o email y actualizar su estatus a ACTIVE
      const query = order_id ? { clientId: order_id } : { 'meta.email': customer_email };
      
      const updatedClient = await Client.findOneAndUpdate(
        query,
        { 
          $set: { 
            'meta.status': 'ACTIVE', 
            'meta.configuredAt': new Date() 
          } 
        },
        { new: true }
      );

      if (updatedClient) {
        console.log(`✅ [IPN] Cliente ${updatedClient.clientId} actualizado a ACTIVE exitosamente.`);
      } else {
        console.warn(`⚠️ [IPN] Pago confirmado pero no se encontró el cliente en BD con ID: ${order_id}`);
      }
    }

    return res.status(200).json({ success: true, message: 'IPN procesado correctamente' });
  } catch (err) {
    console.error('💥 [IPN CRITICAL ERROR]:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
