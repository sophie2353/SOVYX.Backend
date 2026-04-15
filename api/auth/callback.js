// api/auth/callback.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const config = require('../../config/tokens');
const sovyxLogger = require('../../modules/sovyxLogger');
const db = require('../../modules/sovyxDatabase');

router.get('/ig/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("Error: No se recibió el código de autorización.");
  }

  try {
    sovyxLogger.info("Procesando nuevo código de autorización de Meta...");

    // 1. Intercambiar CODE por TOKEN CORTO (2 horas)
    const responseShort = await axios.get('https://graph.facebook.com/v25.0/oauth/access_token', {
      params: {
        client_id: config.fb.appId,
        client_secret: config.fb.appSecret,
        redirect_uri: `https://tu-app-en-render.onrender.com/api/auth/ig/callback`,
        code: code
      }
    });

    const shortToken = responseShort.data.access_token;

    // 2. Intercambiar TOKEN CORTO por TOKEN LARGO (60 días)
    const responseLong = await axios.get('https://graph.facebook.com/v25.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: config.fb.appId,
        client_secret: config.fb.appSecret,
        fb_exchange_token: shortToken
      }
    });

    const longToken = responseLong.data.access_token;

    // 3. Persistencia: Guardar el token de 60 días
    // Aquí puedes vincularlo al cliente específico si pasas un 'state' en la URL
    await db.saveLongLivedToken(longToken);

    sovyxLogger.info("✅ Token de 60 días generado exitosamente.");

    res.send(`
      <div style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h1 style="color: #8A2BE2;">SOVYX OS ACTIVADO</h1>
        <p>La vinculación de Instagram ha sido exitosa. Ya puedes cerrar esta ventana.</p>
      </div>
    `);

  } catch (error) {
    sovyxLogger.error("Falla en el flujo de tokens", error.response?.data || error.message);
    res.status(500).send("Error crítico al generar el acceso de 60 días.");
  }
});

module.exports = router;
