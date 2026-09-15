const express = require('express');
const router = express.Router();
const path = require('path');

// GET /api/v1/media/active-video
// Devuelve la URL directa del video servido estáticamente
router.get('/active-video', (req, res) => {
  return res.json({
    success: true,
    videoUrl: '/video_demo.mp4'
  });
});

// GET /api/v1/media/contract
// Devuelve la URL directa del PDF del contrato
router.get('/contract', (req, res) => {
  return res.json({
    success: true,
    contractUrl: '/contrato.pdf'
  });
});

module.exports = router;
