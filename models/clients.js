const mongoose = require('mongoose');

const ClientSchema = new mongoose.Schema({
  clientId: { type: String, required: true, unique: true, index: true }, // 👈 ASEGÚRATE DE QUE ESTE CAMPO EXISTA
  sessionId: { type: String },
  meta: {
    act_id: { type: String },
    pixel_id: { type: String },
    admin_token: { type: String },
    lastCampaignId: { type: String },
    version: { type: String },
    campaignExpiresAt: { type: Date },
    status: { type: String, default: 'PENDING' },
    configuredAt: { type: Date }
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Client', ClientSchema);
