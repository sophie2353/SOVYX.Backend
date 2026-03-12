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
app.get('/api/health', (req, res) => {
  res.json({
    status: '🟢 SOVYX OPERATIONAL',
    mode: config.sovyx.mode,
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

app.use('/api/posts', require('./posts/publicar'));
app.use('/api/posts', require('./posts/analizar'));
app.use('/api/ia', require('./ia/ia1-segmentar'));
app.use('/api/ia', require('./ia/ia2-conversar'));
app.use('/api/ia', require('./ia/ia3-analizar'));
app.use('/api/meta', require('./meta/simulador'));
app.use('/api/instagram', require('./instagram/webhook'));

app.get('/api/clientes/disponibles', async (req, res) => {
  const db = require('../modules/sovyxDatabase');
  const slotsOcupados = await db.countClientes();
  const slotsDisponibles = config.sovyx.maxClients - slotsOcupados;
  
  res.json({
    totalSlots: config.sovyx.maxClients,
    ocupados: slotsOcupados,
    disponibles: slotsDisponibles,
    precio: { min: 5000, max: 5000, moneda: 'USD' }  // ✅ CORREGIDO
  });
});

app.get('/api/accounts', (req, res) => {
  const ACCOUNTS = require('../config/accounts');
  const cuentasSeguras = {};
  
  Object.keys(ACCOUNTS).forEach(key => {
    cuentasSeguras[key] = {
      id: ACCOUNTS[key].id,
      name: ACCOUNTS[key].name,
      type: ACCOUNTS[key].type,
      posts_plan: ACCOUNTS[key].posts_plan,
      budget: ACCOUNTS[key].budget
    };
  });
  
  res.json({
    mis_cuentas: [cuentasSeguras.sovyx, cuentasSeguras.socredi].filter(Boolean),
    clientes: [
      cuentasSeguras.client1,
      cuentasSeguras.client2,
      cuentasSeguras.client3,
      cuentasSeguras.client4,
      cuentasSeguras.client5,
      cuentasSeguras.client6,
      cuentasSeguras.client7,
      cuentasSeguras.client8
    ].filter(Boolean)
  });
});

app.use((err, req, res, next) => {
  sovyxLogger.error('Error no manejado', { error: err.message });
  res.status(500).json({ error: err.message });
});

// ============================================
// LEVANTAR SERVIDOR (CON PUERTO DE RENDER)
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🗿 SOVYX BACKEND - Puerto ${PORT}`);
});

module.exports = app;
