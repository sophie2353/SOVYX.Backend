require('dotenv').config();

// 1. Obtener base URL asegurando fallback razonable
const API_URL = (process.env.API_URL || process.env.BACKEND_URL || '').replace(/\/$/, '');

// 2. Construir REDIRECT_URI dinámicamente o con fallback absoluto si hay API_URL
const REDIRECT_URI = process.env.REDIRECT_URI || (API_URL ? `${API_URL}/confirmacion.html` : '/confirmacion.html');

// 3. Validaciones básicas para evitar crashes silenciosos en el servidor
const mongoUri = process.env.MONGO_URI || '';
if (!mongoUri) {
  console.warn('⚠️ ADVERTENCIA [tokens.js]: MONGO_URI no está configurado en las variables de entorno.');
}

module.exports = {
  port: parseInt(process.env.PORT, 10) || 10000,
  mongoUri,

  // Credenciales & URLs Globales
  ADMIN_KEY: process.env.ADMIN_KEY || '',
  BACKEND_URL: process.env.BACKEND_URL || API_URL,
  API_URL,
  REDIRECT_URI,

  meta: {
    appId: process.env.META_APP_ID || process.env.APP_ID || '',
    accountId: process.env.META_AD_ACCOUNT_ID || process.env.AD_ACCOUNT_ID || '',
    accessToken: process.env.META_ACCESS_TOKEN || process.env.META_ACCES_TOKEN || '',
    pixelId: process.env.META_PIXEL_ID || ''
  },
};
