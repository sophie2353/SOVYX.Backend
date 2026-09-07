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

    let targetUrl = '';

    // Lógica de selección según la hora de la prueba
    if (stage === 'POST_48H' || elapsedHours >= 48) {
      if (elapsedHours >= 96) {
        targetUrl = tokensConfig.payments[`hora96_${slot}`];
      } else if (elapsedHours >= 72) {
        targetUrl = tokensConfig.payments[`hora72_${slot}`];
      } else {
        targetUrl = tokensConfig.payments[`hora48_${slot}`];
      }
    } else {
      // Por defecto: Hora 24 / Slot inicial via Kontigo
      targetUrl = tokensConfig.payments[`hora24_${slot}`];
    }

    if (!targetUrl) {
      // Fallback a Kontigo si no se ha configurado la variable específica
      targetUrl = tokensConfig.payments[`hora24_${slot}`];
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
