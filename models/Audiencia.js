const mongoose = require('mongoose');

const AudienciaSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  fileUrl: { type: String, required: true },
  fileName: { type: String },
  segmentacion: { type: Object, default: {} }, // Aquí se guardan los clusters/segmentos generados por la IA1
  metaCampaignId: { type: String, default: null },
  estado: { 
    type: String, 
    enum: ['PENDIENTE_CONFIRMACION', 'CAMPAÑA_ACTIVADA', 'ERROR'], 
    default: 'PENDIENTE_CONFIRMACION' 
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Audiencia', AudienciaSchema);
