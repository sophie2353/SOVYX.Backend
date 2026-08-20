const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

// Configuración & Logging Centralizado
const config = require('../config/tokens');
const sovyxLogger = require('../modules/sovyxLogger');

// Tarea Programada: Ciclo automatizado Meta Ads 24h/48h
require('../jobs/cron24h');

const app = express();

const limpiarCuenta = (cuenta) => cuenta || null;

// ============================================
// 1. MIDDLEWARES PRINCIPALES
// ============================================
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json());

// Logger global de tráfico SOVYX
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
  console.warn('⚠️ [SOVYX DB] MONGO_URI no encontrada en entorno.');
}

// ============================================
// 3. RUTAS Y MÓDULOS DE API (NUEVOS & LEGACY)
// ============================================

// A. Configuración Pública Frontend (Render ENV variables)
try {
  app.use('/api', require('../routes/configRoutes'));
} catch (e) {
  app.get('/api/config', (req, res) => {
    res.json({
      SOVYX_ADMIN_KEY: config.SOVYX_ADMIN_KEY || process.env.SOVYX_ADMIN_KEY || 'admin1234',
      FB_APP_ID: config.META_APP_ID || process.env.META_APP_ID || ''
    });
  });
}

// B. Pasarela de Pago & Checkout
try {
  app.use('/api/pago', require('../routes/pago'));
} catch (e) {
  app.use('/api/pagos', require('./routes/pagos'));
}

// C. Onboarding Tester & Validaciones Meta
try {
  app.use('/api/onboarding', require('../routes/onboardingRoutes'));
} catch (e) { console.warn('Módulo onboardingRoutes no cargado.'); }

// D. Panel Admin & Aprobaciones
try {
  app.use('/api/admin', require('../routes/adminRoutes'));
} catch (e) { console.warn('Módulo adminRoutes no cargado.'); }

// E. Carga de Data CSV/XLSX
try {
  app.use('/api', require('../routes/uploadRoutes'));
} catch (e) { console.warn('Módulo uploadRoutes no cargado.'); }

// F. Autenticación Meta OAuth
try {
  app.use('/api/auth', require('../routes/authRoutes'));
} catch (e) { console.warn('Módulo authRoutes no cargado.'); }

// G. Inyección de Campañas en Borrador (Ciclo 48h)
try {
  app.use('/api/pagos', require('../routes/cicloRoutes'));
} catch (e) { console.warn('Módulo cicloRoutes no cargado.'); }

// H. Chat Web & Slots
try {
  app.use('/api/chat', require('./chat/chat'));
} catch (e) {
  app.post('/api/chat', (req, res) => {
    res.json({ reply: 'Sistema SOVYX: Mensaje recibido. Slot en proceso de asignación.' });
  });
}

try {
  app.use('/slots', require('../slots/slots'));
} catch (e) { console.warn('Módulo slots no cargado.'); }

// I. Webhooks externos (Kontigo)
try {
  app.use('/api/webhooks', require('./routes/kontigoWebhook'));
} catch (e) { console.warn('Módulo kontigoWebhook no cargado.'); }

// J. Módulos IA
try { app.use('/api/ia1', require('./ia/ia1-segmentar')); } catch (e) {}
try { app.use('/api/ia2', require('./ia/ia2-conversar')); } catch (e) {}
try { app.use('/api/ia3', require('./ia/ia3-analizar')); } catch (e) {}

// K. Disponibilidad de Slots (Límite 4 Clientes)
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
    res.json({
      totalSlots: 4,
      ocupados: 0,
      disponibles: 4,
      mensaje: "Slots disponibles",
      precio: { ticket: 1000, moneda: 'USD' }
    });
  }
});

// L. Dashboard & Cuentas Operativas
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
    res.status(500).json({ error: 'Error al cargar configuración de cuentas' });
  }
});

// M. Healthcheck & Estado del Sistema
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
    mode: process.env.NODE_ENV || 'production',
    db_status: mongoose.connection.readyState === 1 ? 'CONNECTED' : 'DISCONNECTED',
    timestamp: new Date().toISOString(),
    version: '2.0.26',
    slots_update: '4 MAX',
  });
});

// ============================================
// 4. CONTROL DE ERRORES Y RUTAS NO ENCONTRADAS
// ============================================
app.use((req, res) => {
  res.status(404).json({ error: `Ruta ${req.url} no encontrada en SOVYX OS` });
});

app.use((err, req, res, next) => {
  if (sovyxLogger && sovyxLogger.error) {
    sovyxLogger.error('CRITICAL_SYSTEM_ERROR', { error: err.message });
  }
  console.error('💥 Error no controlado:', err);
  res.status(500).json({ error: 'Falla interna en el motor de SOVYX. Reiniciando secuencia...' });
});

// ============================================
// 5. ACTIVACIÓN DEL SERVIDOR
// ============================================
const PORT = process.env.PORT || config.port || 10000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🚀 SOVYX OS v2.0.26 - SISTEMA ACTIVADO
  📡 Puerto: ${PORT}
  🎯 Objetivo: 4 Usuarios Segmentados (High Retention)
  💼 Slots: 4 Clientes (Escasez Activada)
  💬 Ruta Chat: /api/chat
  💳 Ruta Pago: /api/pago/checkout
  🧪 Ruta Onboarding: /api/onboarding
  ⏰ Cronjob Meta 24h/48h: ACTIVADO
  🟢 Base de Datos: ${MONGO_URI ? 'Configurada' : 'Pendiente URI'}
  `);
});

module.exports = app;
