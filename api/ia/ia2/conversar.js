const express = require('express');
const router = express.Router();
const SOVYXIA2Conversor = require('../modules/sovyxIA2Conversor');
const sovyxLogger = require('../modules/sovyxLogger');

// Instancia única del conversor
const ia2 = new SOVYXIA2Conversor();

/**
 * ENDPOINT DE CONVERSACIÓN IA2 (POST)
 * Recibe el mensaje, payload o tipo de negocio desde el Frontend,
 * lo procesa a través del módulo y devuelve la respuesta JSON.
 */
router.post('/', async (req, res) => {
  try {
    const { mensaje, text, payload, tipo, sessionId } = req.body;
    
    const textoCliente = mensaje || text || '';
    const idSesion = sessionId || 'session_guest';

    if (sovyxLogger && sovyxLogger.info) {
      sovyxLogger.info(`SOVYX IA2: Procesando solicitud para sesión ${idSesion} | Tipo: ${tipo || 'general'}`);
    }

    // Procesar con el módulo conversacional actualizado
    const respuestaIA2 = await ia2.generarRespuesta({
      mensaje: textoCliente,
      sessionId: idSesion,
      payload: payload,
      tipo: tipo
    });

    return res.json({
      success: true,
      reply: respuestaIA2.mensaje,
      intencion: respuestaIA2.intencion,
      quickReplies: respuestaIA2.quickReplies,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    if (sovyxLogger && sovyxLogger.error) {
      sovyxLogger.error('Error procesando respuesta en IA2', { error: error.message });
    }
    console.error('💥 Error en IA2 Router:', error);
    
    return res.status(500).json({
      success: false,
      reply: "Sistema SOVYX: Ocurrió una interrupción temporal en el motor de IA2. Reintentando...",
      quickReplies: [
        { label: "¿Cómo funciona?", payload: "como_funciona" },
        { label: "Reservar slot ($1,000)", payload: "acceder" }
      ]
    });
  }
});

module.exports = router;
