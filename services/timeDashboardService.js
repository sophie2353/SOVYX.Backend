/**
 * SODIE - Servicio de Temporizadores en la Nube (services/timeDashboardService.js)
 */
const Client = require('../models/clients');

const timeDashboardService = {
  async obtenerOTier(clientId) {
    const cleanId = String(clientId || 'ADMIN').trim().toUpperCase();
    let clientDoc = await Client.findOne({ clientId: cleanId });

    const now = Date.now();

    if (!clientDoc || !clientDoc.timers?.startTimeStamp) {
      await Client.findOneAndUpdate(
        { clientId: cleanId },
        { 
          $set: { 
            clientId: cleanId,
            'timers.startTimeStamp': now,
            'timers.durationSeconds': 96 * 3600 // 96 horas de maduración técnica
          } 
        },
        { upsert: true, new: true }
      );
      
      return { startTimeStamp: now, durationSeconds: 96 * 3600 };
    }

    return {
      startTimeStamp: clientDoc.timers.startTimeStamp,
      durationSeconds: clientDoc.timers.durationSeconds || (96 * 3600)
    };
  },

  async reiniciarTimer(clientId) {
    const cleanId = String(clientId || 'ADMIN').trim().toUpperCase();
    const now = Date.now();
    
    await Client.findOneAndUpdate(
      { clientId: cleanId },
      { $set: { 'timers.startTimeStamp': now } },
      { upsert: true }
    );

    return { success: true, startTimeStamp: now };
  }
};

module.exports = timeDashboardService;
