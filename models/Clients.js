const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true }, // ID del cliente
  nombre: String,
  email: String,
  // Agrupamos los datos de Meta dentro de un solo objeto sub-documento
  meta: {
    act_id: { type: String, default: null },
    pixel_id: { type: String, default: null },
    fb_token: { type: String, default: null },
    account_name: { type: String, default: null },
    updatedAt: { type: Date, default: Date.now }
  }
}, { timestamps: true });

module.exports = mongoose.model('Client', clientSchema);
