const express = require('express');
const router = express.Router();
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload-csv', upload.single('file'), (req, res) => {
  const { sessionId } = req.body;
  if (!req.file) return res.status(400).json({ error: 'Archivo no recibido' });

  // Extracción de patrones para el Targeting (Simulado/Inferencia de data)
  const extractedTargeting = {
    age_min: 22,
    age_max: 45,
    geo_locations: { countries: ['US', 'MX', 'CO'] },
    interests: [{ id: '6003139266661', name: 'Digital Marketing' }]
  };

  sessionsDB[sessionId] = {
    ...sessionsDB[sessionId],
    fileUploaded: true,
    targetingData: extractedTargeting
  };

  res.json({ ok: true, targeting: extractedTargeting });
});

module.exports = router;
