const mongoose = require ('mongoose')

// Dentro de tu Schema de Client en models/clients.js
timers: {
  startTimeStamp: { type: Number, default: Date.now },
  durationSeconds: { type: Number, default: 345600 } // 96 horas o 72 horas por defecto
}

module.export = client-timer.js
