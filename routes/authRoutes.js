const express = require('express');
const router = express.Router();
const axios = require('axios');
const tokens = require('../config/tokens');

router.get('/facebook/callback', async (req, res) => {
  const { code, state: sessionId } = req.query;

  try {
    // 1. Obtener Token de corta duración
    const tokenRes = await axios.get('https://graph.facebook.com/v25.0/oauth/access_token', {
      params: {
        client_id: tokens.META_APP_ID,
        client_secret: tokens.META_APP_SECRET,
        redirect_uri: `${tokens.BACKEND_URL}/api/auth/facebook/callback`,
        code
      }
    });

    // 2. Intercambiar por Long-Lived Token (60 días)
    const longTokenRes = await axios.get('https://graph.facebook.com/v25.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: tokens.META_APP_ID,
        client_secret: tokens.META_APP_SECRET,
        fb_exchange_token: tokenRes.data.access_token
      }
    });

    if (sessionsDB[sessionId]) {
      sessionsDB[sessionId].fbAccessToken = longTokenRes.data.access_token;
    }

    res.redirect(`${tokens.FRONTEND_URL}?auth=success&sessionId=${sessionId}`);
  } catch (err) {
    console.error('Error OAuth Meta:', err.response?.data || err.message);
    res.status(500).send('Error autenticando con Facebook');
  }
});

module.exports = router;
