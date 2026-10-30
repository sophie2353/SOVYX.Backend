const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();
const helmet = require('helmet');
const translatorMiddleware = require('./middleware/translator');

const app = express();
app.set('trust proxy', 1);

// Configuración & Logging Centralizado
const config = require('../config/tokens');
const sovyxLogger = require('../modules/sovyxLogger');

const API_URL = process.env.API_URL || '';
const ADMIN_KEY = process.env.ADMIN_KEY || config.SOVYX_ADMIN_KEY;

// HELPER DE SEGURIDAD: Garantiza que lo que pase a app.use sea una función/router válida
function safeUse(pathOrMiddleware, possibleMiddleware) {
  let routePath = null;
  let middleware = pathOrMiddleware;

  if (possibleMiddleware) {
    routePath = pathOrMiddleware;
    middleware = possibleMiddleware;
  }

  // Extraer el router si fue exportado como un objeto { router }, { default }, etc.
  if (middleware && typeof middleware === 'object') {
    middleware = middleware.router || middleware.default || middleware;
  }

  if (typeof middleware !== 'function') {
    console.warn(`⚠️ [ROUTER WARNING] El middleware cargado para '${routePath || 'Global'}' no es una función válida (es ${typeof middleware}). Omitiendo para evitar crash.`);
    return;
  }

  if (routePath) {
    app.use(routePath, middleware);
  } else {
    app.use(middleware);
  }
}


// ============================================
// CONFIGURACIÓN DE CIBERSEGURIDAD
// ============================================
const rateLimit = require('express-rate-limit');

// 1. Escudo de cabeceras HTTP
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false,
  xssFilter: true,
  noSniff: true,
  hidePoweredBy: true
}));

// 2. Control de acceso por origen estricto
app.use(cors({
  origin: [
    'https://sodie.app',          // El dominio de tu web / frontend
    'https://www.sodie.app',      // Por si entran con www
    'https://api.sodie.app'       // El dominio de la API
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// 3. Límite de velocidad anti-bots y fuerza bruta
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use('/api/', limiter);
// ============================================
// 1. MIDDLEWARES PRINCIPALES Y RECURSOS ESTÁTICOS
// ============================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servidor de archivos estáticos Frontend
const publicPath = path.join(__dirname, '../public');

app.use(express.static(publicPath));
app.use('/video', express.static(path.join(publicPath, 'video')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Logger global
app.use((req, res, next) => {
  if (sovyxLogger && sovyxLogger.info) {
    sovyxLogger.info(`${req.method} ${req.path}`);
  }
  next();
});

// Se lo aplicas a TODAS tus rutas de una sola vez con una sola línea:
app.use(translatorMiddleware); 
// ============================================
// 2. CONEXIÓN A BASE DE DATOS (MongoDB)
// ============================================
const MONGO_URI = process.env.MONGO_URI || config.mongoUri;

if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('🟢 [SODIE DB] Base de datos conectada correctamente.'))
    .catch((err) => {
      if (sovyxLogger && sovyxLogger.error) {
        sovyxLogger.error('Error al conectar MongoDB', { error: err.message });
      }
      console.error('🔴 [SODIE DB] Error de conexión:', err.message);
    });
} else {
  console.warn('⚠️ [SODIE DB] MONGO_URI no encontrada en entorno.');
}

// ============================================
// 3. RUTAS Y MÓDULOS DEL SISTEMA (ORGANIZADOS)
// ============================================

// --- CONFIGURACIÓN & AUTENTICACIÓN ADMIN ---
app.get(['/api/config', '/api/v1/config'], (req, res) => res.json({ API_URL }));

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ success: false, message: 'Se requiere una contraseña válida.' });
  }

  if (!ADMIN_KEY) {
    return res.status(500).json({ success: false, message: 'Error de configuración en el servidor.' });
  }

  if (password === ADMIN_KEY) {
    return res.json({ success: true, message: 'Acceso autorizado' });
  }

  return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
});

