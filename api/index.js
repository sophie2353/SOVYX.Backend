// api/index.js
const express = require('express');
const cors = require('cors');
const config = require('../config/tokens');
const sovyxLogger = require('../modules/sovyxLogger');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  sovyxLogger.info(`${req.method} ${req.path}`);
  next();
});

// ============================================
// RUTAS
// ============================================

// Ruta de salud de SOVYX
app.get('/api/health', (req, res) => {
  res.json({
    status: '🟢 SOVYX OPERATIONAL',
    mode: config.sovyx.mode,
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// --- RUTAS DE MÓDULOS ---
app.use('/api/posts', require('./posts/publicar'));
app.use('/api/posts', require('./posts/analizar'));
app.use('/api/ia', require('./ia/ia1-segmentar'));
app.use('/api/ia', require('./ia/ia2-conversar'));
app.use('/api/ia', require('./ia/ia3-analizar'));
app.use('/api/instagram', require('./instagram/webhook'));

// --- RUTA DE CLIENTES DISPONIBLES ---
app.get('/api/clientes/disponibles', async (req, res) => {
  try {
    const db = require('../modules/sovyxDatabase');
    const slotsOcupados = await db.countClientes();
    const slotsDisponibles = config.sovyx.maxClients - slotsOcupados;
    
    res.json({
      totalSlots: config.sovyx.maxClients,
      ocupados: slotsOcupados,
      disponibles: slotsDisponibles,
      precio: { min: 5000, max: 5000, moneda: 'USD' }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error en base de datos' });
  }
});

// --- RUTA DE CUENTAS (CORREGIDA PARA EL FRONTEND) ---
// La cambié de '/api/accounts' a '/accounts' para que coincida con tu error 404
app.get('/accounts', (req, res) => {
  try {
    const ACCOUNTS = require('../config/accounts');
    
    // Función para limpiar datos sensibles (tokens)
    const limpiarCuenta = (cuenta) => {
      if (!cuenta) return null;
      const { instagram_token, instagram_id, ...publicData } = cuenta;
      return publicData;
    };

    // Separamos mis cuentas de los clientes
    const mis_cuentas = [
      limpiarCuenta(ACCOUNTS.sovyx),
      limpiarCuenta(ACCOUNTS.socredi)
    ].filter(Boolean);

    const clientes = [];
    for (let i = 1; i <= 8; i++) {
      const cliente = limpiarCuenta(ACCOUNTS[`client${i}`]);
      if (cliente) clientes.push(cliente);
    }

    res.json({
      mis_cuentas,
      clientes
    });
  } catch (error) {
    sovyxLogger.error('Error procesando cuentas', { error: error.message });
    res.status(500).json({ error: 'Error al cargar configuración de cuentas' });
  }
});

// Manejador de errores global
app.use((err, req, res, next) => {
  sovyxLogger.error('Error no manejado', { error: err.message });
  res.status(500).json({ error: err.message });
});

// ============================================
// LEVANTAR SERVIDOR
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SOVYX BACKEND - Puerto ${PORT}`);
});

module.exports = app;
