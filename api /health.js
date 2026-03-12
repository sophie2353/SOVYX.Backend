// api/health.js
const express = require('express');
const router = express.Router();
const config = require('../config/tokens');

router.get('/', (req, res) => {
  res.json({
    status: '🟢 SOVYX OPERATIONAL',
    mode: config.sovyx.mode,
    timestamp: new Date().toISOString(),
    targeting: 'Cargado desde JSON',
    ia_status: {
      ia1: 'active',
      ia2: 'active', 
      ia3: 'active'
    }
  });
});

module.exports = router;
