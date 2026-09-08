require('dotenv').config();

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://sodie.app';
const REDIRECT_URI = process.env.REDIRECT_URI || `${FRONTEND_URL}/confirmacion.html`;

module.exports = {
  port: process.env.PORT || 10000,
  mongoUri: process.env.MONGO_URI,

  // Credenciales & URLs Globales
  SOVYX_ADMIN_KEY: process.env.SOVYX_ADMIN_KEY || 'admin23555',
  BACKEND_URL: process.env.BACKEND_URL || 'https://api.sodie.app',
  FRONTEND_URL,
  REDIRECT_URI, // <--- Una sola variable global para todas las pasarelas

  // Mapeo Directo de Pasarelas por Hora/Slot
  payments: {
    // Tramo 1: Reserva ($1,000 USD) via Kontigo
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

  sodie: {
    totalSlots: 2,
    priceInitial: 1000,
    pricePost48h: 9000,
    priceMonthly: 5000
  }
};
