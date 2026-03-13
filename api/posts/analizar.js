// api/posts/analizar.js
// Endpoint para analizar resultados de posts y activar IA3

const express = require('express');
const router = express.Router();
const sovyxLogger = require('../../modules/sovyxLogger');
const SOVYXIA3Analyzer = require('../../modules/sovyxIA3Analyzer');

// ============================================
// ANALIZAR UN POST ESPECÍFICO (CON IA3)
// ============================================
router.get('/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    
    if (!postId) {
      return res.status(400).json({ error: 'postId requerido' });
    }
    
    sovyxLogger.info('📊 Analizando post', { postId });
    
    // 1. Obtener datos del post de la base de datos
    const db = require('../../modules/sovyxDatabase');
    const post = await db.getPost(postId);
    
    if (!post) {
      return res.status(404).json({ error: 'Post no encontrado' });
    }
    
    // 2. Obtener insights de Meta (si está disponible)
    const simulador = new SOVYXAdsSimulator();
    const insights = await simulador.getPostInsights(postId);
    
    // 3. Obtener interacciones de IA2 para este post
    const interacciones = await db.getInteraccionesPorPost(postId) || [];
    
    // 4. Identificar compradores potenciales (etapa calificado o alta probabilidad)
    const compradores = interacciones.filter(i => 
      i.etapa === 'calificado' || (i.probCierre && i.probCierre > 0.7)
    );
    
    // 5. Calcular métricas
    const metricas = {
      alcance: insights.find(i => i.name === 'reach')?.values[0]?.value || post.alcance || 0,
      impresiones: insights.find(i => i.name === 'impressions')?.values[0]?.value || 0,
      interacciones_web: insights.find(i => i.name === 'website_clicks')?.values[0]?.value || 0,
      dms_recibidos: interacciones.length,
      conversiones: compradores.length,
      tasa_conversion: interacciones.length > 0 
        ? ((compradores.length / interacciones.length) * 100).toFixed(1) 
        : 0
    };
    
    // 6. 🔥 ACTIVAR IA3 EN BACKGROUND (retroalimentación automática)
    //    Esto se ejecuta después de enviar la respuesta
    setImmediate(async () => {
      try {
        sovyxLogger.info('🔄 IA3: Iniciando análisis automático', { postId, cuenta: post.cuenta });
        
        const ia3 = new SOVYXIA3Analyzer();
        
        // Si hay compradores, retroalimentar
        if (compradores.length > 0) {
          await ia3.retroalimentarConCompradores(compradores, post.cuenta);
          sovyxLogger.success('✅ IA3: Retroalimentación completada', { 
            compradores: compradores.length,
            cuenta: post.cuenta 
          });
        } else {
          sovyxLogger.info('ℹ️ IA3: Sin compradores para retroalimentar', { postId });
        }
        
        // Guardar análisis en DB
        await db.guardarAnalisisPost({
          postId,
          cuenta: post.cuenta,
          timestamp: new Date().toISOString(),
          metricas,
          compradores_encontrados: compradores.length
        });
        
      } catch (error) {
        sovyxLogger.error('Error en IA3 background', { error: error.message, postId });
      }
    });
    
    // 7. Responder inmediatamente (no esperar a IA3)
    res.json({
      success: true,
      postId,
      post: {
        id: post.id,
        cuenta: post.cuenta,
        tipo: post.tipo,
        dia: post.dia,
        numero: post.numero,
        nicho: post.nicho,
        caption: post.caption?.substring(0, 100) + '...',
        publicado: post.timestamp
      },
      metricas,
      compradores_detectados: compradores.length,
      interacciones_recientes: interacciones.slice(-5), // últimas 5
      ia3_activada: compradores.length > 0,
      mensaje: compradores.length > 0 
        ? '✅ IA3 analizando compradores para mejorar IA1 e IA2' 
        : 'ℹ️ Sin compradores detectados. IA3 no necesita actuar.'
    });
    
  } catch (error) {
    sovyxLogger.error('Error analizando post', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ANALIZAR TODOS LOS POSTS DE UNA CUENTA
// ============================================
router.get('/cuenta/:cuentaId', async (req, res) => {
  try {
    const { cuentaId } = req.params;
    const { limite = 10 } = req.query;
    
    const db = require('../../modules/sovyxDatabase');
    const posts = await db.getPostsPorCuenta(cuentaId, parseInt(limite));
    
    const resultados = [];
    
    for (const post of posts) {
      const interacciones = await db.getInteraccionesPorPost(post.id) || [];
      const compradores = interacciones.filter(i => i.etapa === 'calificado');
      
      resultados.push({
        id: post.id,
        tipo: post.tipo,
        dia: post.dia,
        publicado: post.timestamp,
        total_dms: interacciones.length,
        conversiones: compradores.length,
        tasa: interacciones.length > 0 
          ? ((compradores.length / interacciones.length) * 100).toFixed(1) + '%'
          : '0%'
      });
    }
    
    res.json({
      success: true,
      cuenta: cuentaId,
      total: resultados.length,
      posts: resultados
    });
    
  } catch (error) {
    sovyxLogger.error('Error analizando cuenta', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// OBTENER ESTADÍSTICAS GLOBALES
// ============================================
router.get('/estadisticas/globales', async (req, res) => {
  try {
    const db = require('../../modules/sovyxDatabase');
    
    const todosPosts = await db.getTodosLosPosts() || [];
    const todasInteracciones = await db.getTodasLasInteracciones() || [];
    
    const totalPosts = todosPosts.length;
    const totalDMs = todasInteracciones.length;
    const totalConversiones = todasInteracciones.filter(i => i.etapa === 'calificado').length;
    
    // Posts por tipo
    const postsPorTipo = {};
    todosPosts.forEach(p => {
      postsPorTipo[p.tipo] = (postsPorTipo[p.tipo] || 0) + 1;
    });
    
    res.json({
      success: true,
      global: {
        totalPosts,
        totalDMs,
        totalConversiones,
        tasaConversionGlobal: totalDMs > 0 
          ? ((totalConversiones / totalDMs) * 100).toFixed(1) 
          : 0
      },
      postsPorTipo,
      ultimosPosts: todosPosts.slice(-5).map(p => ({
        id: p.id,
        tipo: p.tipo,
        fecha: p.timestamp
      }))
    });
    
  } catch (error) {
    sovyxLogger.error('Error en estadísticas globales', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// FORZAR RE-ANÁLISIS DE UN POST (con IA3)
// ============================================
router.post('/reanalizar/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const { forzar_ia3 } = req.body;
    
    const db = require('../../modules/sovyxDatabase');
    const post = await db.getPost(postId);
    
    if (!post) {
      return res.status(404).json({ error: 'Post no encontrado' });
    }
    
    // Obtener interacciones actualizadas
    const interacciones = await db.getInteraccionesPorPost(postId) || [];
    const compradores = interacciones.filter(i => i.etapa === 'calificado');
    
    let ia3_resultado = null;
    
    // Forzar IA3 si se solicita
    if (forzar_ia3 && compradores.length > 0) {
      sovyxLogger.info('🔄 IA3: Re-análisis forzado', { postId });
      
      const ia3 = new SOVYXIA3Analyzer();
      ia3_resultado = await ia3.retroalimentarConCompradores(compradores, post.cuenta);
    }
    
    res.json({
      success: true,
      message: forzar_ia3 ? '✅ Re-análisis completado' : '✅ Datos actualizados',
      postId,
      interacciones_actuales: interacciones.length,
      compradores_actuales: compradores.length,
      ia3_ejecutada: !!ia3_resultado,
      ia3_resultado
    });
    
  } catch (error) {
    sovyxLogger.error('Error en re-análisis', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
