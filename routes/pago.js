const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const tokens = require('../config/tokens');

// Base de datos temporal en memoria (Sincronizable con MongoDB)
global.sessionsDB = global.sessionsDB || {};
global.uploadedPdfsDB = global.uploadedPdfsDB || {};

// Aprobación de Evaluador / Tester
router.post('/tester-approved', (req, res) => {
  const { sessionId, adminKey } = req.body;
  
  if (adminKey !== tokens.SOVYX_ADMIN_KEY) {
    return res.status(403).json({ error: 'Llave de administración inválida' });
  }

  if (global.sessionsDB[sessionId]) {
    global.sessionsDB[sessionId].testerStatus = 'READY';
    global.sessionsDB[sessionId].paid = true;
  } else {
    global.sessionsDB[sessionId] = { testerStatus: 'READY', paid: true };
  }

  res.json({ ok: true, message: 'Tester aprobado exitosamente 👺', sessionId });
});

// Descargar PDF asignado al cliente después del pago
router.get('/descargar-pdf/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = global.sessionsDB[sessionId];

  if (!session || !session.paid) {
    return res.status(403).json({ error: 'Acceso denegado: El pago no ha sido verificado.' });
  }

  const pdfFileName = global.uploadedPdfsDB[sessionId] || 'SODIE_Entregable_Cliente.pdf';
  const filePath = path.join(__dirname, '../uploads/pdfs', pdfFileName);

  if (fs.existsSync(filePath)) {
    return res.download(filePath, pdfFileName);
  } else {
    return res.status(404).json({ error: 'El archivo PDF aún no ha sido cargado por el administrador.' });
  }
});

module.exports = router;
