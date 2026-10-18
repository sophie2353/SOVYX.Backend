// models/ClientPush.js
const mongoose = require('mongoose');

const ClientPushSchema = new mongoose.Schema({
  // Identificador único con formato push_CLIENT-#01, push_CLIENT-#02, etc.
  pushId: { type: String, required: true, unique: true, index: true },
  clientId: { type: String, required: true, index: true },
  
  // Objeto de suscripción WebPush nativo del navegador
  pushSubscription: {
    endpoint: { type: String, required: true },
    expirationTime: { type: Date, default: null },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true }
    }
  },
  
  pushEnabled: { type: Boolean, default: true },
  lastNotificationSentAt: { type: Date, default: null },
  cycleType: { type: String, default: '72H' }, // 72H (3 días) o DAY7
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ClientPush', ClientPushSchema);
