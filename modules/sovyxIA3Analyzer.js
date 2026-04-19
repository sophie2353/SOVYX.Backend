// modules/sovyxIA3Analyzer.js
const sovyxLogger = require('../modules/sovyxLogger');
const fs = require('fs');
const path = require('path');
const config = require('../config/tokens');

class SOVYXIA3Analyzer {
  constructor() {
    this.results = [];
    this.compradores = [];
    this.db = null;
    // Rutas de aprendizaje físico para la IA1
    this.learningPath = path.join(__dirname, '../data/ia3_learning.json');
    this.copyPath = path.join(__dirname, '../data/ia1_copy_patterns.json');
  }

  async initDB() {
    if (!this.db) {
      this.db = require('./sovyxDatabase');
    }
    return this.db;
  }

  // ============================================
  // PROCESAR ONBOARDING (FORM + CHAT)
  // El motor principal que alimenta a SOVYX y SOEDITIA
  // ============================================
  async procesarOnboardingYMejorar(datosFormulario) {
    sovyxLogger.info('🧬 IA3: Iniciando optimización profunda (Form + Chat)', { 
      cliente: datosFormulario.instagram_user 
    });

    try {
      // 1. Extraer patrón psicográfico del formulario
      const patronForm = {
        nicho: datosFormulario.nicho,
        edad: parseInt(datosFormulario.edad) || 30,
        ciudad: datosFormulario.ciudad,
        ticket: datosFormulario.precioTicket,
        dolores: datosFormulario.perfilAudiencia,
        timestamp: new Date().toISOString()
      };

      // 2. Analizar el chat previo de este usuario para extraer el "ADN de venta"
      const idUsuario = datosFormulario.instagram_user;
      const adnVenta = await this.analizarConversacionDeExito(idUsuario, 'sovyx');

      // 3. Persistencia en DB
      const db = await this.initDB();
      await db.guardarPerfilCompradorElite({ ...patronForm, adnVenta });

      // 4. Feedback a la IA1: Segmentación + Copywriting ganador
      await this.mejorarIA1({ ...patronForm, scripts: adnVenta }, 'sovyx_high_ticket');

      return { success: true, message: "IA1 e IA2 optimizadas con el éxito de esta venta." };
    } catch (error) {
      sovyxLogger.error('Error en procesamiento profundo IA3', { error: error.message });
      return { error: error.message };
    }
  }

  // ============================================
  // ANALIZAR CONVERSACIÓN DE ÉXITO
  // Extrae los disparadores psicológicos que cerraron los 5,000 USDT
  // ============================================
  async analizarConversacionDeExito(clienteId, cuenta) {
    sovyxLogger.info(`🧠 IA3: Analizando ADN de la venta para ${clienteId}`);
    const db = await this.initDB();
    
    // Traemos el historial de la conversación desde la DB
    const historial = await db.getHistorialConversacion(clienteId) || [];
    
    if (historial.length === 0) return null;

    // Detectamos qué preguntas hizo el cliente y qué respuestas de la IA2 funcionaron
    const objecionesResueltas = historial
      .filter(h => h.intencion === 'objecion' || h.intencion === 'precio')
      .map(h => h.mensajeCliente);

    const disparadorFinal = historial
      .filter(h => h.intencion === 'compra')
      .map(h => h.mensajeIA);

    const patronCierre = {
      clienteId,
      objeciones: objecionesResueltas,
      argumentosGanadores: disparadorFinal,
      timestamp: new Date().toISOString()
    };

    // Guardamos el script ganador para que la IA2 lo replique
    await db.guardarScriptGanador(cuenta, patronCierre);
    
    // Guardamos los patrones de texto para los futuros anuncios de la IA1
    await this.mejorarCopywritingIA1(patronCierre);

    return patronCierre;
  }

  // ============================================
  // MEJORAR IA1 (APRENDIZAJE FÍSICO)
  // ============================================
  async mejorarIA1(patron, cuenta) {
    try {
      let aprendizajePrevio = {};
      if (fs.existsSync(this.learningPath)) {
        aprendizajePrevio = JSON.parse(fs.readFileSync(this.learningPath));
      }

      const dataParaIA1 = {
        cuenta,
        patron: { ...aprendizajePrevio.patron, ...patron },
        status: "optimized",
        soeditia_ready: true,
        precision_base: 0.60 // El 60% de precisión inicial para SOEDITIA
      };

      fs.writeFileSync(this.learningPath, JSON.stringify(dataParaIA1, null, 2));
      sovyxLogger.success('✅ IA1: Segmentación actualizada con éxito');
    } catch (e) {
      sovyxLogger.error('Error escribiendo aprendizaje IA1', { error: e.message });
    }
  }

  async mejorarCopywritingIA1(patronCierre) {
    try {
      let data = [];
      if (fs.existsSync(this.copyPath)) {
        data = JSON.parse(fs.readFileSync(this.copyPath));
      }
      
      data.push(patronCierre);
      if (data.length > 15) data.shift(); // Mantenemos los últimos 15 cierres

      fs.writeFileSync(this.copyPath, JSON.stringify(data, null, 2));
      sovyxLogger.success('✍️ IA1: Patrones de copy actualizados');
    } catch (e) {
      sovyxLogger.error('Error en IA3 actualizando copy', { error: e.message });
    }
  }

  // Analítica básica de posts (IG Metrics)
  async analizarPostYRetroalimentar(postId, cuenta) {
    const db = await this.initDB();
    const interacciones = await db.getInteraccionesPorPost(postId) || [];
    
    const leadsValor = interacciones.filter(i => 
      i.etapa === 'onboarding' || i.etapa === 'pago_pendiente' || i.etapa === 'lista_espera'
    );
    
    if (leadsValor.length >= 1) {
      const edades = leadsValor.map(l => l.edad || 30);
      const patron = {
        edad_ideal: Math.round(edades.reduce((a,b) => a+b, 0) / edades.length),
        top_ciudad: leadsValor[0].ciudad || 'Global',
        confianza: Math.min(100, leadsValor.length * 20)
      };
      await this.mejorarIA1(patron, cuenta);
      return patron;
    }
    return { success: true, message: "Datos insuficientes." };
  }
}

module.exports = SOVYXIA3Analyzer;
