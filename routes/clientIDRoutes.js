/**
 * SODIE - Client ID Management Routes (routes/clientIDRoutes.js)
 * Separación de flujos: Evaluadores Hora 0 (V3.5) y Waitlist (V4)
 */

const express = require('express');
const router = express.Router();

// --------------------------------------------------------------------------
// ESTADO EN MEMORIA / DB
// --------------------------------------------------------------------------

// 1. Evaluadores Hora 0 (V3.5) - Límite de 3 cupos
global.assignedEvaluadoresV35 = global.assignedEvaluadoresV35 || [];
const MAX_CUPOS_EVALUADORES = 3;

// 2. Waitlist (V4) - Límite de 50 cupos
global.assignedWaitlistV4 = global.assignedWaitlistV4 || [];
const MAX_CUPOS_WAITLIST_V4 = 50;


// ==========================================================================
// MÓDULO 1: EVALUADORES HORA 0 (V3.5 - confirmacion.html)
// ==========================================================================

/**
 * GET /api/v1/clients/next-id
 * Obtiene el siguiente ID de Evaluador Hora 0 (#01, #02, #03)
 */
router.get('/next-id', async (req, res) => {
  try {
    const totalAsignados = global.assignedEvaluadoresV35.length;

    if (totalAsignados >= MAX_CUPOS_EVALUADORES) {
      return res.status(200).json({
        success: true,
        clientId: `CLIENT-#0${MAX_CUPOS_EVALUADORES}`,
        message: 'Cupos máximos de Evaluadores Hora 0 alcanzados',
        disponibles: 0
      });
    }

    const nextNumber = totalAsignados + 1;
    const nextId = `CLIENT-#0${nextNumber}`;

    return res.status(200).json({
      success: true,
      clientId: nextId,
      disponibles: MAX_CUPOS_EVALUADORES - totalAsignados
    });

  } catch (error) {
    console.error('Error al resolver next-id evaluadores:', error);
    return res.status(500).json({
      success: false,
      clientId: 'CLIENT-#01',
      error: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/v1/clients/confirm-id
 * Confirma el ID de Evaluador en confirmacion.html
 */
router.post('/confirm-id', async (req, res) => {
  try {
    const { clientId } = req.body;

    if (!clientId) {
      return res.status(400).json({ success: false, error: 'clientId es requerido' });
    }

    if (!global.assignedEvaluadoresV35.includes(clientId)) {
      global.assignedEvaluadoresV35.push(clientId);
    }

    return res.status(200).json({
      success: true,
      clientId: clientId,
      assignedCount: global.assignedEvaluadoresV35.length,
      maxCupos: MAX_CUPOS_EVALUADORES
    });

  } catch (error) {
    console.error('Error al confirmar clientId de evaluador:', error);
    return res.status(500).json({ success: false, error: 'Error registrando ID de evaluador' });
  }
});


// ==========================================================================
// MÓDULO 2: WAITLIST SODIE V4 (50 Cupos - confirm-waitlist)
// ==========================================================================

/**
 * Función Helper exportada para generar automáticamente el ID V4 al pagar en la Waitlist
 */
function generateWaitlistV4ClientId() {
  if (global.assignedWaitlistV4.length >= MAX_CUPOS_WAITLIST_V4) {
    return `CLIENT-V4-#${MAX_CUPOS_WAITLIST_V4}`;
  }

  const nextIndex = global.assignedWaitlistV4.length + 1;
  const clientId = `CLIENT-V4-#${nextIndex}`;
  global.assignedWaitlistV4.push(clientId);
  return clientId;
}

/**
 * GET /api/v1/clients/waitlist/status
 * Estado de asignaciones para la V4
 */
router.get('/waitlist/status', (req, res) => {
  const confirmados = global.assignedWaitlistV4.length;
  return res.json({
    success: true,
    totalCupos: MAX_CUPOS_WAITLIST_V4,
    confirmados: confirmados,
    disponibles: Math.max(0, MAX_CUPOS_WAITLIST_V4 - confirmados)
  });
});

module.exports = router;
module.exports.generateWaitlistV4ClientId = generateWaitlistV4ClientId;
