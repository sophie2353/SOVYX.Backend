const mongoose = require('mongoose');

const AudienciaSchema = new mongoose.Schema({
  clientId: { type: String, required: true }, // 👈 Quitamos el index: true automático para que no colisione al arrancar
  sessionId: { type: String, required: true },
  
  // Archivos
  fileUrl: { type: String }, 
  fileName: { type: String },
  
  // Datos de Configuración Automática
  nombreDataset: { type: String },
  parametrosConfig: { type: Object, default: {} },
  
  // Segmentación generada por IA o Automática
  segmentacion: { type: Object, default: {} }, 
  
  // Control de estado general
  estado: { type: String, default: 'PENDIENTE_CONFIRMACION' }, 
  
  // =========================================================
  // ⚡ CAMPOS PARA EL RADAR Y ORQUESTACIÓN META V3.5
  // =========================================================
  metaCampaignId: { type: String, default: null },
  campaignIdPendiente: { type: String, default: null },
  customAudiencesPendientes: { type: Array, default: [] },
  estadoIndexacion: { type: String, default: null },
  tokenUsado: { type: String, default: null },
  indexadoEn: { type: Date, default: null },
  
  // Objeto anidado meta
  meta: { type: Object, default: {} },

  createdAt: { type: Date, default: Date.now }
}, 
{
  timestamps: true,
  strict: false,       // 🚨 Salavavidas activo
  autoIndex: false     // 🛑 Evita que Mongoose intente reconstruir índices en caliente y tire errores raros
});

module.exports = mongoose.model('Audiencia', AudienciaSchema);
