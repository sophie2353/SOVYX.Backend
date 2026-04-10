const express = require('express');
const router = express.Router();
const sovyxLogger = require('../../modules/sovyxLogger');
const IA1 = require('../../modules/sovyxIA1Segmenter');
const MetaAPI = require('../../modules/metaAdsApi'); // El sistema nervioso

// Instanciamos la IA1 una sola vez
const ia1 = new IA1();

/**
 * RUTA: GENERAR Y LANZAR EN META
 * Aquí es donde ocurre la magia.
 */
router.post('/lanzar', async (req, res) => {
  try {
    const { nicho, esPrimeraVez, customParams } = req.body;

    if (!nicho) {
      return res.status(400).json({ error: "Debes especificar un nicho (ej: fitness_coach)" });
    }

    // 1. La IA1 genera el JSON con los filtros High Ticket y el status (PAUSED/ACTIVE)
    const segmentacion = ia1.generarSegmentacion(nicho, esPrimeraVez, customParams);
    
    // 2. SOVYX inyecta el anuncio directamente en Meta Ads
    const adSetId = await MetaAPI.lanzarCampanaSovyx(segmentacion);

    sovyxLogger.info('SOVYX: Lanzamiento exitoso', { nicho, adSetId, status: segmentacion.status });

    res.json({ 
      success: true, 
      message: esPrimeraVez ? 'Anuncio en BORRADOR creado. Ve a Meta para poner la tarjeta.' : 'Anuncio ACTIVO y rodando.',
      adSetId,
      segmentacion 
    });
    
  } catch (error) {
    sovyxLogger.error('Error lanzando con SOVYX', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * RUTA: APRENDER (IA3 -> IA1)
 * Para cuando cerremos ventas y queramos mejorar el targeting
 */
router.post('/aprender', async (req, res) => {
  try {
    const { resultados } = req.body;
    // Aquí la lógica de aprendizaje se activará cuando la IA3 envíe datos
    sovyxLogger.info('IA1 recibiendo datos de optimización de IA3');
    
    res.json({ success: true, message: 'IA1 alineada con los nuevos patrones de IA3 👺' });
    
  } catch (error) {
    sovyxLogger.error('Error actualizando IA1', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
