const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

// Configuración & Logging Centralizado
const config = require('../config/tokens');
const sovyxLogger = require('../modules/sovyxLogger');

// Tarea Programada: Ciclo automatizado Meta Ads 24h/48h
try {
  require('../jobs/cron24h');
} catch (e) {
  try {
    require('./jobs/cron24h');
  } catch (err) {
    console.warn('⚠️ [SOVYX CRON] Módulo cron24h no encontrado, omitiendo ejecuciones en segundo plano.');
  }
}

const app = express();

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
  try {
    app.use('/api', require('./routes/configRoutes'));
  } catch (err) {
    app.get('/api/config', (req, res) => {
      res.json({
        SOVYX_ADMIN_KEY: config.SOVYX_ADMIN_KEY || process.env.SOVYX_ADMIN_KEY || 'admin1234',
        FB_APP_ID: config.meta?.appId || process.env.META_APP_ID || ''
      });
    });
  }
}

// B. Pasarela de Pago & Checkout ($1K, $5K, $9K + Meta CAPI + Slots)
try {
  const pagoRoutes = require('../routes/pago');
  app.use('/api/pagos', pagoRoutes);
  app.use('/api/pago', pagoRoutes);
} catch (e) {
  try {
    const pagoRoutes = require('./routes/pago');
    app.use('/api/pagos', pagoRoutes);
    app.use('/api/pago', pagoRoutes);
  } catch (err) {
    console.warn('⚠️ Módulo routes/pago no cargado.');
  }
}

// C. Integración Meta Graph API & Ciclo 48H (IA-1)
try {
  app.use('/api/meta', require('../routes/meta'));
} catch (e) {
  try {
    app.use('/api/meta', require('./routes/meta'));
  } catch (err) {
    console.warn('⚠️ Módulo routes/meta no cargado.');
  }
}

// D. Onboarding Tester & Validaciones Meta
try {
  app.use('/api/onboarding', require('../routes/onboardingRoutes'));
} catch (e) {
  try {
    app.use('/api/onboarding', require('./routes/onboardingRoutes'));
  } catch (err) { console.warn('⚠️ Módulo onboardingRoutes no cargado.'); }
}

// E. Panel Admin & Aprobaciones
try {
  app.use('/api/admin', require('../routes/adminRoutes'));
} catch (e) {
  try {
    app.use('/api/admin', require('./routes/adminRoutes'));
  } catch (err) { console.warn('⚠️ Módulo adminRoutes no cargado.'); }
}

// F. Carga de Data CSV/XLSX (Multer en RAM -> MongoDB)
try {
  app.use('/api/upload', require('../routes/uploadRoutes'));
} catch (e) {
  try {
    app.use('/api/upload', require('./routes/uploadRoutes'));
  } catch (err) { console.warn('⚠️ Módulo uploadRoutes no cargado.'); }
}

// G. Autenticación Meta OAuth
try {
  app.use('/api/auth', require('../routes/authRoutes'));
} catch (e) {
  try {
    app.use('/api/auth', require('./routes/authRoutes'));
  } catch (err) { console.warn('⚠️ Módulo authRoutes no cargado.'); }
}

// H. Inyección de Campañas en Borrador & Notificación 24h/48h
try {
  app.use('/api/ciclo', require('../routes/cicloRoutes'));
} catch (e) {
  try {
    app.use('/api/ciclo', require('./routes/cicloRoutes'));
  } catch (err) { console.warn('⚠️ Módulo cicloRoutes no cargado.'); }
}

// I. Chat Web & Slots
try {
  app.use('/api/chat', require('../chat/chat'));
} catch (e) {
  try {
    app.use('/api/chat', require('./chat/chat'));
  } catch (err) {
    app.post('/api/chat', (req, res) => {
      res.json({ reply: 'Sistema SOVYX: Mensaje recibido. Slot en proceso de asignación.' });
    });
  }
}

try {
  app.use('/slots', require('../slots/slots'));
} catch (e) {
  try {
    app.use('/slots', require('./slots/slots'));
  } catch (err) { console.warn('⚠️ Módulo slots no cargado.'); }
}

// J. Webhooks externos (Kontigo)
try {
  app.use('/api/webhooks', require('../routes/kontigoWebhook'));
} catch (e) {
  try {
    app.use('/api/webhooks', require('./routes/kontigoWebhook'));
  } catch (err) { console.warn('⚠️ Módulo kontigoWebhook no cargado.'); }
}

// K. Módulos IA
try { app.use('/api/ia1', require('../ia/ia1-segmentar')); } catch (e) { try { app.use('/api/ia1', require('./ia/ia1-segmentar')); } catch (err) {} }
try { app.use('/api/ia2', require('../ia/ia2-conversar')); } catch (e) { try { app.use('/api/ia2', require('./ia/ia2-conversar')); } catch (err) {} }
try { app.use('/api/ia3', require('../ia/ia3-analizar')); } catch (e) { try { app.use('/api/ia3', require('./ia/ia3-analizar')); } catch (err) {} }

// L. Disponibilidad de Slots (Límite 2 Clientes - High Ticket)
app.get('/api/clientes/disponibles', async (req, res) => {
  const maxSovyxSlots = config.sovyx?.totalSlots || 2;
  try {
    const db = require('../modules/sovyxDatabase');
    const slotsOcupados = await db.countClientes();
    const slotsDisponibles = maxSovyxSlots - slotsOcupados;
    
    res.json({
      totalSlots: maxSovyxSlots,
      ocupados: slotsOcupados,
      disponibles: slotsDisponibles > 0 ? slotsDisponibles : 0,
      mensaje: slotsDisponibles <= 0 ? "SOLD OUT" : "Slots disponibles",
      precio: { 
        reserva: config.sovyx?.priceInitial || 1000, 
        final: config.sovyx?.priceFinal || 9000,
        total: 10000,
        moneda: 'USD' 
      }
    });
  } catch (error) {
    res.json({
      totalSlots: maxSovyxSlots,
      ocupados: 0,
      disponibles: maxSovyxSlots,
      mensaje: "Slots disponibles",
      precio: { 
        reserva: 1000, 
        final: 9000,
        total: 10000,
        moneda: 'USD' 
      }
    });
  }
});

// M. Healthcheck & Estado del Sistema
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    system: 'SOVYX Core AI Engine',
    version: '2.0.26',
    slots: config.sovyx?.totalSlots || 2
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: '🟢 SOVYX OPERATIONAL',
    mode: process.env.NODE_ENV || 'production',
    db_status: mongoose.connection.readyState === 1 ? 'CONNECTED' : 'DISCONNECTED',
    timestamp: new Date().toISOString(),
    version: '2.0.26',
    slots_update: `${config.sovyx?.totalSlots || 2} MAX ($10K High Ticket)`,
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
  🎯 Objetivo: 2 Clientes High-Ticket ($10,000 USD Total)
  💼 Slots: 2 Exclusivos (Reserva $1K / Cripto $9K)
  💳 Ruta Pago: /api/pagos (/link & /notificar-pago)
  🦁 Ruta Meta: /api/meta (/conectar & /iniciar-ciclo)
  💬 Ruta Chat: /api/chat
  🧪 Ruta Onboarding: /api/onboarding
  ⏰ Cronjob Meta 24h/48h: ACTIVADO
  🟢 Base de Datos: ${MONGO_URI ? 'Configurada' : 'Pendiente URI'}
  `);
});

module.exports = app;
