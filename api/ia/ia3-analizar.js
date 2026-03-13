// api/ia/ia3-analizar.js
// ENDPOINT para IA3 - Analiza y retroalimenta IA1 e IA2

const express = require('express');
const router = express.Router();
const sovyxLogger = require('../../modules/sovyxLogger');
const SOVYXIA3Analyzer = require('../../modules/sovyxIA3Analyzer');

// ============================================
// ANALIZAR COMPRADORES (MANUAL)
// ============================================
router.post('/analizar', async (req, res) => {
  try {
    const { compradores, cuenta } = req.body;
    
    if (!compradores || !compradores.length) {
      return res.status(400).json({ error: 'compradores requeridos' });
    }
    
    sovyxLogger.info('🔬 IA3: Analizando compradores manualmente', { 
      cantidad: compradores.length,
      cuenta 
    });
    
    const ia3 = new SOVYXIA3Analyzer();
    
    // Encontrar patrón
    const patron = ia3.encontrarPatronCompradores(compradores);
    
    // Retroalimentar IA1 e IA2
    await ia3.retroalimentarConCompradores(compradores, cuenta || 'default');
    
    res.json({
      success: true,
      message: '✅ IA1 e IA2 actualizadas con el patrón',
      compradores_analizados: compradores.length,
      patron_encontrado: patron
    });
    
  } catch (error) {
    sovyxLogger.error('Error en IA3 analizar', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ANALIZAR POST ESPECÍFICO
// ============================================
router.post('/analizar-post/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const { cuenta } = req.body;
    
    if (!postId) {
      return res.status(400).json({ error: 'postId requerido' });
    }
    
    sovyxLogger.info('🔬 IA3: Analizando post', { postId, cuenta });
    
    const ia3 = new SOVYXIA3Analyzer();
    
    const resultado = await ia3.analizarPostYRetroalimentar(postId, cuenta || 'default');
    
    res.json({
      success: true,
      message: '✅ Post analizado y retroalimentación aplicada',
      ...resultado
    });
    
  } catch (error) {
    sovyxLogger.error('Error analizando post', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// OBTENER PROYECCIÓN A 27,000
// ============================================
router.get('/proyeccion/:cuenta', async (req, res) => {
  try {
    const { cuenta } = req.params;
    
    const db = require('../../modules/sovyxDatabase');
    const compradores = await db.getCompradoresReales(cuenta);
    
    if (!compradores || compradores.length < 1) {
      return res.status(404).json({ 
        error: 'Necesitas al menos 1 comprador para proyectar' 
      });
    }
    
    const ia3 = new SOVYXIA3Analyzer();
    
    const patron = ia3.encontrarPatronCompradores(compradores);
    
    // Calcular proyección
    const factor = 27000 / compradores.length;
    const diasEstimados = Math.ceil(factor * 3); // 3 días por comprador aprox
    
    res.json({
      success: true,
      cuenta,
      compradores_actuales: compradores.length,
      proyeccion_27000: {
        factible: true,
        dias_estimados: diasEstimados,
        fecha_estimada: new Date(Date.now() + diasEstimados * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        patron_actual: patron
      }
    });
    
  } catch (error) {
    sovyxLogger.error('Error en proyección', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================
 // FORZAR RETROALIMENTACIÓN MANUAL
// ============================================
router.post('/retroalimentar-forzar', async (req, res) => {
  try {
    const { cuenta, patron } = req.body;
    
    const ia3 = new SOVYXIA3Analyzer();
    
    // Simular compradores con el patrón
    const compradoresSimulados = [
      { edad: patron.edad || 35, pais: 'US', ciudad: 'Miami', intereses: ['Coaching'] }
    ];
    
    await ia3.retroalimentarConCompradores(compradoresSimulados, cuenta || 'default');
    
    res.json({
      success: true,
      message: '✅ Retroalimentación forzada aplicada'
    });
    
  } catch (error) {
    sovyxLogger.error('Error en retroalimentación forzada', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
