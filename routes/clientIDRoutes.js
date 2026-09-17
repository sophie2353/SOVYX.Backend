/**
 * SODIE - Client ID Management Routes (routes/clientIDRoutes.js)
 * Asignación Secuencial de IDs de Cliente para Hora 0
 */

const express = require('express');
const router = express.Router();

// Estado simulado de cupos asignados (o se conecta a tu DB / JSON)
let assignedClients = []; 
const MAX_CUPOS = 3;

/**
 * GET /api/v1/clients/next-id
 * Determina el siguiente CLIENT_ID disponible (#01, #02, #03)
 */
router.get('/next-id', async (req, res) => {
  try {
    const totalAsignados = assignedClients.length;

    if (totalAsignados >= MAX_CUPOS) {
      // Si supera el límite de cupos, asigna un fallback seguro o notifica agotado
      return res.status(200).json({
        success: true,
        clientId: `CLIENT-#0${MAX_CUPOS}`,
        message: 'Cupos máximos alcanzados',
        disponibles: 0
      });
    }

    // Calcular el siguiente en la secuencia (CLIENT-#01, CLIENT-#02, CLIENT-#03)
    const nextNumber = totalAsignados + 1;
    const nextId = `CLIENT-#0${nextNumber}`;

    return res.status(200).json({
      success: true,
      clientId: nextId,
      disponibles: MAX_CUPOS - totalAsignados
    });

  } catch (error) {
    console.error('Error al resolver next-id:', error);
    return res.status(500).json({
      success: false,
      clientId: 'CLIENT-#01', // Fallback de emergencia
      error: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/v1/clients/confirm-id
 * Registra o bloquea oficialmente el ID cuando se confirma la Hora 0 en confirmacion.html
 */
router.post('/confirm-id', async (req, res) => {
  try {
    const { clientId } = req.body;

    if (!clientId) {
      return res.status(400).json({ success: false, error: 'clientId es requerido' });
    }

    if (!assignedClients.includes(clientId)) {
      assignedClients.push(clientId);
    }

    return res.status(200).json({
      success: true,
      clientId: clientId,
      assignedCount: assignedClients.length
    });

  } catch (error) {
    console.error('Error al confirmar clientId:', error);
    return res.status(500).json({ success: false, error: 'Error registrando ID' });
  }
});

module.exports = router;
