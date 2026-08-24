require('dotenv').config();

module.exports = {
  port: process.env.PORT || 10000,
  mongoUri: process.env.MONGO_URI,

  // Credenciales & URLs Globales de SOVYX
  SOVYX_ADMIN_KEY: process.env.SOVYX_ADMIN_KEY || 'admin1234',
  BACKEND_URL: process.env.BACKEND_URL || 'https://sovyx-backend.onrender.com',
  FRONTEND_URL: process.env.FRONTEND_URL || 'https://sovyx.app',

  // Integración Meta Ads API
  meta: {
    accessToken: process.env.META_ADS_ACCESS_TOKEN,
    accountId: process.env.META_ADS_ACCOUNT_ID,
    pixelId: process.env.META_PIXEL_ID,
    pageId: process.env.META_PAGE_ID,
    campaignId: process.env.META_CAMPAIGN_ID || null,
    appId: process.env.META_APP_ID || null
  },

  // Integración Kontigo Webhook / Pasarela
  kontigo: {
    slug: process.env.KONTIGO_SLUG || 'SOVYX-Slot'
  },

  // Seguridad & Tokens
  security: {
    adminHqSecret: process.env.ADMIN_HQ_SECRET || 'sovyx_hq_key'
  },

  // Parámetros de Escasez y Precios (Pivot 2 Slots / $10,000 USD Total)
  sovyx: {
    totalSlots: 2,
    priceInitial: 1000,
    priceFinal: 9000
  }
};
