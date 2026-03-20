// modules/sovyxDatabase.js
const fs = require('fs');
const path = require('path');
const sovyxLogger = require('./sovyxLogger');

// Ruta donde se guardarán los datos
const DATA_PATH = path.join(__dirname, '../data/sovyx_db.json');

class SOVYXDatabase {
  constructor() {
    this.data = this.cargar();
  }
  
  // ============================================
  // CARGAR DATOS DESDE ARCHIVO
  // ============================================
  cargar() {
    try {
      if (fs.existsSync(DATA_PATH)) {
        const raw = fs.readFileSync(DATA_PATH, 'utf8');
        const data = JSON.parse(raw);
        sovyxLogger.info('📂 Datos cargados desde archivo', { 
          posts: data.posts?.length || 0,
          clientes: data.clientes?.length || 0,
          compradores: data.compradores?.length || 0
        });
        return data;
      }
    } catch (error) {
      sovyxLogger.error('Error cargando datos', { error: error.message });
    }
    
    // Estructura inicial
    return {
      posts: [],
      clientes: [],
      compradores: [],
      conversaciones: [],
      ciclos: [],
      analisis_posts: [],
      patrones_ia3: [],
      mejoras_ia1: [],
      mejoras_ia2: []
    };
  }
  
  // ============================================
  // GUARDAR DATOS EN ARCHIVO
  // ============================================
  guardar() {
    try {
      fs.writeFileSync(DATA_PATH, JSON.stringify(this.data, null, 2));
      sovyxLogger.info('💾 Datos guardados en archivo');
    } catch (error) {
      sovyxLogger.error('Error guardando datos', { error: error.message });
    }
  }
  
  // ============================================
  // POSTS
  // ============================================
  async guardarPost(post) {
    this.data.posts.push({
      ...post,
      _id: Date.now().toString(),
      timestamp: new Date().toISOString()
    });
    this.guardar();
    return post;
  }
  
  async getPost(postId) {
    return this.data.posts.find(p => p.id === postId || p._id === postId);
  }
  
  async getPostsPorCuenta(cuentaId, limite = 10) {
    return this.data.posts
      .filter(p => p.cuenta === cuentaId)
      .slice(-limite);
  }
  
  async getTodosLosPosts() {
    return this.data.posts;
  }
  
  async guardarCiclo(ciclo) {
    this.data.ciclos.push({
      ...ciclo,
      _id: Date.now().toString(),
      timestamp: new Date().toISOString()
    });
    this.guardar();
    return ciclo;
  }
  
  // ============================================
  // CLIENTES (los 8 slots)
  // ============================================
  async guardarCliente(cliente) {
    this.data.clientes.push({
      ...cliente,
      _id: Date.now().toString(),
      fecha_registro: new Date().toISOString(),
      estado: 'activo'
    });
    this.guardar();
    return cliente;
  }
  
  async getCliente(clienteId) {
    return this.data.clientes.find(c => c.id === clienteId || c._id === clienteId);
  }
  
  async countClientes() {
    return this.data.clientes.filter(c => c.estado === 'activo').length;
  }
  
  // ============================================
  // COMPRADORES (para IA3)
  // ============================================
  async guardarComprador(comprador) {
    this.data.compradores.push({
      ...comprador,
      _id: Date.now().toString(),
      timestamp: new Date().toISOString()
    });
    this.guardar();
    
    // 🔥 DISPARAR IA3 AUTOMÁTICAMENTE
    await this.analizarNuevosCompradores();
    
    return comprador;
  }
  
  async getCompradoresReales() {
    return this.data.compradores;
  }
  
  // ============================================
  // CONVERSACIONES (para IA2)
  // ============================================
  async guardarInteraccion(interaccion) {
    this.data.conversaciones.push({
      ...interaccion,
      _id: Date.now().toString()
    });
    this.guardar();
    return interaccion;
  }
  
  async getInteraccionesPorPost(postId) {
    return this.data.conversaciones.filter(i => i.postId === postId);
  }
  
  async getConversacionesUsuario(usuarioId, cuenta) {
    return this.data.conversaciones.filter(i => 
      i.usuario_id === usuarioId && i.cuenta === cuenta
    );
  }
  
  async getTodasLasInteracciones() {
    return this.data.conversaciones;
  }
  
  // ============================================
  // ANÁLISIS (para IA3)
  // ============================================
  async guardarAnalisisPost(analisis) {
    this.data.analisis_posts.push({
      ...analisis,
      _id: Date.now().toString()
    });
    this.guardar();
    return analisis;
  }
  
  async guardarPatronGanador(patron) {
    this.data.patrones_ia3.push({
      ...patron,
      _id: Date.now().toString(),
      timestamp: new Date().toISOString()
    });
    this.guardar();
    return patron;
  }
  
  // ============================================
  // IA1 E IA2 (retroalimentación)
  // ============================================
  async guardarIA1Config(cuenta, config) {
    this.data.mejoras_ia1.push({
      cuenta,
      config,
      timestamp: new Date().toISOString()
    });
    this.guardar();
    return config;
  }
  
  async guardarIA2Mejoras(cuenta, mejoras) {
    this.data.mejoras_ia2.push({
      cuenta,
      mejoras,
      timestamp: new Date().toISOString()
    });
    this.guardar();
    return mejoras;
  }
  
  async getIA1Config(cuenta) {
    const mejoras = this.data.mejoras_ia1.filter(m => m.cuenta === cuenta);
    return mejoras[mejoras.length - 1]?.config || null;
  }
  
  async getIA2Mejoras(cuenta) {
    return this.data.mejoras_ia2.filter(m => m.cuenta === cuenta);
  }
  
  // ============================================
  // IA3 AUTOMÁTICO
  // ============================================
  async analizarNuevosCompradores() {
    try {
      const IA3 = require('./sovyxIA3Analyzer');
      const ia3 = new IA3();
      
      if (this.data.compradores.length > 0) {
        const patron = await ia3.retroalimentarConCompradores(
          this.data.compradores,
          'sovyx'
        );
        
        await this.guardarPatronGanador(patron);
        sovyxLogger.success('🤖 IA3: Retroalimentación automática completada', {
          compradores: this.data.compradores.length
        });
      }
    } catch (error) {
      sovyxLogger.error('Error en IA3 automático', { error: error.message });
    }
  }
  
  // ============================================
  // UTILIDADES
  // ============================================
  async getFormulaGanadora() {
    return this.data.patrones_ia3[this.data.patrones_ia3.length - 1] || null;
  }
  
  async guardarFormulaGanadora(formula) {
    return this.guardarPatronGanador(formula);
  }
  
  async getDashboardCliente(clienteId) {
    const cliente = await this.getCliente(clienteId);
    return {
      cliente: cliente?.nombre || 'Cliente',
      estado: cliente?.estado || 'activo',
      metricas: {
        postsActivos: this.data.posts.filter(p => p.cuenta === clienteId).length,
        alcanceDiario: '13,500 - 27,000',
        conversiones: this.data.conversaciones.filter(i => i.cuenta === clienteId && i.etapa === 'calificado').length
      },
      formulaAsignada: this.getFormulaGanadora()
    };
  }
}

module.exports = new SOVYXDatabase();
