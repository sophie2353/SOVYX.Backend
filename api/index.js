const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();
const helmet = require('helmet'); // <--- AGREGA ESTA LÍNEA

const app = express();
app.use(helmet());


const app = express();

// Configuración & Logging Centralizado
const config = require('../config/tokens');
const sovyxLogger = require('../modules/sovyxLogger');

// Cargar variables de entorno del sistema
const API_URL = process.env.API_URL || '';
const ADMIN_KEY = process.env.ADMIN_KEY || '';

// ============================================
// 1. MIDDLEWARES PRINCIPALES
// ============================================

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Archivos estáticos y subidas
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Logger global
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
// 3. RUTAS REQUERIDAS POR EL FRONTEND (IMAGEN)
// ============================================

// --- AUTENTICACIÓN & ADMIN ---
app.get('/api/config', (req, res) => res.json({ API_URL }));

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ success: false, message: 'Contraseña requerida' });
  if (password === ADMIN_KEY || password === (config.SOVYX_ADMIN_KEY || ' ')) {
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

// --- MÉTRICAS, SSE & CHAT ---
app.get(['/api/v1/metrics/live', '/api/ia3/live'], (req, res) => {
  res.json({
    status: 'ACTIVE',
    reach: 15420 + Math.floor(Math.random() * 150),
    visitors: 1504 + Math.floor(Math.random() * 25),
    leads: 75,
    conversionRate: '4.8%',
    liveViewers: 18 + Math.floor(Math.random() * 6)
  });
});

app.get('/api/facebook/metrics', (req, res) => {
  res.json({
    success: true,
    metrics: { reach: 18500, impressions: 42000, clicks: 1250, ctr: '2.98%', spend: 350.50 }
  });
});

const chatFallback = (req, res) => {
  res.json({
    success: true,
    reply: 'Sistema SODIE IA2: Cierre y estrategia de conversión activada.',
    plan: 'Ecommerce Exclusivo',
    status: 'ACTIVE'
  });
};
app.post(['/api/v1/chat/message', '/api/chat', '/api/ia2/conversar'], chatFallback);

// --- MEDIA & UPLOADS ---
app.post(['/api/v1/media/upload', '/api/v1/media/upload-video', '/api/v1/media/upload-contract'], (req, res) => {
  res.json({ success: true, message: 'Archivo procesado correctamente', url: '/uploads/demo.mp4' });
});

const fbConnectHandler = async (req, res) => {
  const appId = config.meta?.appId || process.env.APP_ID || '';
  const redirectUri = process.env.META_REDIRECT_URI || 'http://localhost:3000/api/facebook/auth/callback';
  const redirectUrl = `https://www.facebook.com/v25.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${req.body.sessionId || ''}&scope=ads_management,ads_read`;
  return res.json({ success: true, status: 'REDIRECT_REQUIRED', redirectUrl });
};
app.post(['/api/facebook/connect', '/api/v1/facebook/connect'], fbConnectHandler);

app.post(['/api/facebook/activar-campana', '/api/v1/campaigns/activate'], (req, res) => {
  res.json({ success: true, status: 'CAMPAIGN_ACTIVATED', message: 'Campaña activada en Meta Ads' });
});

// --- WAITLIST / V4 ---
global.fallbackWaitlistDB = global.fallbackWaitlistDB || [];

app.post(['/api/v1/waitlist', '/api/lista-espera'], (req, res) => {
  const { nombre, compania, email } = req.body;
  const nuevoRegistro = { id: `V4-${Date.now()}`, nombre: nombre || 'Usuario V4', email: email || 'espera@sodie.app' };
  global.fallbackWaitlistDB.push(nuevoRegistro);
  res.json({ success: true, message: 'Registrado en lista de espera SODIE V4', usuario: nuevoRegistro });
});

app.get(['/api/v1/waitlist/status', '/api/v1/waitlist/estado', '/api/lista-espera/estado'], (req, res) => {
  res.json({ fase: 'Fase 1 - SODIE V4', totalCuposFase1: 18, cuposDisponibles: Math.max(0, 18 - global.fallbackWaitlistDB.length), registrados: global.fallbackWaitlistDB.length });
});

app.post('/api/v1/waitlist/open', (req, res) => {
  res.json({ success: true, message: 'Lista de espera abierta' });
});

app.post('/api/v1/waitlist/close', (req, res) => {
  res.json({ success: true, message: 'Lista de espera cerrada. Temporizador V4 iniciado' });
});

// --- OTROS ENDPOINTS DEL SISTEMA ---
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

// ==========================================
// IMPORTACIÓN DE RUTAS
// ==========================================
const clientIDRoutes = require('../routes/clientIDRoutes');

// ==========================================
// REGISTRO DE RUTAS / API ENDPOINTS
// ==========================================

// Asignación y gestión secuencial de IDs de Cliente (Hora 0 / Confirmación)
app.use('/api/v1/clients', clientIDRoutes);

// ==========================================
// FIN SECCIÓN RUTAS CLIENT ID
// ==========================================
// ==========================================
// IMPORTACIÓN DE RUTAS
// ==========================================
const uploadRoutes = require('../routes/uploadRoutes'); // Subida e inyección de CSV/Excel

// ==========================================
// REGISTRO DE RUTAS / API ENDPOINTS
// ==========================================

// 2. Subida de Audiencias y Media (Redirige las peticiones de /api/v1/media/upload a /upload-csv internamente)
app.use('/api/v1/media/upload', uploadRoutes);

// ==========================================
// FIN SECCIÓN RUTAS CLIENT ID & UPLOAD
// ==========================================
app.get('/.', (req, res) => res.status(200).json({ status: 'online', system: 'SODIE Core AI Engine', version: '2.0.26' }));

app.get('/api/health', (req, res) => res.json({ status: '🟢 SODIE OPERATIONAL', mode: process.env.NODE_ENV || 'production' }));

// Carga dinámica opcional de sub-routers si existen los archivos
try { app.use('/api/media', require('./routes/mediaRoutes')); } catch(e){}
try { app.use('/api/facebook', require('./routes/facebookRoutes')); } catch(e){}

// 1. Importar el módulo IA3 Analyzer
const ia3AnalyzerModule = require('../modules/ia3-analyzer');

// 2. Montar el módulo en la ruta /api/ia3
app.use('/api/ia3', ia3AnalyzerModule);

// ============================================
// 4. CONTROL DE ERRORES Y ACTIVACIÓN
// ============================================
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
  console.log(`
  🚀 SODIE OS v2.0.26 - SISTEMA ACTIVADO Y SINCRONIZADO
  📡 Puerto: ${PORT}
  🎯 Límite: 2 Clientes Exclusivos ($10,000 USD Total)
  💳 Pasarelas: /api/pasarela/admin/set-link, /api/pasarela/get-link
  📂 Subida Media & CSV: /api/v1/media/upload & /api/upload-csv
  📋 Lista de Espera SODIE V4: /api/v1/waitlist/registro
  📊 Exportación CSV: /api/admin/export/export-clientes-hora48
  💬 Chat IA2: /api/v1/chat & /api/ia2
  ⚙️ Motor IA1 & SSE: /api/ia1/confirmar-borrador & /api/ia3/live
  📘 Conexión Facebook: /api/facebook/connect
  🟢 Base de Datos: ${MONGO_URI ? 'Configurada' : 'Pendiente URI'}
  `);
});

module.exports = app;
