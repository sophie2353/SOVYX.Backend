// api/ia/ia2-conversar.js
const express = require('express');
const router = express.Router();
const sovyxLogger = require('../../modules/sovyxLogger');
const ACCOUNTS = require('../../config/accounts');
const SOVYXIA2Conversor = require('../../modules/sovyxIA2Conversor');

// Endpoint para ManyChat/Webhook
router.post('/', async (req, res) => {
  try {
    const { mensaje, usuario_id, cuenta, nombre } = req.body;
    
    if (!mensaje || !cuenta) {
      return res.status(400).json({ 
        error: 'mensaje y cuenta requeridos' 
      });
    }
    
    const account = ACCOUNTS[cuenta];
    if (!account) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }
    
    // Inicializar IA2 con el estilo de la cuenta
    const ia2 = new SOVYXIA2Conversor(account.ia2_style || 'high_ticket_client');
    
    // Configurar contexto según la cuenta
    const contexto = {
      nombre: nombre || 'Cliente',
      producto: account.producto || 'Programa SOVYX',
      precio: account.precio || '5,000$'
    };
    
    // Generar respuesta
    const respuesta = await ia2.generarRespuesta({
      mensaje,
      usuario: { id: usuario_id, nombre },
      contexto
    });
    
    // Guardar en DB
    const db = require('../../modules/sovyxDatabase');
    await db.guardarInteraccion({
      usuario_id,
      cuenta,
      mensaje,
      respuesta: respuesta.mensaje,
      etapa: respuesta.etapa,
      probCierre: respuesta.probCierre,
      timestamp: new Date().toISOString()
    });
    
    // Responder en formato que ManyChat espera
    res.json({
      version: "v2",
      content: {
        messages: [
          { 
            type: "text", 
            text: respuesta.mensaje 
          }
        ]
      }
    });
    
  } catch (error) {
    sovyxLogger.error('Error en IA2 endpoint', { error: error.message });
    
    // Fallback amigable
    res.json({
      version: "v2",
      content: {
        messages: [
          { 
            type: "text", 
            text: "Gracias por tu mensaje. En breve te responderemos." 
          }
        ]
      }
    });
  }
});

// Endpoint para probar IA2 manualmente
router.post('/test', async (req, res) => {
  try {
    const { mensaje, estilo = 'high_ticket_client' } = req.body;
    
    const ia2 = new SOVYXIA2Conversor(estilo);
    
    const respuesta = await ia2.generarRespuesta({
      mensaje,
      usuario: { id: 'test', nombre: 'Test User' },
      contexto: {}
    });
    
    res.json({
      mensaje_recibido: mensaje,
      respuesta: respuesta
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para obtener resumen de conversación
router.get('/resumen/:usuarioId', async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const { cuenta } = req.query;
    
    const db = require('../../modules/sovyxDatabase');
    const conversaciones = await db.getConversacionesUsuario(usuarioId, cuenta);
    
    res.json({
      usuarioId,
      conversaciones: conversaciones || []
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
