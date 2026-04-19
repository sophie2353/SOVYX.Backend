// modules/sovyxDatabase.js
const fs = require('fs');
const path = require('path');
const sovyxLogger = require('./sovyxLogger');

const DATA_PATH = path.join(__dirname, '../data/sovyx_db.json');

class SOVYXDatabase {
  constructor() {
    this.data = this.cargar();
  }
  
  cargar() {
    try {
      if (!fs.existsSync(path.join(__dirname, '../data'))) {
        fs.mkdirSync(path.join(__dirname, '../data'));
      }
      if (fs.existsSync(DATA_PATH)) {
        const raw = fs.readFileSync(DATA_PATH, 'utf8');
        return JSON.parse(raw);
      }
    } catch (error) {
      sovyxLogger.error('Error cargando base de datos', { error: error.message });
    }
    
    return {
      posts: [],
      clientes: [], // Los 4 slots de SOVYX
      compradores_elite: [], // Perfiles del Formulario A y B
      conversaciones: [], // Historial de DMs
      patrones_ia3: [], // El "ADN" que optimiza SOEDITIA
      scripts_ganadores: [], // Respuestas que cerraron ventas
      mejoras_ia1: [],
      tokens: []
    };
  }
  
  guardar() {
    try {
      fs.writeFileSync(DATA_PATH, JSON.stringify(this.data, null, 2));
    } catch (error) {
      sovyxLogger.error('Error persistiendo datos', { error: error.message });
    }
  }

  // ============================================
  // GESTIÓN DE TOKENS (Para el Callback de 60 días)
  // ============================================
  async saveLongLivedToken(token) {
    this.data.tokens.push({
      token,
      timestamp: new Date().toISOString()
    });
    this.guardar();
    sovyxLogger.success('🔑 Token de 60 días persistido en DB');
  }

  // ============================================
  // CONVERSACIONES (El "Oído" de la IA3)
  // ============================================
  async guardarInteraccion(interaccion) {
    this.data.conversaciones.push({
      ...interaccion,
      timestamp: new Date().toISOString()
    });
    this.guardar();
  }

  async getHistorialConversacion(usuarioId) {
    return this.data.conversaciones.filter(i => 
      i.usuario_id === usuarioId || i.instagram_user === usuarioId
    );
  }

  // ============================================
  // COMPRADORES Y FORMULARIOS (ADN de Élite)
  // ============================================
  async guardarPerfilCompradorElite(perfil) {
    this.data.compradores_elite.push({
      ...perfil,
      _id: Date.now().toString()
    });
    this.guardar();
    sovyxLogger.info('🧬 IA3: Perfil de comprador guardado para análisis de escala');
  }

  async guardarScriptGanador(cuenta, script) {
    this.data.scripts_ganadores.push({
      cuenta,
      ...script
    });
    this.guardar();
    sovyxLogger.success('✍️ IA3: Script de cierre exitoso registrado');
  }

  // ============================================
  // POSTS Y MÉTRICAS
  // ============================================
  async guardarPost(post) {
    this.data.posts.push({ ...post, _id: Date.now().toString() });
    this.guardar();
  }

  async getPost(postId) {
    return this.data.posts.find(p => p.id === postId || p._id === postId);
  }

  async getInteraccionesPorPost(postId) {
    return this.data.conversaciones.filter(i => i.postId === postId);
  }

  // ============================================
  // OPTIMIZACIÓN IA1 & IA2
  // ============================================
  async guardarPatronGanador(patron) {
    this.data.patrones_ia3.push({
      ...patron,
      timestamp: new Date().toISOString()
    });
    this.guardar();
  }

  async guardarIA2Mejoras(cuenta, mejoras) {
    this.data.mejoras_ia2.push({
      cuenta,
      mejoras,
      timestamp: new Date().toISOString()
    });
    this.guardar();
  }

  // ============================================
  // CLIENTES (Los 4 Elegidos)
  // ============================================
  async countClientes() {
    return this.data.clientes.length;
  }

  async guardarCliente(cliente) {
    this.data.clientes.push({
      ...cliente,
      fecha_activacion: new Date().toISOString()
    });
    this.guardar();
  }
}

module.exports = new SOVYXDatabase();
