require('dotenv').config();

module.exports = {
  instagram: {
    tokens: {
      sovyx: process.env.INSTAGRAM_TOKEN_SOVYX,
      socredi: process.env.INSTAGRAM_TOKEN_SOCREDI,
      client1: process.env.INSTAGRAM_TOKEN_CLIENT1,
      client2: process.env.INSTAGRAM_TOKEN_CLIENT2,
      client3: process.env.INSTAGRAM_TOKEN_CLIENT3,
      client4: process.env.INSTAGRAM_TOKEN_CLIENT4,
      // Aunque escales a 4, dejamos los envs por si acaso, pero el Index limitará el acceso
    },
    ids: {
      sovyx: process.env.INSTAGRAM_ID_SOVYX,
      socredi: process.env.INSTAGRAM_ID_SOCREDI,
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
    model: 'gemini-1.5-flash' // El más rápido para onboarding y análisis de texto/img
  },

  
  sovyx: {
    mode: process.env.SOVYX_MODE || 'development',
    // IMPORTANTE: Configurar SOVYX_MAX_CLIENTS=4 en tus variables de entorno de Render
    maxClients: parseInt(process.env.SOVYX_MAX_CLIENTS) || 4, 
    targetCloses: parseInt(process.env.SOVYX_TARGET_CLOSES) || 2700
  }
};