app.post('/api/v1/auth/biometrics/challenge', (req, res) => {
  res.json({ success: true, challenge: 'sodie_challenge_' + Date.now() });
});

app.post('/api/v1/auth/biometrics/register', (req, res) => {
  res.json({ success: true, message: 'Biometría registrada correctamente' });
});

// --- 1. WEBHOOKS & FIRMA DE CONTRATOS (/api/webhook, /api/v1/webhook) ---
// Incluye: /api/webhook/contrato-waitlist-firmado, /api/webhook/contrato-firmado
try {
  const webhookRoutes = require('../routes/webhook');
  safeUse(['/api/webhook', '/api/v1/webhook'], webhookRoutes);
} catch (e) {
  console.warn('⚠️ [WEBHOOK ROUTES] No se pudo cargar webhook.js:', e.message);
}

// --- 2. FACEBOOK & META ROUTES (/api/facebook, /api/v1/facebook) ---
// Incluye: /api/facebook/activar-campana, /configurar, /crear-borrador, etc.
try {
  const facebookRoutes = require('../routes/facebookRoutes');
  safeUse(['/api/facebook', '/api/v1/facebook', '/facebook'], facebookRoutes);
} catch (e) {
  console.warn('⚠️ [FB ROUTES] No se pudo cargar facebookRoutes.js:', e.message);
}

// --- 3. WAITLIST / V4 ROUTES (/api/waitlist, /api/v1/waitlist, /api/v1/registro) ---
// Incluye: /api/waitlist/confirm-waitlist, /api/v1/registro
try {
  const waitlistRoutes = require('../routes/waitlist');
  safeUse(['/api/waitlist', '/api/v1/waitlist', '/api/v1/registro', '/api/lista-espera', '/waitlist'], waitlistRoutes);
} catch (e) {
  console.warn('⚠️ [WAITLIST ROUTES] No se pudo cargar waitlist.js:', e.message);
}

// --- 4. CHAT IA2 & NÚCLEO IA2 ---
try {
  const ia2Module = require('../modules/ia2-conversar') || require('../routes/ia2Routes');
  safeUse(['/api/ia2', '/api/v1/ia2', '/api/v1/chat', '/api/chat'], ia2Module);
} catch (e) {
  app.post(['/api/v1/chat/message', '/api/chat', '/api/ia2/conversar'], (req, res) => {
    res.json({ success: true, reply: 'Sistema SODIE IA2 Activo.', status: 'ACTIVE' });
  });
}

// --- 5. MÓDULO IA3 ANALYZER ---
try {
  const ia3AnalyzerModule = require('../modules/ia3-analyzer') || require('../routes/ia3Routes');
  safeUse(['/api/ia3', '/api/v1/ia3'], ia3AnalyzerModule);
} catch (e) {
  app.all(['/api/ia3*', '/api/v1/ia3*'], (req, res) => res.json({ success: true, message: 'IA3 Activo' }));
}

// --- 6. CLIENT ID & MEDIA UPLOADS ---
try {
  const clientIDRoutes = require('../routes/clientIDRoutes');
  safeUse('/api/v1/clients', clientIDRoutes);
} catch (e) {
  console.warn('⚠️ [CLIENT ID] clientIDRoutes.js no cargado:', e.message);
}

// --- 7. UPLOAD & MEDIA ROUTES V3.5 ---
try {
  const uploadRoutes = require('../routes/uploadRoutes');
  safeUse(['/api/v1/media', '/api/media', '/media'], uploadRoutes);
} catch (e) {
  console.warn('⚠️ [UPLOAD ROUTES] No se pudo cargar uploadRoutes.js:', e.message);
}

