const express = require('express');
const router = express.Router();
const tokens = require('../config/tokens');

router.post('/tester-approved', (req, res) => {
  const { sessionId, adminKey } = req.body;
  
  if (adminKey !== tokens.SOVYX_ADMIN_KEY) {
    return res.status(403).json({ error: 'Llave de administración inválida' });
  }

  if (sessionsDB[sessionId]) {
    sessionsDB[sessionId].testerStatus = 'READY';
  } else {
    sessionsDB[sessionId] = { testerStatus: 'READY' };
  }

  res.json({ ok: true, message: 'Tester aprobado exitosamente 👺' });
});

module.exports = router;
