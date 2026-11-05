const express = require('express');
const router = express.Router();
const timeService = require('../services/timeDashboardService');

router.get('/get-timer', async (req, res) => {
  try {
    const { clientId } = req.query;
    const data = await timeService.obtenerOTier(clientId);
    return res.json({ success: true, ...data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/reset-timer', async (req, res) => {
  try {
    const { clientId } = req.body;
    const data = await timeService.reiniciarTimer(clientId);
    return res.json({ success: true, ...data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
