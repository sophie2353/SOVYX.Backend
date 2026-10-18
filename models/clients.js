const mongoose = require('mongoose');

const ClientSchema = new mongoose.Schema({
  clientId: { type: String, required: true, unique: true, index: true },
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
  // 👈 NUEVO: Suscripción WebPush nativa vinculada al clientId
  pushSubscription: {
    endpoint: { type: String },
    expirationTime: { type: Date, default: null },
    keys: {
      p256dh: { type: String },
      auth: { type: String }
    }
  },
  pushEnabled: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Client', ClientSchema);
