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

  sodie: {
    totalSlots: 3,
    priceInitial: 7000,
    priceweek: 6000,
    priceMonthly: 5000
  }
};
