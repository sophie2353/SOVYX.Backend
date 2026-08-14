const express = require('express');
const cors = require('cors');
const config = require('../config/tokens');
const sovyxLogger = require('../modules/sovyxLogger');

const app = express();

// ============================================
// MIDDLEWARES
// ============================================
// Habilita CORS para que tu web (Frontend) pueda hacer peticiones a Render
app.use(cors({
  origin: '*', // En producción puedes poner la URL exacta de tu web
  methods: ['GET', 'POST', 'OPTIONS']
}));
// Permitir que el servidor procese JSON en el body de las peticiones
app.use(express.json());

// ============================================
// IMPORTAR RUTAS
// ============================================
const chatRoutes = require('./api/chat/chat');
const slotsRoutes = require('./slots/slots');

// ============================================
// MONTAR RUTAS API
// ============================================
app.use('/api/chat', chatRoutes);
app.use('/api/slots', slotsRoutes);

// Ruta de prueba (Healthcheck)
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    system: 'SOVYX Core AI Engine',
    version: '2.0.0'
  });
});

// Manejador de rutas no encontradas (404)
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado en el núcleo de SOVYX.' });
});

// ============================================
// INICIALIZACIÓN DEL SERVIDOR
// ============================================
app.listen(config.port, () => {
  console.log(`
  🦁 ======================================== 🦁
     SOVYX BACKEND ENGINE v2.0 - ACTIVE
     Puerto: ${config.port}
     Ruta Chat: /api/chat
     Ruta Slots: /api/slots
  🦁 ======================================== 🦁
 `);
});

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

// IA1: Gestión de Anuncios y Segmentación
app.use('/api/ia1', require('./ia/ia1-segmentar')); 

// IA2: Conversaciones por DM y Webhook de Meta
app.use('/api/ia2', require('./ia/ia2-conversar')); 


// IA3: Analítica masiva para escalar a los 27K usuarios
app.use('/api/ia3', require('./ia/ia3-analizar')); 

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
      mensaje: slotsDisponibles <= 0 ? "SOLD OUT" : "Slots disponibles",
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
  🚀 SOVYX OS v2.0.26 - SISTEMA ACTIVADO (Rojo Nivel 1)
  📡 Puerto: ${PORT}
  🎯 Objetivo: 27K Usuarios Segmentados (High Retention)
  🛰️ Onboarding: Gemini-1.5-Flash Online 🧠
  💼 Slots: 4 Clientes (Escasez Activada)
  
  );
});

module.exports = app;
