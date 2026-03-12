// api/ia/ia1-segmentar.js
const express = require('express');
const router = express.Router();
const sovyxLogger = require('../../modules/sovyxLogger');

router.get('/segmentacion', async (req, res) => {
  try {
    const IA1 = require('../../modules/sovyxIA1Segmenter');
    const historial = require('../../data/historial/36-meses.json');
    const ia1 = new IA1(historial);
    
    const patrones = ia1.analyzeHistoricalData();
    const targeting = ia1.generateTargetingJSON();
    
    res.json({ patrones, targeting, audiencia: 2700000 });
    
  } catch (error) {
    sovyxLogger.error('Error en IA1', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post('/aprender', async (req, res) => {
  try {
    const { resultados } = req.body;
    
    const IA1 = require('../../modules/sovyxIA1Segmenter');
    const historial = require('../../data/historial/36-meses.json');
    const ia1 = new IA1(historial);
    
    const nuevoTargeting = await ia1.learnFromResults(resultados);
    
    res.json({ success: true, message: 'IA1 actualizada' });
    
  } catch (error) {
    sovyxLogger.error('Error actualizando IA1', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