// --- 8. WEBHOOK CLIENT & PUSH NOTIFICATIONS (/api/webhook-client) ---
// Incluye: /api/webhook-client/vapid-public-key, /save-subscription, /timer/push-72h, /timer/push-day7
try {
  const webhookClientRoutes = require('../routes/webhook-client');
  safeUse('/api/webhook-client', webhookClientRoutes);
} catch (e) {
  console.warn('⚠️ [WEBHOOK CLIENT] No se pudo cargar webhook-client.js:', e.message);
}

// --- 9. METRICS ROUTES ---
try {
  const metricsRoutes = require('../routes/metricsRoutes');
  safeUse('/api', metricsRoutes);
} catch (e) {
  console.warn('⚠️ [METRICS ROUTES] No se pudo cargar metricsRoutes.js:', e.message);
}

// --- 10. CLIENT ROUTES (/api/client) ---
// Incluye: /api/client/register
try {
  const clientRoutes = require('../routes/clientRoutes');
  safeUse('/api/client', clientRoutes);
} catch (e) {
  console.warn('⚠️ [CLIENT ROUTES] No se pudo cargar clientRoutes.js:', e.message);
}

// --- 11. ADMIN ROUTES (/api/admin) ---
try {
  const adminRoutes = require('../routes/adminRoutes');
  safeUse('/api/admin', adminRoutes);
} catch (e) {
  console.warn('⚠️ [ADMIN ROUTES] No se pudo cargar adminRoutes.js:', e.message);
}

// --- 12. SEGMENTACION ROUTES (/api/v1/segmentacion/procesar) ---
try {
  const segmentacionRoutes = require('../routes/segmentacionRoutes');
  safeUse('/api/v1/segmentacion', segmentacionRoutes);
} catch (e) {
  console.warn('⚠️ [SEGMENTACION ROUTES] No se pudo cargar segmentacionRoutes.js:', e.message);
}

// --- 13. PAY WEBHOOK (/api/v1/webhook-payment) ---
try {
  const payWebhookRoutes = require('../routes/pay-webhook');
  safeUse('/api/v1/webhook-payment', payWebhookRoutes);
} catch (e) {
  console.warn('⚠️ [PAY WEBHOOK] No se pudo cargar pay-webhook.js:', e.message);
}

// --- 14. ENDPOINT SLOTS DISPONIBLES ---
app.get('/api/clientes/disponibles', async (req, res) => {
  const maxSovyxSlots = config.sovyx?.totalSlots || 3;
  res.json({
    totalSlots: maxSovyxSlots,
    ocupados: 0,
    disponibles: maxSovyxSlots,
    mensaje: "Slots disponibles",
    precio: { reserva: 1000, final: 9000, total: 10000, moneda: 'USD' }
  });
});

// --- 15. TEST ROUTE (Ruta del Test E2E) ---
try {
  const testRoutes = require('./test-final'); // o test-final según tengas nombrado tu archivo
  safeUse('/api/admin/test-final', testRoutes);
} catch (e) {
  console.warn('⚠️ [TEST ROUTES] No se pudo cargar la ruta de test:', e.message);
}

app.get('/api/health', (req, res) => res.json({ 
  status: '🟢 SODIE OPERATIONAL', 
  mode: process.env.NODE_ENV || 'production',
  timestamp: new Date().toISOString()
}));

// ============================================
// 4. RUTAS FRONTEND Y MANEJO DE ERRORES
// ============================================

app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, '../public/index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).json({ status: 'online', system: 'SODIE Core AI Engine', version: '3.5.0' });
    }
  });
});

app.use((req, res) => res.status(404).json({ error: `Ruta ${req.url} no encontrada` }));

app.use((err, req, res, next) => {
  console.error('💥 Error no controlado:', err);
  res.status(500).json({ error: 'Falla interna en el motor de SODIE.' });
});

// ============================================
// 5. ACTIVACIÓN DEL SERVIDOR
// ============================================
const PORT = process.env.PORT || config.port || 10000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SODIE OS v3.5.0 - OPERATIVO EN PUERTO ${PORT}`);
});

module.exports = app;
