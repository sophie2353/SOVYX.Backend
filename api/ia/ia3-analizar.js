// api/ia/ia3-analizar.js
const express = require('express');
const router = express.Router();
const sovyxLogger = require('../../modules/sovyxLogger');
const SOVYXIA3Analyzer = require('../../modules/sovyxIA3Analyzer');

const ia3 = new SOVYXIA3Analyzer();

// ANALIZAR COMPRADORES Y MEJORAR EL SISTEMA
router.post('/analizar', async (req, res) => {
  try {
    const { compradores, cuenta } = req.body;
    
    if (!compradores || !compradores.length) {
      return res.status(400).json({ error: 'Se requieren datos de compradores' });
    }
    
    // 1. Analizar patrones
    const patron = await ia3.retroalimentarConCompradores(compradores, cuenta || 'default');
    
    res.json({
      success: true,
      message: '✅ IA1 y IA2 optimizadas con nuevos datos de éxito',
      patron_detectado: patron
    });
    
  } catch (error) {
    sovyxLogger.error('IA3: Error en análisis', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// PROYECCIÓN DE ESCALA A 27,000 USDT
router.get('/proyeccion/:cuenta', async (req, res) => {
  try {
    const { cuenta } = req.params;
    
    // Aquí podrías conectar tu DB real
    // const compradores = await db.getCompradoresReales(cuenta);
    const compradoresSimulados = [1, 2]; // Solo para el ejemplo de la lógica

    const facturacionActual = compradoresSimulados.length * 5000;
    const meta = 27000;
    const falta = meta - facturacionActual;
    
    res.json({
      cuenta,
      status: "Análisis de Escala 📈",
      facturacion_actual: facturacionActual,
      objetivo: meta,
      restante: falta > 0 ? falta : 0,
      mensaje: falta <= 0 ? "Meta de 27k alcanzada 👺💅🏽" : `Faltan ${falta/5000} ventas para el objetivo.`
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
