const express = require('express');
const cors = require('cors');
const config = require('../config/tokens');
const sovyxLogger = require('../modules/sovyxLogger');

const app = express();

// ============================================
// 1. MIDDLEWARES PRINCIPALES (Van arriba del todo)
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
// 2. RUTAS API & NÚCLEO
// ============================================

// Chat & Slots (Nueva Infraestructura)
const chatRoutes = require('./chat/chat');
const slotsRoutes = require('../slots/slots');
app.use('/api/chat', chatRoutes);
app.use('/slots', slotsRoutes);

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
    timestamp: new Date().toISOString(),
    version: '2.0.26',
    slots_update: '4 MAX',
    engine: 'Gemini-1.5-Flash-Enabled'
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
      precio: { ticket: 5000, moneda: 'USDT' }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error en base de datos' });
  }
});

// Dashboard & Cuentas
app.get('/api/accounts', (req, res) => {
  try {
    const ACCOUNTS = require('../config/accounts');
    
    const limpiarCuenta = (cuenta) => {
      if (!cuenta) return null;
      const { instagram_token, instagram_id, facebook_token, ...publicData } = cuenta;
      return publicData;
    };

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
// 3. MANEJO DE ERRORES & 404 (DEBE IR AL FINAL)
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
// 4. ACTIVACIÓN ÚNICA DEL SERVIDOR
// ============================================
const PORT = process.env.PORT || config.port || 10000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🚀 SOVYX OS v2.0.26 - SISTEMA ACTIVADO
  📡 Puerto: ${PORT}
  🎯 Objetivo: 4 Usuarios Segmentados (High Retention)
  💼 Slots: 4 Clientes (Escasez Activada)
  💬 Ruta Chat: /api/chat
  📊 Ruta Slots: /api/slots
  `);
});

module.exports = app;
