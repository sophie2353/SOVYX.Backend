// api/posts/publicar.js
const express = require('express');
const router = express.Router();
const config = require('../../config/tokens');
const sovyxLogger = require('../../modules/sovyxLogger');
const ACCOUNTS = require('../../config/accounts');

router.post('/', async (req, res) => {
  try {
    const { imageUrl, caption, tipo, dia, numero, cuentaId } = req.body;
    
    if (!imageUrl || !caption || !cuentaId) {
      return res.status(400).json({ error: 'imageUrl, caption y cuentaId requeridos' });
    }
    
    const account = ACCOUNTS[cuentaId];
    if (!account) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }
    
    const Simulador = require('../../modules/sovyxAdsSimulator');
    const simulador = new Simulador(
      account.instagram_token,
      config.facebook.token
    );
    
    await simulador.loadTargetingFromJSON(
      './data/targeting/sovyx-targeting.json'
    );
    
    const resultado = await simulador.publishAsAdWithoutPayment(
      imageUrl,
      caption,
      { tipo, dia, numero, cuenta: cuentaId }
    );
    
    const db = require('../../modules/sovyxDatabase');
    await db.guardarPost({
      id: resultado.id,
      cuenta: cuentaId,
      tipo, dia, numero, caption,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      postId: resultado.id,
      estimado: simulador.calculateEstimatedReach()
    });
    
  } catch (error) {
    sovyxLogger.error('Error publicando post', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
