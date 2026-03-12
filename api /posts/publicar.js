// api/posts/publicar.js
const express = require('express');
const router = express.Router();
const sovyxLogger = require('../../modules/sovyxLogger');
const ACCOUNTS = require('../../config/accounts');
const SOVYXAdsSimulator = require('../../modules/sovyxAdsSimulator');

router.post('/', async (req, res) => {
  try {
    const { imageUrl, caption, tipo, dia, numero, cuentaId, nicho } = req.body;
    
    if (!imageUrl || !caption || !cuentaId) {
      return res.status(400).json({ error: 'Faltan campos' });
    }
    
    const account = ACCOUNTS[cuentaId];
    if (!account) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }
    
    sovyxLogger.info('📤 Publicando post', { cuenta: cuentaId, tipo, dia, numero });
    
    const simulador = new SOVYXAdsSimulator(
      account.instagram_token,
      process.env.FB_ACCESS_TOKEN
    );
    
    // Cargar targeting
    await simulador.loadTargetingFromJSON('./data/targeting/sovyx-targeting.json');
    
    // Publicar con hack
    const resultado = await simulador.publishAsAdWithoutPayment(
      imageUrl,
      caption,
      { tipo, dia, numero, cuenta: cuentaId, nicho }
    );
    
    // Guardar
    const db = require('../../modules/sovyxDatabase');
    await db.guardarPost({
      id: resultado.id,
      cuenta: cuentaId,
      tipo,
      dia,
      numero,
      nicho,
      caption,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: '✅ Post publicado',
      postId: resultado.id,
      cuenta: account.name
    });
    
  } catch (error) {
    sovyxLogger.error('Error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
