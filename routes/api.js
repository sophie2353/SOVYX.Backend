// routes/api.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max

// POST /api/checkout/init
router.post('/checkout/init', (req, res) => {
  const { email, monto } = req.body;
  if (!email || !monto) return res.status(400).json({ error: 'Faltan datos requeridos' });
  
  return res.json({ 
    success: true, 
    sessionId: `SESS-${Date.now()}`,
    redirectUrl: `https://pasarela.com/pay?session=SESS-${Date.now()}`
  });
});

// POST /api/evaluator/contract
router.post('/evaluator/contract', upload.single('contractPdf'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió el PDF' });
  
  // Notifica al Admin sobre el contrato recibido
  console.log('Contrato listo para verificación:', req.body.email);
  return res.json({ success: true, message: 'Contrato recibido para validación' });
});

// POST /api/evaluator/fb-sync
router.post('/evaluator/fb-sync', (req, res) => {
  const { email, fbUser } = req.body;
  if (!email || !fbUser) return res.status(400).json({ error: 'Faltan credenciales de FB' });
  
  return res.json({ success: true, message: 'FB sincronizado' });
});

module.exports = router;
