const mongoose = require('mongoose');

const AudienciaSchema = new mongoose.Schema({
  clientId: { type: String, required: true, index: true }, 
  sessionId: { type: String, required: true },
  
  // Archivos
  fileUrl: { type: String }, // Le quitamos el required por si automatizamos sin archivos
  fileName: { type: String },
  
  // Datos de Configuración Automática (Desde tu panel V3.5)
  nombreDataset: { type: String },
  parametrosConfig: { type: Object, default: {} },
  
  // Segmentación generada por IA o Automática
  segmentacion: { type: Object, default: {} }, 
  
  // Control de estado general (Le quitamos el ENUM para que no te bloquee estados nuevos)
  estado: { type: String, default: 'PENDIENTE_CONFIRMACION' }, 
  
  // =========================================================
  // ⚡ NUEVOS CAMPOS PARA EL RADAR Y ORQUESTACIÓN META V3.5
  // =========================================================
  metaCampaignId: { type: String, default: null }, // Mantenemos el legacy por si acaso
  campaignIdPendiente: { type: String, default: null },
  customAudiencesPendientes: { type: Array, default: [] },
  estadoIndexacion: { type: String, default: null },
  tokenUsado: { type: String, default: null },
  indexadoEn: { type: Date, default: null },
  
  // Objeto anidado meta (Para expiración, versión y estatus)
  meta: { type: Object, default: {} },

  createdAt: { type: Date, default: Date.now }
}, 
{
  timestamps: true, // Agrega updatedAt automáticamente
  strict: false     // 🚨 EL SALVAVIDAS: Permite inyectar campos dinámicos sin que Mongoose los borre
});

module.exports = mongoose.model('Audiencia', AudienciaSchema);
