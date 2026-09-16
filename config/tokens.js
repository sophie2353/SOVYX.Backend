require('dotenv').config();

const API_URL = process.env.API_URL || '';
const REDIRECT_URI = process.env.REDIRECT_URI || `${API_URL}/confirmacion.html`;

module.exports = {
  port: process.env.PORT || 10000,
  mongoUri: process.env.MONGO_URI,

  // Credenciales & URLs Globales
  ADMIN_KEY: process.env.ADMIN_KEY || '',
  BACKEND_URL: process.env.BACKEND_URL || '',
  API_URL,
  REDIRECT_URI, // <--- Una sola variable global para todas las pasarelas

  meta: {
    appId: process.env.META_APP_ID || process.env.APP_ID || '',
    accountId: process.env.META_AD_ACCOUNT_ID || process.env.AD_ACCOUNT_ID || '',
    accessToken: process.env.META_ACCESS_TOKEN || process.env.META_ACCES_TOKEN || '',
    pixelId: process.env.META_PIXEL_ID || ''
  }, // ✅ CORREGIDO: Se agregó la llave de cierre '}' y la coma


  // Configuración Centralizada de Enlaces de Pago
  PAYMENTS: {
    // 1. BLOQUES HELIO PAY (HORA 0, 48 Y 72)
    HELIO_2500: "https://helio.pay/2500",
    HELIO_500: "https://helio.pay/500",
    HELIO_3000: "https://helio.pay/3000", // Para $3.000 ($2.500 + $500)
    HELIO_5000: "https://helio.pay/5000", // Para $5.000 ($2.500 x 2)

    // 2. ENLACES KONTIGO (HORA 24 Y COMPLEMENTARIOS)
    KONTIGO: {
      HORA_24_CUPO_1_2: "https://kontigo.link/hora24-1000", // $1.000 USD
      HORA_24_CUPO_3: "https://kontigo.link/hora24-2000",   // $2.000 USD
      HORA_0_RESERVA: "https://kontigo.link/reserva-hora0",
    }
  }
};

  sodie: {
    totalSlots: 3,
    priceInitial: 3000,
    pricePost96h: 9000 10000,
    priceMonthly: 15000
  }
};
