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
    status: { type: String, default: 'PENDIENTE' },
    configuredAt: { type: Date }
  }
  
  // Dentro de tu Schema de Client en models/clients.js
timers: {
  startTimeStamp: { type: Number, default: Date.now },
  durationSeconds: { type: Number, default: 345600 } // 96 horas o 72 horas por defecto
}

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
