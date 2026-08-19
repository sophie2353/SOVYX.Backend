// models/campaignLog.js
const mongoose = require('mongoose');

const CampaignLogSchema = new mongoose.Schema({
  // Identificador devuelto por la API de Meta Ads
  metaCampaignId: {
    type: String,
    required: true,
    unique: true
  },

  // Segmentación calculada por IA1 / Estadísticas
  initialTargeting: {
    country: { type: String, required: true },
    niche: { type: String, required: true },
    ageRange: {
      min: { type: Number, default: 18 },
      max: { type: Number, default: 65 }
    },
    totalProcessed: { type: Number, default: 0 }
  },

  // Estado del flujo
  status: {
    type: String,
    enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED'],
    default: 'DRAFT'
  },

  // Métricas reales de la campaña (Se actualizan post-lanzamiento)
  metrics: {
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    cpa: { type: Number, default: 0 },
    ctr: { type: Number, default: 0 }
  },

  // Feedback y correcciones generadas por IA3 para el siguiente ciclo
  ai3Corrections: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('CampaignLog', CampaignLogSchema);
