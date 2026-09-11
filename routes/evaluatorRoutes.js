const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Cargar logger o fallback
let sovyxLogger;
try {
  sovyxLogger = require('../modules/sovyxLogger');
} catch (e) {
  try {
    sovyxLogger = require('./modules/sovyxLogger');
  } catch (err) {
    sovyxLogger = null;
  }
}

// ============================================
// ENDPOINTS DE EVALUADOR & CONTRATO PDF
// ============================================

// POST /contract & POST /api/evaluator/contract
const handleContractUpload = (req, res) => {
  try {
    const logMessage = 'Contrato recibido correctamente en el panel de administración.';
    
    // Log centralizado o consola
    if (sovyxLogger && sovyxLogger.info) {
      sovyxLogger.info(logMessage, { payload: req.body, file: req.file || null });
    } else {
      console.log(`📑 [EVALUATOR]: ${logMessage}`);
    }

    return res.status(200).json({
      success: true,
      status: 'PENDING_ADMIN_REVIEW',
      message: logMessage,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (sovyxLogger && sovyxLogger.error) {
      sovyxLogger.error('Error procesando recepción de contrato PDF', { error: error.message });
    }
    return res.status(500).json({
      success: false,
      error: 'Error interno al procesar la recepción del contrato.'
    });
  }
};

// Mapeo directo de rutas de contrato
router.post('/contract', handleContractUpload);
router.post('/contrato', handleContractUpload);

// GET Estado del contrato/evaluación
router.get('/status', (req, res) => {
  res.json({
    status: 'EVALUATOR_ACTIVE',
    mode: 'AUTOMATED_VERIFICATION',
    message: 'Módulo de evaluación y revisión de contratos sincronizado.'
  });
});

module.exports = router;
