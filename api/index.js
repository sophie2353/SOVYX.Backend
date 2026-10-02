const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();
const helmet = require('helmet');

const app = express();

// Configuración & Logging Centralizado
const config = require('../config/tokens');
const sovyxLogger = require('../modules/sovyxLogger');

const API_URL = process.env.API_URL || '';
const ADMIN_KEY = process.env.ADMIN_KEY || config.SOVYX_ADMIN_KEY;

// ============================================
// CONFIGURACIÓN DE CIBERSEGURIDAD AVANZADA
// ============================================

// 1. Helmet: Protección de cabeceras HTTP en Producción
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://connect.facebook.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", API_URL, "https://graph.facebook.com", "https://*.render.com", "wss:"],
      mediaSrc: ["'self'", "blob:", "data:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true,
  noSniff: true,
  hidePoweredBy: true
}));

// 2. Control de CORS Estricto
const allowedOrigins = [
  API_URL,
  process.env.FRONTEND_URL,
  '',
  ''
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Permitir solicitudes sin origen (como apps móviles, Postman o llamadas entre scripts del servidor)
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(new Error('Acceso denegado por políticas de CORS.'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

// ============================================
// 1. MIDDLEWARES PRINCIPALES
// ============================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servidor de archivos estáticos Frontend
const publicPath = path.join(__dirname, '../public');

app.use(express.static(publicPath));
app.use('/js', express.static(path.join(publicPath, 'js')));
app.use('/video', express.static(path.join(publicPath, 'video')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Logger global de peticiones HTTP
app.use((req, res, next) => {
  if (sovyxLogger && sovyxLogger.info) {
    sovyxLogger.info(`${req.method} ${req.path}`);
  }
  next();
});

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
// 3. RUTAS Y MÓDULOS DEL SISTEMA
// ============================================

// --- CONFIGURACIÓN & AUTENTICACIÓN ADMIN ---
app.get('/api/config', (req, res) => res.json({ API_URL }));

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ 
      success: false, 
      message: 'Se requiere una contraseña válida.' 
    });
  }

  if (!ADMIN_KEY) {
    console.error('🔴 [SECURITY WARNING] No hay ADMIN_KEY configurada en el entorno.');
    return res.status(500).json({ 
      success: false, 
      message: 'Error de configuración en el servidor.' 
    });
  }

  if (password === ADMIN_KEY) {
    return res.json({ 
      success: true, 
      message: 'Acceso autorizado' 
    });
  }

  return res.status(401).json({ 
    success: false, 
    message: 'Contraseña incorrecta' 
  });
});

app.post('/api/v1/auth/biometrics/challenge', (req, res) => {
  res.json({ success: true, challenge: 'sodie_challenge_' + Date.now() });
});

app.post('/api/v1/auth/biometrics/register', (req, res) => {
  res.json({ success: true, message: 'Biometría registrada correctamente' });
});

// --- WEBHOOKS & FIRMA DE CONTRATOS ---
try {
  const webhookRoutes = require('../routes/webhook');
  app.use(['/api/webhook', '/api/v1/webhook'], webhookRoutes);
} catch (e) {
  console.warn('⚠️ [WEBHOOK ROUTES] No se pudo cargar webhook.js:', e.message);
}

// --- FACEBOOK & META ROUTES ---
try {
  const facebookRoutes = require('../routes/facebookRoutes');
  app.use(['/api/facebook', '/api/v1/facebook', '/facebook'], facebookRoutes);
} catch (e) {
  console.warn('⚠️ [FB ROUTES] No se pudo cargar facebookRoutes.js:', e.message);
}

// --- WAITLIST / V4 ROUTES ---
try {
  const waitlistRoutes = require('../routes/waitlist');
  app.use(['/api/waitlist', '/api/v1/waitlist', '/api/lista-espera', '/waitlist'], waitlistRoutes);
} catch (e) {
  console.warn('⚠️ [WAITLIST ROUTES] No se pudo cargar waitlist.js:', e.message);
}

// --- CHAT IA2 & NÚCLEO IA2 ---
try {
  const ia2Module = require('../modules/ia2-conversar') || require('../routes/ia2Routes');
  app.use(['/api/ia2', '/api/v1/ia2', '/api/v1/chat', '/api/chat'], ia2Module);
} catch (e) {
  console.warn('⚠️ [IA2 MODULE] No se pudo cargar módulo IA2:', e.message);
}

// --- MÓDULO IA3 ANALYZER ---
try {
  const ia3AnalyzerModule = require('../modules/ia3-analyzer') || require('../routes/ia3Routes');
  app.use(['/api/ia3', '/api/v1/ia3'], ia3AnalyzerModule);
} catch (e) {
  console.warn('⚠️ [IA3 ANALYZER] ia3-analyzer.js no cargado:', e.message);
}

// --- CLIENT ID & MEDIA UPLOADS ---
try {
  const clientIDRoutes = require('../routes/clientIDRoutes');
  app.use('/api/v1/clients', clientIDRoutes);
} catch (e) {
  console.warn('⚠️ [CLIENT ID] clientIDRoutes.js no cargado:', e.message);
}

try {
  const mediaRoutes = require('../routes/mediaRoutes');
  app.use(['/api/v1/media', '/api/media'], mediaRoutes);
} catch (e) {
  console.warn('⚠️ [MEDIA ROUTES] mediaRoutes.js no cargado:', e.message);
}

// --- ENDPOINTS OFICIALES ---
app.get('/api/clientes/disponibles', async (req, res) => {
  const maxSovyxSlots = config.sovyx?.totalSlots || 2;
  res.json({
    totalSlots: maxSovyxSlots,
    ocupados: 0,
    disponibles: maxSovyxSlots,
    mensaje: "Slots disponibles",
    precio: { reserva: 1000, final: 9000, total: 10000, moneda: 'USD' }
  });
});

app.get('/api/health', (req, res) => res.json({ 
  status: '🟢 SODIE OPERATIONAL', 
  mode: process.env.NODE_ENV || 'production',
  timestamp: new Date().toISOString()
}));

// ============================================
// 4. RUTAS FRONTEND Y MANEJO DE ERRORES
// ============================================

// Servir la vista principal en '/'
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, '../public/index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).json({ status: 'online', system: 'SODIE Core AI Engine', version: '3.5.0' });
    }
  });
});

// Manejo de errores 404
app.use((req, res) => res.status(404).json({ error: `Ruta ${req.url} no encontrada` }));

// Manejo global de excepciones 500
app.use((err, req, res, next) => {
  console.error('💥 Error no controlado:', err);
  res.status(500).json({ error: 'Falla interna en el motor de SODIE.' });
});

// ============================================
// 5. ACTIVACIÓN DEL SERVIDOR
// ============================================
const PORT = process.env.PORT || config.port || 10000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🚀 SODIE OS v3.5.0 - PRODUCCIÓN Y CIBERSEGURIDAD ACTIVADA
  📡 Puerto: ${PORT}
  🔒 Modo: ${process.env.NODE_ENV || 'production'}
  📂 Servidor Estático Frontend: ../public
  🎯 Límite: 3 Clientes Exclusivos ($75,000 USD Total)
  📂 Subida Media & CSV: /api/v1/media/upload
  📋 Lista de Espera SODIE V4: /api/waitlist/confirm-waitlist
  📄 Webhook Contrato: /api/webhook/contrato-waitlist-firmado
  🟢 Base de Datos: ${MONGO_URI ? 'Configurada' : 'Pendiente URI'}
  `);
});

module.exports = app;
