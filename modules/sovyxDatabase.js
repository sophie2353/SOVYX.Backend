// modules/sovyxDatabase.js
const sovyxLogger = require('./sovyxLogger');

class SOVYXDatabase {
  constructor() {
    this.data = {
      posts: [],
      clientes: [],
      compradores: [],
      conversaciones: [],
      formulas: null
    };
  }
  
  async guardarPost(post) {
    this.data.posts.push({ ...post, _id: Date.now().toString() });
    sovyxLogger.info('Post guardado', { id: post.id });
    return post;
  }
  
  async getPost(postId) {
    return this.data.posts.find(p => p.id === postId || p._id === postId);
  }
  
  async getPostsCiclo(cicloId) {
    return this.data.posts.filter(p => p.cicloId === cicloId);
  }
  
  async guardarCliente(cliente) {
    this.data.clientes.push({ ...cliente, _id: Date.now().toString() });
    return cliente;
  }
  
  async getCliente(clienteId) {
    return this.data.clientes.find(c => c.id === clienteId || c._id === clienteId);
  }
  
  async countClientes() {
    return this.data.clientes.filter(c => c.estado === 'activo').length;
  }
  
  async guardarComprador(comprador) {
    this.data.compradores.push({ ...comprador, _id: Date.now().toString() });
    return comprador;
  }
  
  async getCompradoresReales() {
    return this.data.compradores;
  }
  
  async guardarInteraccion(interaccion) {
    this.data.conversaciones.push({ ...interaccion, _id: Date.now().toString() });
    return interaccion;
  }
  
  async guardarFormulaGanadora(formula) {
    this.data.formulas = { ...formula, guardado: new Date().toISOString() };
    return formula;
  }
  
  async getFormulaGanadora() {
    return this.data.formulas;
  }
}

module.exports = new SOVYXDatabase();
