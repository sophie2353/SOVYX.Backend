require('dotenv').config(); // <--- Ojo aquí, es punto y coma ';' (o nada), no dos puntos ':'

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
