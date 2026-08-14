require('dotenv').config()

module.exports = {
  port: process.env.PORT || 10000,
  
  meta: {
    accessToken: process.env.META_ADS_ACCESS_TOKEN,
    accountId: process.env.META_ADS_ACCOUNT_ID,
    campaignId: process.env.META_CAMPAIGN_ID
  },

  security: {
    paymentWebhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || 'sovyx_secret_123',
    adminHqSecret: process.env.ADMIN_HQ_SECRET || 'sovyx_hq_key'
  },

  sovyx: {
    totalSlots: 4,
    priceInitial: 1000,
    priceFinal: 4000
  }
};
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
