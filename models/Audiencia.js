const mongoose = require('mongoose');

const AudienciaSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  fileUrl: { type: String, required: true },
  fileName: { type: String },
  segmentacion: { type: Object, default: {} }, // Clusters/segmentos generados por IA1
  metaCampaignId: { type: String, default: null },
  estado: { 
    type: String, 
    enum: [
      'PENDIENTE_CONFIRMACION', 
      'PROCESANDO_META', 
      'COMPLETADO_Y_ACTIVADO', 
      'CAMPAÑA_ACTIVADA', 
      'ERROR'
    ], 
    default: 'PENDIENTE_CONFIRMACION' 
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Audiencia', AudienciaSchema);
