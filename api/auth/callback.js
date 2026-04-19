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
    return res.status(400).send("Error: Código ausente.");
  }

  try {
    sovyxLogger.info("Generando Token de 60 días...");

    // 1. Intercambiar CODE por TOKEN CORTO
    const responseShort = await axios.get('https://graph.facebook.com/v25.0/oauth/access_token', {
      params: {
        client_id: config.facebook.appId,
        client_secret: config.facebook.appSecret,
        redirect_uri: config.sovyx.redirectUri, // Usamos la del config
        code: code
      }
    });

    const shortToken = responseShort.data.access_token;

    // 2. Intercambiar por TOKEN LARGO (60 días)
    const responseLong = await axios.get('https://graph.facebook.com/v25.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: config.facebook.appId,
        client_secret: config.facebook.appSecret,
        fb_exchange_token: shortToken
      }
    });

    const longToken = responseLong.data.access_token;

    // 3. Persistencia (Opcional)
    await db.saveLongLivedToken(longToken);

    // 4. RESPUESTA VISUAL (Diseño SOVYX)
    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>SOVYX Auth Success</title>
          <style>
              body { background-color: #0d0d0d; color: white; font-family: 'Segoe UI', sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; overflow: hidden; }
              .card { background: #1a1a1a; padding: 40px; border-radius: 20px; border: 1px solid #8A2BE2; text-align: center; max-width: 90%; box-shadow: 0 10px 30px rgba(138, 43, 226, 0.2); }
              h1 { color: #f0f0f0; margin-bottom: 10px; font-weight: 300; letter-spacing: 2px; }
              p { color: #b0b0b0; font-size: 14px; margin-bottom: 25px; }
              .token-container { background: #000; padding: 15px; border-radius: 10px; border: 1px dashed #FF00FF; word-break: break-all; font-family: monospace; font-size: 12px; margin-bottom: 20px; color: #FF00FF; }
              .btn-copy { background: #8A2BE2; color: white; border: none; padding: 12px 25px; border-radius: 50px; cursor: pointer; font-weight: bold; transition: 0.3s; width: 100%; text-transform: uppercase; }
              .btn-copy:active { transform: scale(0.95); background: #FF00FF; }
              .footer { margin-top: 20px; font-size: 10px; color: #444; text-transform: uppercase; letter-spacing: 1px; }
          </style>
      </head>
      <body>
          <div class="card">
              <h1>SOVYX OS</h1>
              <p>Infraestructura vinculada con éxito. <br> Copia el token y envíalo al administrador.</p>
              
              <div class="token-container" id="tokenText">${longToken}</div>
              
              <button class="btn-copy" onclick="copyToken()">Copiar Token</button>
              
              <div class="footer">Protocolo Rojo Nivel 1 • 2026</div>
          </div>

          <script>
              function copyToken() {
                  const token = document.getElementById('tokenText').innerText;
                  navigator.clipboard.writeText(token).then(() => {
                      const btn = document.querySelector('.btn-copy');
                      btn.innerText = '¡COPIADO!';
                      btn.style.background = '#00FF00';
                      setTimeout(() => {
                          btn.innerText = 'Copiar Token';
                          btn.style.background = '#8A2BE2';
                      }, 2000);
                  });
              }
          </script>
      </body>
      </html>
    `);

  } catch (error) {
    sovyxLogger.error("Error en flujo de tokens", error.response?.data || error.message);
    res.status(500).send(`
      <body style="background:#000; color:red; text-align:center; padding:50px;">
        <h2>ERROR CRÍTICO</h2>
        <p>${error.message}</p>
      </body>
    `);
  }
});

module.exports = router;
