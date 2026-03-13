// modules/sovyxIA3Analyzer.js
// IA3 - Analiza compradores y MEJORA IA1 e IA2 automáticamente

const sovyxLogger = require('./sovyxLogger');

class SOVYXIA3Analyzer {
  constructor() {
    this.results = [];
    this.compradores = [];
    this.db = null;
  }
  
  // ============================================
  // INICIALIZAR BASE DE DATOS
  // ============================================
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
//           ↑ 'i' en vez de 'í' (sin tilde)
}
    sovyxLogger.info('🔄 IA3: Analizando post', { postId, cuenta });
    
    const db = await this.initDB();
    
    // Obtener datos del post
    const post = await db.getPost(postId);
    if (!post) {
      sovyxLogger.error('Post no encontrado', { postId });
      return { error: 'Post no encontrado' };
    }
    
    // Obtener interacciones
    const interacciones = await db.getInteraccionesPorPost(postId) || [];
    
    // Obtener compradores (los que llegaron a etapa calificado)
    const compradores = interacciones.filter(i => i.etapa === 'calificado' || i.probCierre > 0.7);
    
    sovyxLogger.info('📊 IA3: Datos del post', {
      interacciones: interacciones.length,
      compradores: compradores.length
    });
    
    // Si hay compradores, retroalimentar
    if (compradores.length >= 1) {
      await this.retroalimentarConCompradores(compradores, cuenta);
    }
    
    return {
      postId,
      cuenta,
      interacciones: interacciones.length,
      compradores_encontrados: compradores.length,
      retroalimentacion_aplicada: compradores.length >= 1
    };
  }
  
  // ============================================
  // RETROALIMENTAR CON COMPRADORES
  // ============================================
  async retroalimentarConCompradores(compradores, cuenta) {
    sovyxLogger.info('🎯 IA3: Retroalimentando', { cantidad: compradores.length, cuenta });
    
    // 1. Encontrar patrón
    const patron = this.encontrarPatronCompradores(compradores);
    
    // 2. Mejorar IA1
    await this.mejorarIA1(patron, cuenta);
    
    // 3. Mejorar IA2
    await this.mejorarIA2(patron, compradores, cuenta);
    
    // 4. Guardar patrón
    const db = await this.initDB();
    await db.guardarPatronGanador({
      cuenta,
      patron,
      timestamp: new Date().toISOString()
    });
    
    return patron;
  }
  
  // ============================================
  // ENCONTRAR PATRÓN EN COMPRADORES
  // ============================================
  encontrarPatronCompradores(compradores) {
    this.compradores = compradores;
    
    // Edades
    const edades = compradores.map(c => c.edad || 35);
    const edadMin = Math.min(...edades);
    const edadMax = Math.max(...edades);
    const edadProm = Math.round(edades.reduce((a, b) => a + b, 0) / edades.length);
    
    // Países
    const paises = {};
    compradores.forEach(c => {
      const pais = c.pais || 'US';
      paises[pais] = (paises[pais] || 0) + 1;
    });
    
    // Ciudades
    const ciudades = {};
    compradores.forEach(c => {
      const ciudad = c.ciudad || 'Miami';
      ciudades[ciudad] = (ciudades[ciudad] || 0) + 1;
    });
    
    // Intereses
    const intereses = {};
    compradores.forEach(c => {
      (c.intereses || ['Coaching', 'Fitness']).forEach(i => {
        intereses[i] = (intereses[i] || 0) + 1;
      });
    });
    
    // Horas
    const horas = compradores.map(c => {
      if (c.horaCompra) return new Date(c.horaCompra).getHours();
      if (c.timestamp) return new Date(c.timestamp).getHours();
      return 21;
    });
    const horaOptima = this.moda(horas) || 21;
    
    return {
      confianza: Math.min(100, compradores.length * 20),
      edad: {
        min: edadMin,
        max: edadMax,
        promedio: edadProm,
        rango: `${edadMin}-${edadMax}`
      },
      paises_top: Object.entries(paises)
        .sort((a, b) => b[1] - a[1])
        .map(([p]) => p),
      ciudades_top: Object.entries(ciudades)
        .sort((a, b) => b[1] - a[1])
        .map(([c]) => c),
      intereses_top: Object.entries(intereses)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([i]) => i),
      horario_optimo: horaOptima
    };
  }
  
  // ============================================
  // MEJORAR IA1
  // ============================================
  async mejorarIA1(patron, cuenta) {
    sovyxLogger.info('🎯 IA3: Mejorando IA1');
    
    const db = await this.initDB();
    
    const nuevaConfig = {
      edad_min: patron.edad.min,
      edad_max: patron.edad.max,
      paises: patron.paises_top.slice(0, 3),
      ciudades: patron.ciudades_top.slice(0, 5),
      intereses: patron.intereses_top,
      horario: patron.horario_optimo - 3,
      version: Date.now(),
      actualizado_por: 'IA3'
    };
    
    await db.guardarIA1Config(cuenta, nuevaConfig);
    
    sovyxLogger.success('✅ IA1 mejorada');
    return nuevaConfig;
  }
  
  // ============================================
  // MEJORAR IA2
  // ============================================
  async mejorarIA2(patron, compradores, cuenta) {
    sovyxLogger.info('💬 IA3: Mejorando IA2');
    
    const db = await this.initDB();
    
    const mejoras = {
      horario_respuesta: patron.horario_optimo - 1,
      palabras_clave: patron.intereses_top,
      version: Date.now()
    };
    
    await db.guardarIA2Mejoras(cuenta, mejoras);
    
    sovyxLogger.success('✅ IA2 mejorada');
    return mejoras;
  }
  
  // ============================================
  // UTILIDADES
  // ============================================
  moda(array) {
    if (!array.length) return null;
    const freq = {};
    array.forEach(v => freq[v] = (freq[v] || 0) + 1);
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
  }
}

module.exports = SOVYXIA3Analyzer;
