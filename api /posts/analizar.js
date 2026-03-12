// api/posts/analizar.js
const express = require('express');
const router = express.Router();
const sovyxLogger = require('../../modules/sovyxLogger');

router.get('/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    
    const db = require('../../modules/sovyxDatabase');
    const post = await db.getPost(postId);
    
    if (!post) {
      return res.status(404).json({ error: 'Post no encontrado' });
    }
    
    const Simulador = require('../../modules/sovyxAdsSimulator');
    const simulador = new Simulador();
    
    const insights = await simulador.getPostInsights(postId);
    
    res.json({ postId, insights, timestamp: new Date().toISOString() });
    
  } catch (error) {
    sovyxLogger.error('Error analizando post', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
