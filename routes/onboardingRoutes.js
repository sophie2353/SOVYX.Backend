const express = require('express');
const router = express.Router();
const sessionsDB = require('../config/db');

// Registro de usuario FB para Tester
router.post('/tester-request', (req, res) => {
  const { sessionId, fbUser } = req.body;
  if (!sessionId || !fbUser) return res.status(400).json({ error: 'Faltan datos requeridos' });

  sessionsDB[sessionId] = {
    ...sessionsDB[sessionId],
    fbUser,
    testerStatus: 'PENDING'
  };

  res.json({ ok: true, status: 'PENDING' });
});

// Polling de estado desde el Frontend
router.get('/status', (req, res) => {
  const { sessionId } = req.query;
  const session = sessionsDB[sessionId];
  res.json({ status: session?.testerStatus || 'NOT_STARTED' });
});

module.exports = router;
