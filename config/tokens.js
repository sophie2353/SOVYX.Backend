require('dotenv').config();

module.exports = {
  instagram: {
    tokens: {
      sovyx: process.env.INSTAGRAM_TOKEN_SOVYX,
      socredi: process.env.INSTAGRAM_TOKEN_SOCREDI,
      soeditia: process.env.INSTAGRAM_TOKEN_SOEDITIA, // Añadido para el flujo de 2-3 días
      client1: process.env.INSTAGRAM_TOKEN_CLIENT1,
      client2: process.env.INSTAGRAM_TOKEN_CLIENT2,
      client3: process.env.INSTAGRAM_TOKEN_CLIENT3,
      client4: process.env.INSTAGRAM_TOKEN_CLIENT4,
    },
    ids: {
      sovyx: process.env.INSTAGRAM_ID_SOVYX,
      socredi: process.env.INSTAGRAM_ID_SOCREDI,
      soeditia: process.env.INSTAGRAM_ID_SOEDITIA,
      client1: process.env.INSTAGRAM_ID_CLIENT1,
      client2: process.env.INSTAGRAM_ID_CLIENT2,
      client3: process.env.INSTAGRAM_ID_CLIENT3,
      client4: process.env.INSTAGRAM_ID_CLIENT4,
    },
    verifyToken: process.env.INSTAGRAM_VERIFY_TOKEN || 'SOVYX_VERIFY_2026',
    apiVersion: 'v25.0',
    baseUrl: 'https://graph.instagram.com/v25.0'
  },
  
  facebook: {
    token: process.env.FB_ACCESS_TOKEN,
    adAccountId: process.env.FB_AD_ACCOUNT_ID,
    appId: process.env.FB_APP_ID,
    appSecret: process.env.FB_APP_SECRET,
    apiVersion: 'v25.0',
    baseUrl: 'https://graph.facebook.com/v25.0'
  },

  // MOTOR DE INTELIGENCIA VISUAL Y ESTRATEGIA
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-1.5-flash' 
  },

  // PASARELAS DE PAGO Y VINCULACIÓN (NUEVO)
  payments: {
    kontigo: process.env.KONTIGO_LINK, // Punto 7 de tu lista
    binance: {
      apiKey: process.env.BINANCE_API_KEY,
      secretKey: process.env.BINANCE_SECRET_KEY
    }
  },

  // CONFIGURACIÓN ESTRATÉGICA SOVYX
  sovyx: {
    mode: process.env.SOVYX_MODE || 'development',
    maxClients: parseInt(process.env.SOVYX_MAX_CLIENTS) || 4, 
    targetCloses: parseInt(process.env.SOVYX_TARGET_CLOSES) || 2700,
    redirectUri: process.env.REDIRECT_URI || 'https://sovyx.onrender.com/api/auth/ig/callback'
  }
};
