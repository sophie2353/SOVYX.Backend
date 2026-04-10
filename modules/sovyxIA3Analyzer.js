// modules/sovyxIA3Analyzer.js
// IA3 - Analiza compradores y MEJORA IA1 e IA2 automáticamente
const sovyxLogger = require('../modules/sovyxLogger');
const fs = require('fs');
const path = require('path');

class SOVYXIA3Analyzer {
  constructor() {
    this.results = [];
    this.compradores = [];
    this.db = null;
    // La ruta donde la IA1 irá a buscar sus órdenes
    this.learningPath = path.join(__dirname, '../data/ia3_learning.json');
  }

  async initDB() {
    if (!this.db) {
      this.db = require('./sovyxDatabase');
    }
    return this.db;
  }

  // ============================================
  // ANALIZAR POST Y RETROALIMENTAR
  // ============================================
  async analizarPostYRetroalimentar(postId, cuenta) {
    sovyxLogger.info('🔬 IA3: Analizando post', { postId, cuenta });
    const db = await this.initDB();
    
    const post = await db.getPost(postId);
    if (!post) {
      sovyxLogger.error('Post no encontrado', { postId });
      return { error: 'Post no encontrado' };
    }
    
    const interacciones = await db.getInteraccionesPorPost(postId) || [];
    
    // Filtramos por los que realmente tienen potencial de 5,000 USDT
    const compradores = interacciones.filter(i => i.etapa === 'pago_confirmado' || i.etapa === 'pago_pendiente' || i.probCierre > 0.8);
    
    sovyxLogger.info('📊 IA3: Estadísticas detectadas', {
      total: interacciones.length,
      leads_alto_valor: compradores.length
    });
    
    if (compradores.length >= 1) {
      return await this.retroalimentarConCompradores(compradores, cuenta);
    }
    
    return { success: true, message: "No hay suficientes compradores para optimizar aún." };
  }

  // ============================================
  // RETROALIMENTAR CON COMPRADORES
  // ============================================
  async retroalimentarConCompradores(compradores, cuenta) {
    sovyxLogger.info('🎯 IA3: Generando patrón de éxito', { cantidad: compradores.length, cuenta });
    
    const patron = this.encontrarPatronCompradores(compradores);
    
    // 1. MEJORAR IA1 (Escribir archivo físico para autonomía)
    await this.mejorarIA1(patron, cuenta);
    
    // 2. MEJORAR IA2 (Guardar en DB para prompts futuros)
    await this.mejorarIA2(patron, compradores, cuenta);
    
    // 3. Guardar patrón histórico en DB
    const db = await this.initDB();
    await db.guardarPatronGanador({
      cuenta,
      patron,
      timestamp: new Date().toISOString()
    });
    
    return patron;
  }

  encontrarPatronCompradores(compradores) {
    const edades = compradores.map(c => c.edad || 35);
    const edadProm = Math.round(edades.reduce((a, b) => a + b, 0) / edades.length);
    
    const ciudades = {};
    compradores.forEach(c => {
      const ciudad = c.ciudad || 'Miami';
      ciudades[ciudad] = (ciudades[ciudad] || 0) + 1;
    });

    const intereses = {};
    compradores.forEach(c => {
      (c.intereses || ['High Ticket', 'IA']).forEach(i => {
        intereses[i] = (intereses[i] || 0) + 1;
      });
    });

    const topCiudad = Object.entries(ciudades).sort((a, b) => b[1] - a[1])[0][0];

    return {
      confianza: Math.min(100, compradores.length * 20),
      edad_ideal: edadProm,
      rango_edad: { min: Math.min(...edades), max: Math.max(...edades) },
      top_ciudad: topCiudad,
      intereses_top: Object.entries(intereses).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([i]) => i),
      timestamp: new Date().toISOString()
    };
  }

  // ============================================
  // MEJORAR IA1 (ESTA ES LA CLAVE)
  // ============================================
  async mejorarIA1(patron, cuenta) {
    try {
      // Escribimos el archivo que la IA1 leerá en su constructor/generador
      const dataParaIA1 = {
        cuenta,
        patron,
        status: "optimized"
      };

      fs.writeFileSync(this.learningPath, JSON.stringify(dataParaIA1, null, 2));
      sovyxLogger.success('✅ IA1: Aprendizaje físico inyectado con éxito');
    } catch (e) {
      sovyxLogger.error('Error escribiendo aprendizaje para IA1', { error: e.message });
    }
  }

  async mejorarIA2(patron, compradores, cuenta) {
    const db = await this.initDB();
    const mejoras = {
      palabras_clave_exito: patron.intereses_top,
      ultima_optimizacion: new Date().toISOString()
    };
    await db.guardarIA2Mejoras(cuenta, mejoras);
    sovyxLogger.success('✅ IA2: Sugerencias de keywords guardadas');
  }
}

module.exports = SOVYXIA3Analyzer;
