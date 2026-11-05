/**
 * Modelo de Temporizadores Independiente (models/clientTimer.js)
 */
const mongoose = require('mongoose');

const ClientTimerSchema = new mongoose.Schema({
  clientId: { type: String, required: true, unique: true, index: true },
  startTimeStamp: { type: Number, default: Date.now },
  durationSeconds: { type: Number, default: 345600 }, // 96 horas por defecto
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ClientTimer', ClientTimerSchema);
