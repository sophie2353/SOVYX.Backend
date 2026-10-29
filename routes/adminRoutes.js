const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const Client = require('../models/clients');

// Cargar configuración global/tokens
let config = {};
try {
  config = require('../config/tokens');
} catch (e) {
  try {
    config = require('../config/tokens');
  } catch (err) {
    console.warn('⚠️ [ADMIN ROUTES] No se pudo cargar config/tokens, usando fallbacks de env.');
  }
}

/* ==========================================================================
   1. LOGIN DE ADMINISTRADOR
   ========================================================================== */
router.post('/login', (req, res) => {
  const { password } = req.body;
  const adminKey = process.env.ADMIN_KEY || config.ADMIN_KEY || '';

  if (!password) {
    return res.status(400).json({ success: false, message: 'Contraseña requerida' });
  }

  if (password === adminKey) {
    return res.json({ success: true, message: 'Acceso de administración autorizado' });
  } else {
    return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
  }
});

/* ==========================================================================
   2. EXPORTACIÓN DE DATOS AUDIENCIA / CSV
   ========================================================================== */
router.get('/export/export-clientes-hora48', (req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="audiencia_sodie_48h.csv"');
  res.status(200).send('ID,Nombre,Email,Status,Presupuesto\n1,Cliente Demo,demo@sodie.app,ACTIVE,10000USD');
});

module.exports = router;
