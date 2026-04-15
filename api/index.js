const express = require('express');
const cors = require('cors');
const config = require('../config/tokens');
const sovyxLogger = require('../modules/sovyxLogger');

const app = express();

// Middlewares de seguridad y capacidad
app.use(cors());
// 100mb es vital para recibir el material/enlaces del curso vía Onboarding sin errores
app.use(express.json({ limit: '100mb' })); 
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Logger de tráfico SOVYX (Monitoreo en tiempo real)
app.use((req, res, next) => {
  sovyxLogger.info(`${req.method} ${req.path}`);
  next();
});

// ============================================
// RUTAS NÚCLEO & SALUD
// ============================================

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

// ============================================
// RUTAS DE MÓDULOS INTELIGENTES (CEREBRO)
// ============================================

// NUEVO: Manejo de Tokens y vinculación de Instagram (Code -> Long Token)
app.use('/api/auth', require('./auth/callback')); 

// IA1: Gestión de Anuncios y Segmentación
app.use('/api/ia1', require('./ia/ia1-segmentar')); 

// IA2: Conversaciones por DM y Webhook de Meta
app.use('/api/ia2', require('./ia/ia2-conversar')); 

// IA2 ONBOARDING: El motor que usa Gemini para analizar los cursos de 5K
app.use('/api/onboarding', require('./ia/ia2-onboarding')); 

// IA3: Analítica masiva para escalar a los 27K usuarios
app.use('/api/ia3', require('./ia/ia3-analizar')); 

// Gestión de contenido y Webhooks de Instagram
app.use('/api/posts', require('./posts/publicar'));
app.use('/api/posts', require('./posts/analizar'));
app.use('/api/instagram', require('./instagram/webhook'));

// ============================================
// GESTIÓN DE CLIENTES Y CUENTAS
// ============================================

// Lógica de Escasez: Máximo 4 personas
app.get('/api/clientes/disponibles', async (req, res) => {
  try {
    const db = require('../modules/sovyxDatabase');
    const slotsOcupados = await db.countClientes();
    const maxSovyxSlots = 4; // Tu regla de oro para mantener exclusividad
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

// Gestión de cuentas para el Dashboard (Limpia tokens sensibles)
app.get('/api/accounts', (req, res) => {
  try {
    const ACCOUNTS = require('../config/accounts');
    
    const limpiarCuenta = (cuenta) => {
      if (!cuenta) return null;
      const { instagram_token, instagram_id, facebook_token, ...publicData } = cuenta;
      return publicData;
    };

    // Estructura SOVYX Corp (Matriz + Proyectos Propios)
    const mis_cuentas = [
      limpiarCuenta(ACCOUNTS.sovyx),
      limpiarCuenta(ACCOUNTS.socredi),
      limpiarCuenta(ACCOUNTS.soeditia),
      limpiarCuenta(ACCOUNTS.soalefia)
    ].filter(Boolean);

    // Lista de Clientes (Top 4)
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
    res.status(500).json({ error: 'Error al cargar configuración de cuentas' });
  }
});

// ============================================
// MANEJO DE ERRORES & 404
// ============================================

app.use((req, res) => {
  res.status(404).json({ error: `Ruta ${req.url} no encontrada en SOVYX OS` });
});

app.use((err, req, res, next) => {
  sovyxLogger.error('CRITICAL_SYSTEM_ERROR', { error: err.message });
  res.status(500).json({ error: 'Falla interna en el motor de SOVYX. Reiniciando secuencia...' });
});

// ============================================
// ACTIVACIÓN DEL SISTEMA
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ======================================================
  🚀 SOVYX OS v2.0.26 - SISTEMA ACTIVADO (Rojo Nivel 1)
  📡 Puerto: ${PORT}
  🎯 Objetivo: 27K Usuarios Segmentados (High Retention)
  🛰️ Onboarding: Gemini-1.5-Flash Online 🧠
  💼 Slots: 4 Clientes (Escasez Activada)
  ======================================================
  `);
});

module.exports = app;
