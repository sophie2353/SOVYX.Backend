const express = require('express');
const cors = require('cors');
const config = require('../config/tokens');
const sovyxLogger = require('../modules/sovyxLogger');

const app = express();

app.use(cors());
// Aumentamos el límite para que Gemini pueda recibir archivos/imágenes pesadas del curso
app.use(express.json({ limit: '100mb' })); 
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Logger de tráfico SOVYX
app.use((req, res, next) => {
  sovyxLogger.info(`${req.method} ${req.path}`);
  next();
});

// ============================================
// RUTAS NÚCLEO
// ============================================

app.get('/api/health', (req, res) => {
  res.json({
    status: '🟢 SOVYX OPERATIONAL',
    mode: config.sovyx?.mode || 'production',
    timestamp: new Date().toISOString(),
    version: '2.0.26',
    slots_update: '4 MAX'
  });
});

// --- RUTAS DE MÓDULOS INTELIGENTES ---
app.use('/api/posts', require('./posts/publicar'));
app.use('/api/posts', require('./posts/analizar'));
app.use('/api/ia1', require('./ia/ia1-segmentar')); // IA1: Ads & Targeting
app.use('/api/ia2', require('./ia/ia2-conversar')); // IA2: DMs & Webhook
app.use('/api/ia3', require('./ia/ia3-analizar')); // IA3: Aprendizaje & 27k
app.use('/api/onboarding', require('./ia/ia2-onboarding')); // Onboarding + Gemini
app.use('/api/instagram', require('./instagram/webhook'));

// --- RUTA DE CLIENTES (Lógica de Escasez de 4 Slots) ---
app.get('/api/clientes/disponibles', async (req, res) => {
  try {
    const db = require('../modules/sovyxDatabase');
    const slotsOcupados = await db.countClientes();
    // Forzamos el límite a 4 según tu última corrección
    const maxSovyxSlots = 4; 
    const slotsDisponibles = maxSovyxSlots - slotsOcupados;
    
    res.json({
      totalSlots: maxSovyxSlots,
      ocupados: slotsOcupados,
      disponibles: slotsDisponibles > 0 ? slotsDisponibles : 0,
      mensaje: slotsDisponibles <= 0 ? "SOLD OUT 👺" : "Slots disponibles",
      precio: { ticket: 5000, moneda: 'USDT' }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error en base de datos' });
  }
});

// --- GESTIÓN DE CUENTAS (Optimizado para Frontend) ---
app.get('/api/accounts', (req, res) => {
  try {
    const ACCOUNTS = require('../config/accounts');
    
    const limpiarCuenta = (cuenta) => {
      if (!cuenta) return null;
      const { instagram_token, instagram_id, facebook_token, ...publicData } = cuenta;
      return publicData;
    };

    // Estructura SOVYX Corp.
    const mis_cuentas = [
      limpiarCuenta(ACCOUNTS.sovyx),
      limpiarCuenta(ACCOUNTS.socredi),
      limpiarCuenta(ACCOUNTS.soeditia),
      limpiarCuenta(ACCOUNTS.soalefia)
    ].filter(Boolean);

    // Clientes limitados a 4
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
    sovyxLogger.error('Error procesando cuentas', { error: error.message });
    res.status(500).json({ error: 'Error al cargar configuración' });
  }
});

// Error 404 personalizado para SOVYX
app.use((req, res) => {
  res.status(404).json({ error: `Ruta ${req.url} no encontrada en SOVYX OS` });
});

// Manejador de errores global
app.use((err, req, res, next) => {
  sovyxLogger.error('CRITICAL_SYSTEM_ERROR', { error: err.message });
  res.status(500).json({ error: 'Falla interna en el motor de SOVYX' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  =======================================
  🚀 SOVYX OS - SISTEMA ACTIVADO
  📡 Puerto: ${PORT}
  🎯 Objetivo: 27K Usuarios Segmentados
  🛰️ Onboarding: Gemini AI Ready
  =======================================
  `);
});

module.exports = app;
