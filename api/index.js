const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const config = require('../config/tokens');
const sovyxLogger = require('../modules/sovyxLogger');

// Importar e inicializar el Cronjob automatizado (Ciclo 24h/48h Meta)
// En lugar de ./jobs/cron24h
require('../jobs/cron24h');


const app = express();

// Helper para limpiar cuentas si no está importado externamente
const limpiarCuenta = (cuenta) => cuenta || null;

// ============================================
// 1. MIDDLEWARES PRINCIPALES
// ============================================
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS']
}));

app.use(express.json());

// Logger de tráfico SOVYX (Monitoreo en tiempo real)
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
    .then(() => {
      console.log('🟢 [SOVYX DB] Base de datos conectada correctamente.');
    })
    .catch((err) => {
      if (sovyxLogger && sovyxLogger.error) {
        sovyxLogger.error('Error al conectar MongoDB', { error: err.message });
      }
      console.error('🔴 [SOVYX DB] Error de conexión:', err.message);
    });
} else {
  console.warn('⚠️ [SOVYX DB] MONGO_URI no encontrada en .env / config.');
}

// ============================================
// 3. RUTAS API & NÚCLEO
// ============================================

// Chat & Slots (Nueva Infraestructura)
const chatRoutes = require('./chat/chat');
const slotsRoutes = require('../slots/slots');
app.use('/api/chat', chatRoutes);
app.use('/slots', slotsRoutes);

// Pasarela de Pagos & Webhook
app.use('/api/pagos', require('./routes/pagos'));
app.use('/api/webhooks', require('./routes/kontigoWebhook'));

// Healthchecks
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    system: 'SOVYX Core AI Engine',
    version: '2.0.26'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: '🟢 SOVYX OPERATIONAL',
    mode: config.sovyx?.mode || 'production',
    db_status: mongoose.connection.readyState === 1 ? 'CONNECTED' : 'DISCONNECTED',
    timestamp: new Date().toISOString(),
    version: '2.0.26',
    slots_update: '4 MAX',
  });
});

// Módulos IA
app.use('/api/ia1', require('./ia/ia1-segmentar')); 
app.use('/api/ia2', require('./ia/ia2-conversar')); 
app.use('/api/ia3', require('./ia/ia3-analizar')); 

// Escasez y Clientes (Máximo 4)
app.get('/api/clientes/disponibles', async (req, res) => {
  try {
    const db = require('../modules/sovyxDatabase');
    const slotsOcupados = await db.countClientes();
    const maxSovyxSlots = 4;
    const slotsDisponibles = maxSovyxSlots - slotsOcupados;
    
    res.json({
      totalSlots: maxSovyxSlots,
      ocupados: slotsOcupados,
      disponibles: slotsDisponibles > 0 ? slotsDisponibles : 0,
      mensaje: slotsDisponibles <= 0 ? "SOLD OUT" : "Slots disponibles",
      precio: { ticket: 1000, moneda: 'USD' }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error en base de datos' });
  }
});

// Dashboard & Cuentas
app.get('/api/accounts', (req, res) => {
  try {
    const ACCOUNTS = require('../config/accounts');
    const mis_cuentas = [
      limpiarCuenta(ACCOUNTS.sovyx),
      limpiarCuenta(ACCOUNTS.socredi),
      limpiarCuenta(ACCOUNTS.soeditia),
      limpiarCuenta(ACCOUNTS.soalefia)
    ].filter(Boolean);

    const clientes = [];
    for (let i = 1; i <= 4; i++) {
      const cliente = limpiarCuenta(ACCOUNTS[`client${i}`]);
      if (cliente) clientes.push(cliente);
    }

    res.json({
      mis_cuentas,
      clientes,
      total_operando: mis_cuentas.length + clientes.length
    });
  } catch (error) {
    if (sovyxLogger && sovyxLogger.error) {
      sovyxLogger.error('Error procesando cuentas', { error: error.message });
    }
    res.status(500).json({ error: 'Error al cargar configuración de cuentas' });
  }
});

// ============================================
// 4. MANEJO DE ERRORES & 404
// ============================================
app.use((req, res) => {
  res.status(404).json({ error: `Ruta ${req.url} no encontrada en SOVYX OS` });
});

app.use((err, req, res, next) => {
  if (sovyxLogger && sovyxLogger.error) {
    sovyxLogger.error('CRITICAL_SYSTEM_ERROR', { error: err.message });
  }
  res.status(500).json({ error: 'Falla interna en el motor de SOVYX. Reiniciando secuencia...' });
});

// ============================================
// 5. ACTIVACIÓN ÚNICA DEL SERVIDOR
// ============================================
const PORT = process.env.PORT || config.port || 10000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🚀 SOVYX OS v2.0.26 - SISTEMA ACTIVADO
  📡 Puerto: ${PORT}
  🎯 Objetivo: 4 Usuarios Segmentados (High Retention)
  💼 Slots: 4 Clientes (Escasez Activada)
  💬 Ruta Chat: /api/chat
  📊 Ruta Slots: /slots
  💳 Ruta Pagos: /api/pagos
  ⏰ Cronjob Meta 24h/48h: ACTIVADO
  🟢 Base de Datos: ${process.env.MONGO_URI ? 'Configurada' : 'Pendiente URI'}
  `);
});

module.exports = app;
