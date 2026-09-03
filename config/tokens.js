require('dotenv').config();

module.exports = {
  port: process.env.PORT || 10000,
  mongoUri: process.env.MONGO_URI,

  // Credenciales & URLs Globales de SOVYX / SODIE
  SOVYX_ADMIN_KEY: process.env.SOVYX_ADMIN_KEY || 'admin23555',
  BACKEND_URL: process.env.BACKEND_URL || 'https://api.sodie.app',
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
    slug: process.env.KONTIGO_SLUG || 'SOVYX-Slot',
    baseUrl: process.env.KONTIGO_BASE_URL || 'https://app.kontigo.latin/pay'
  },

  // Seguridad & Tokens
  security: {
    adminHqSecret: process.env.ADMIN_HQ_SECRET || 'sovyx_hq_key'
  },

  // Parámetros de Escasez y Precios (3 Tramos / Exclusividad de 2 Slots)
  sodie: {
    totalSlots: 2,
    priceInitial: 1000,   // Tramo 1: Reserva / Slot inicial
    pricePost48h: 9000,   // Tramo 2: Cierre a las 48 Horas
    priceMonthly: 5000    // Tramo 3: Mantenimiento mensual (30 días)
  }
};
