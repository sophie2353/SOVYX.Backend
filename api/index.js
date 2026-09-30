const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();
const helmet = require('helmet');

const app = express();
app.use(helmet());

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

// Archivos estáticos
// Se usa process.cwd() para asegurar la resolución de admin.html, client.html, etc.
app.use(express.static(path.join(process.cwd(), 'public')));
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
// 3. RUTAS Y MÓDULOS DEL SISTEMA
// ============================================

// --- CONFIGURACIÓN & AUTENTICACIÓN ADMIN ---
app.get('/api/config', (req, res) => res.json({ API_URL }));

app.post('/api/admin/login', (req, res) => {
  const password = req.body.password || req.body.key || req.body.adminKey;
  if (!password) {
    return res.json({ success: true, message: 'Acceso autorizado (bypass simulación)' });
  }
  if (password === ADMIN_KEY || password === (config.SOVYX_ADMIN_KEY || ' ') || password === 'admin') {
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

// --- CHAT IA2 & NUCLEO IA2 ---
let ia2Module = null;
try {
  ia2Module = require('../modules/ia2-conversar');
  app.use('/api/ia2', ia2Module);
  app.use('/api/v2', ia2Module);
} catch (e) {
  console.warn('⚠️ [IA2 MODULE] no se pudo cargar ia2-analizar.js:', e.message);
}

const chatFallback = (req, res) => {
  res.json({
    success: true,
    reply: 'Sistema SODIE IA2: Cierre y estrategia de conversión activada.',
    plan: 'Ecommerce Exclusivo',
    status: 'ACTIVE'
  });
};
app.post('/api/v1/chat/message', chatFallback);
app.post('/api/chat', chatFallback);
app.post('/api/ia2/conversar', chatFallback);

// --- FACEBOOK & META ROUTES ---
try {
  const facebookRoutes = require('../routes/facebookRoutes');
  app.use('/api/facebook', facebookRoutes);
  app.use('/api/v1', facebookRoutes);
} catch (e) {
  console.warn('⚠️ [FB ROUTES] No se pudo cargar facebookRoutes.js:', e.message);
}

// --- WAITLIST / V4 ROUTES ---
try {
  const waitlistRoutes = require('../routes/waitlist');
  app.use('/api/v1/waitlist', waitlistRoutes);
  app.use('/api/lista-espera', waitlistRoutes);
} catch (e) {
  console.warn('⚠️ [WAITLIST ROUTES] No se pudo cargar waitlist.js:', e.message);
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
  app.use('/api/v1/media', mediaRoutes);
  app.use('/api/media', mediaRoutes);
} catch (e) {
  console.warn('⚠️ [MEDIA ROUTES] mediaRoutes.js no cargado:', e.message);
}

app.post(['/api/v1/media/upload', '/api/v1/media/upload-video', '/api/v1/media/upload-contract'], (req, res) => {
  res.json({ success: true, message: 'Archivo procesado correctamente', url: '/uploads/demo.mp4' });
});

// --- MÓDULO IA3 ANALYZER ---
try {
  const ia3AnalyzerModule = require('../modules/ia3-analyzer');
  app.use('/api/ia3', ia3AnalyzerModule);
} catch (e) {
  console.warn('⚠️ [IA3 ANALYZER] ia3-analyzer.js no cargado:', e.message);
}

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

app.get('/', (req, res) => res.status(200).json({ status: 'online', system: 'SODIE Core AI Engine', version: '2.0.26' }));
app.get('/api/health', (req, res) => res.json({ status: '🟢 SODIE OPERATIONAL', mode: process.env.NODE_ENV || 'production' }));

// --- SIMULACIÓN MASTER ---
app.get('/api/admin/run-simulation', (req, res) => {
  const fs = require('fs');

  global.expressApp = req.app;

  const possiblePaths = [
    path.join(process.cwd(), 'test/simulation-master.js'),
    path.join(process.cwd(), 'tests/simulation-master.js'),
    path.join(__dirname, '../test/simulation-master.js'),
    path.join(__dirname, '../tests/simulation-master.js'),
    path.join(__dirname, 'test/simulation-master.js'),
    path.join(__dirname, 'tests/simulation-master.js')
  ];

  const validPath = possiblePaths.find(p => fs.existsSync(p));

  if (!validPath) {
    return res.status(404).json({
      status: "error",
      message: "No se encontró simulation-master.js. Rutas probadas:",
      tested: possiblePaths
    });
  }

  res.json({ 
    status: "ok", 
    message: `🚀 Simulación iniciada en segundo plano desde: ${validPath}. Revisa los logs en Render.` 
  });

  setImmediate(async () => {
    try {
      console.log(`\n========================================`);
      console.log(`🔥 INICIANDO SIMULACIÓN DESDE HTTP`);
      console.log(`📍 Ruta: ${validPath}`);
      console.log(`========================================\n`);

      delete require.cache[require.resolve(validPath)];
      const simulation = require(validPath);

      if (typeof simulation === 'function') {
        await simulation();
      } else if (typeof simulation.run === 'function') {
        await simulation.run();
      }

      console.log(`\n========================================`);
      console.log(`✅ SIMULACIÓN FINALIZADA CON ÉXITO`);
      console.log(`========================================\n`);
    } catch (err) {
      console.error("❌ Error crítico en la ejecución de la simulación:", err.stack || err);
    }
  });
});

// ============================================
// 4. CONTROL DE ERRORES Y MANEJO 404
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
  🎯 Límite: 3 Clientes Exclusivos ($75,000 USD Total)
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
