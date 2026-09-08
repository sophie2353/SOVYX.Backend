require('dotenv').config();

module.exports = {
  port: process.env.PORT || 10000,
  mongoUri: process.env.MONGO_URI,

  // Credenciales & URLs Globales de SOVYX / SODIE
  SOVYX_ADMIN_KEY: process.env.SOVYX_ADMIN_KEY || 'admin23555',
  BACKEND_URL: process.env.BACKEND_URL || 'https://api.sodie.app',
  FRONTEND_URL: process.env.FRONTEND_URL || 'https://sodie.app',
  REDIRECT_URI: process.env.REDIRECT_URI || `${process.env.FRONTEND_URL || 'https://sodie.app'}/confirmacion.html`,

  // Integración Meta Ads API
  meta: {
    accessToken: process.env.META_ADS_ACCESS_TOKEN,
    accountId: process.env.META_ADS_ACCOUNT_ID,
    pixelId: process.env.META_PIXEL_ID,
    pageId: process.env.META_PAGE_ID,
  },

  // Mapeo Directo de Pasarelas y Enlaces por Hora/Slot (8 Variables)
  payments: {
    // Tramo 1: Reserva / Slot Inicial ($1,000 USD) via Kontigo
    hora24_slot1: process.env.KONTIGO_PAYMENT_HORA_24_1,
    hora24_slot2: process.env.KONTIGO_PAYMENT_HORA_24_2,

    // Tramo 2 y 3: Cierre a las 48h / 72h / 96h via Binance Pay
    hora48_slot1: process.env.BINANCE_PAYMENT_HORA48_1,
    hora48_slot2: process.env.BINANCE_PAYMENT_HORA48_2,
    
    hora72_slot1: process.env.BINANCE_PAYMENT_HORA72_1,
    hora72_slot2: process.env.BINANCE_PAYMENT_HORA72_2,

    hora96_slot1: process.env.BINANCE_PAYMENT_HORA96_1,
    hora96_slot2: process.env.BINANCE_PAYMENT_HORA96_2
  },

  // Parámetros de Escasez y Precios (Exclusividad de 2 Slots)
  sodie: {
    totalSlots: 2,
    priceInitial: 1000,
    pricePost48h: 9000,
    priceMonthly: 5000
  }
};
