require('dotenv').config();
  
  facebook: {
    token: process.env.FB_ACCESS_TOKEN,
    adAccountId: process.env.FB_AD_ACCOUNT_ID,
    appId: process.env.FB_APP_ID,
    appSecret: process.env.FB_APP_SECRET,
    apiVersion: 'v25.0',
    baseUrl: 'https://graph.facebook.com/v25.0'
  },

  // PASARELAS DE PAGO (Nivel Rojo 1)
  payments: {
    kontigo: process.env.KONTIGO_LINK, // Para el primer cierre
    }
  },

  sovyx: {
    mode: process.env.SOVYX_MODE || 'development',
    slotsRestantes: parseInt(process.env.SOVYX_SLOTS_RESTANTES) || 4, // Control de escasez real
    maxClients: parseInt(process.env.SOVYX_MAX_CLIENTS) || 4, 
    targetCloses: parseInt(process.env.SOVYX_TARGET_CLOSES) || 2700,

  }
};
