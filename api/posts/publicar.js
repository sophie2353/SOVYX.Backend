const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const fs = require('fs').promises;
const sovyxLogger = require('../../modules/sovyxLogger');
const ACCOUNTS = require('../../config/accounts');

// ============================================
// PUBLICAR POST CON TARGETING
// ============================================
router.post('/', async (req, res) => {
  try {
    const { imageUrl, caption, tipo, dia, numero, cuentaId, nicho } = req.body;
    
    if (!imageUrl || !caption || !cuentaId) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    
    const account = ACCOUNTS[cuentaId];
    if (!account) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }
    
    sovyxLogger.info('📤 Publicando post con targeting', { 
      cuenta: cuentaId, 
      tipo, 
      dia, 
      numero 
    });
    
    // 1. CARGAR TARGETING DESDE JSON
    let targetingJson;
    try {
      const data = await fs.readFile('./data/targeting/sovyx-targeting.json', 'utf8');
      targetingJson = JSON.parse(data);
      
      // Limpiar metadata interna (no enviar a Meta)
      delete targetingJson.sovyx_metadata;
      
    } catch (error) {
      sovyxLogger.error('Error cargando targeting', { error: error.message });
      return res.status(500).json({ error: 'Error cargando segmentación' });
    }
    
    // 2. SUBIR IMAGEN A INSTAGRAM
    const mediaId = await uploadMedia(imageUrl, account.instagram_token);
    
    const publishUrl = `https://graph.instagram.com/v25.0/me/media_publish`;
    
    const body = {
      creation_id: mediaId,
      caption: caption,
      targeting_spec: targetingJson, 
      published: true
    };
    
    const response = await fetch(publishUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${account.instagram_token}`
      },
      body: JSON.stringify(body)
    });
    
    const data = await response.json();
    
    if (data.error) {
      sovyxLogger.error('Error de Instagram', { error: data.error });
      
      // Fallback: publicar sin targeting
      const fallbackResult = await publishNormal(mediaId, caption, account.instagram_token);
      return res.json({
        success: true,
        message: '⚠️ Post publicado sin targeting (fallback)',
        postId: fallbackResult.id,
        cuenta: account.name,
        modo: 'sin_targeting'
      });
    }
    
    // 4. GUARDAR EN BASE DE DATOS
    const db = require('../../modules/sovyxDatabase');
    await db.guardarPost({
      id: data.id,
      cuenta: cuentaId,
      tipo,
      dia,
      numero,
      nicho,
      caption,
      targeting_usado: 'sovyx-targeting.json',
      timestamp: new Date().toISOString()
    });
    
    // 5. RESPONDER
    res.json({
      success: true,
      message: '✅ EXITOSO - Post publicado con targeting',
      postId: data.id,
      cuenta: account.name,
      modo: account.budget === 0 ? 'hack (sin presupuesto)' : `${account.budget}$/día`,
      targeting: {
        edad: targetingJson.age_range,
        paises: targetingJson.geo_locations?.countries,
        ciudades: targetingJson.geo_locations?.cities?.map(c => c.name)
      }
    });
    
  } catch (error) {
    sovyxLogger.error('Error en publicación', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// FUNCIÓN AUXILIAR: SUBIR IMAGEN
// ============================================
async function uploadMedia(imageUrl, token) {
  const createUrl = `https://graph.instagram.com/v25.0/me/media`;
  const createBody = {
    image_url: imageUrl,
    access_token: token,
    media_type: 'IMAGE'
  };
  
  const response = await fetch(createUrl, {
    method: 'POST',
    body: JSON.stringify(createBody),
    headers: { 'Content-Type': 'application/json' }
  });
  
  const data = await response.json();
  return data.id;
}

// ============================================
// FUNCIÓN AUXILIAR: PUBLICACIÓN NORMAL (FALLBACK)
// ============================================
async function publishNormal(mediaId, caption, token) {
  const response = await fetch(
    `https://graph.instagram.com/me/media_publish?access_token=${token}`,
    {
      method: 'POST',
      body: JSON.stringify({
        creation_id: mediaId,
        caption: caption
      }),
      headers: { 'Content-Type': 'application/json' }
    }
  );
  
  return await response.json();
}

module.exports = router;
