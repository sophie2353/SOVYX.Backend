require('dotenv').config();

module.exports = {
  port: process.env.PORT || 10000,
  mongoUri: process.env.MONGO_URI,

  // Credenciales & URLs Globales de SOVYX
  SOVYX_ADMIN_KEY: process.env.SOVYX_ADMIN_KEY,
  BACKEND_URL: process.env.BACKEND_URL,
  FRONTEND_URL: process.env.FRONTEND_URL

  // Integración Meta Ads API
  meta: {
    accessToken: process.env.META_ADS_ACCESS_TOKEN,
    accountId: process.env.META_ADS_ACCOUNT_ID,
    pixelId: process.env.META_PIXEL_ID,
    pageId: process.env.META_PAGE_ID,
    campaignId: process.env.META_CAMPAIGN_ID || null,
    appId: process.env.META_APP_ID
  },

  // Integración Kontigo Webhook / Pasarela
  kontigo: {
    slug: process.env.KONTIGO_SLUG || 'SOVYX-Slot'
  },

  // Seguridad & Tokens
  security: {
    adminHqSecret: process.env.ADMIN_HQ_SECRET || 'sovyx_hq_key'
  },

  // Parámetros de Escasez y Precios
  sovyx: {
    totalSlots: 4,
    priceInitial: 1000,
    priceFinal: 4000
  }
};
