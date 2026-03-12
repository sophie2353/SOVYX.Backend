// api/ia/generar-segmentacion.js - NUEVO ENDPOINT
const express = require('express');
const router = express.Router();
const IA1 = require('../../modules/sovyxIA1Segmenter');

router.post('/', async (req, res) => {
  try {
    const { nicho, customParams } = req.body;
    
    const ia1 = new IA1();
    const segmentacion = ia1.generarSegmentacion(nicho, customParams);
    const copyEjemplo = {
      problema: ia1.generarCopy(nicho, 'problema'),
      sueno: ia1.generarCopy(nicho, 'sueno'),
      social: ia1.generarCopy(nicho, 'social')
    };
    
    res.json({
      nicho,
      segmentacion,
      copyEjemplo,
      audiencia_estimada: segmentacion.audience_size
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para sugerir nichos por keywords
router.post('/sugerir', async (req, res) => {
  try {
    const { keywords } = req.body;
    const ia1 = new IA1();
    const sugerencias = ia1.sugerirNichos(keywords);
    
    res.json({ sugerencias });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
