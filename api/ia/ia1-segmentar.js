const express = require('express');
const router = express.Router();

// Módulos internos
const sovyxLogger = require('../../modules/sovyxLogger');
const IA1 = require('../../modules/sovyxIA1Segmenter');
const MetaAPI = require('../../modules/metaService'); // Asegura la referencia a MetaAPI
const Audiencia = require('../../models/Audiencia');

// Instancia única de la IA1
const ia1 = new IA1();

/**
 * RUTA: GENERAR Y LANZAR EN META (/lanzar)
 * Carga datos de MongoDB (extraídos del upload), genera targeting High Ticket e inyecta en Meta.
 */
router.post('/lanzar', async (req, res) => {
  try {
    const { nicho, esPrimeraVez, customParams, sessionId, audienciaId } = req.body;

    if (!nicho && !sessionId && !audienciaId) {
      return res.status(400).json({ error: "Debes especificar un nicho o enviar un sessionId/audienciaId válido" });
    }

    // 1. Extraer la data subida desde MongoDB si existe la sesión
    let dataMongo = null;
    if (sessionId || audienciaId) {
      const query = audienciaId ? { _id: audienciaId } : { sessionId: sessionId };
      dataMongo = await Audiencia.findOne(query).sort({ updatedAt: -1 });
    }

    // 2. Definir el nicho base a partir de MongoDB o del payload
    const nichoObjetivo = nicho || (dataMongo?.segmentacion?.nicho) || "fitness_coach";
    const parametrosCombinados = {
      ...customParams,
      targetingExtraido: dataMongo?.segmentacion || null
    };

    // 3. La IA1 genera el JSON con los filtros High Ticket y el status (PAUSED/ACTIVE)
    const segmentacion = ia1.generarSegmentacion(nichoObjetivo, esPrimeraVez, parametrosCombinados);
    
    // 4. SOVYX inyecta el anuncio directamente en Meta Ads
    const adSetId = await MetaAPI.lanzarCampanaSovyx(segmentacion);

    // 5. Guardar/Actualizar estado en MongoDB
    if (dataMongo) {
      dataMongo.estado = segmentacion.status === 'ACTIVE' ? 'CAMPAÑA_ACTIVADA' : 'PENDIENTE_CONFIRMACION';
      dataMongo.metaCampaignId = adSetId;
      dataMongo.activatedAt = new Date();
      await dataMongo.save();
    }

    sovyxLogger.info('SOVYX: Lanzamiento exitoso', { nicho: nichoObjetivo, adSetId, status: segmentacion.status });

    return res.json({ 
      success: true, 
      message: esPrimeraVez ? 'Anuncio en BORRADOR creado. Ve a Meta para poner la tarjeta.' : 'Anuncio ACTIVO y rodando.',
      adSetId,
      segmentacion 
    });
    
  } catch (error) {
    sovyxLogger.error('Error lanzando con SOVYX', { error: error.message });
    return res.status(500).json({ error: error.message });
  }
});

/**
 * RUTA: ALIAS DE ACTIVACIÓN (/activar)
 * Mantiene compatibilidad con llamados desde el frontend
 */
router.post('/activar', async (req, res) => {
  req.url = '/lanzar';
  return router.handle(req, res);
});

/**
 * RUTA: APRENDER (IA3 -> IA1)
 * Optimiza el targeting cuando la IA3 analiza patrones de ventas cerradas
 */
router.post('/aprender', async (req, res) => {
  try {
    const { resultados } = req.body;
    
    // Actualización del modelo interno de IA1 con el feedback de IA3
    if (typeof ia1.actualizarPatrones === 'function') {
      ia1.actualizarPatrones(resultados);
    }

    sovyxLogger.info('IA1 recibiendo datos de optimización de IA3', { resultados });
    
    return res.json({ success: true, message: 'IA1 alineada con los nuevos patrones de IA3 👺' });
    
  } catch (error) {
    sovyxLogger.error('Error actualizando IA1', { error: error.message });
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
