/**
 * SODIE - Servicio de Temporizadores en la Nube (services/timeDashboardService.js)
 */
const ClientTimer = require('../models/clientTimer');

const timeDashboardService = {
  async obtenerOTier(clientId) {
    const cleanId = String(clientId || 'ADMIN').trim().toUpperCase();
    let clientDoc = await ClientTimer.findOne({ clientId: cleanId });

    const now = Date.now();
    const defaultDuration = cleanId === 'ADMIN' ? (24 * 3600) : (96 * 3600);

    // Lee de la raíz del esquema (o de .timers por retrocompatibilidad)
    const savedStart = clientDoc?.startTimeStamp || clientDoc?.timers?.startTimeStamp;
    const savedDuration = clientDoc?.durationSeconds || clientDoc?.timers?.durationSeconds || defaultDuration;

    if (!clientDoc || !savedStart) {
      const updated = await ClientTimer.findOneAndUpdate(
        { clientId: cleanId },
        { 
          $set: { 
            clientId: cleanId,
            startTimeStamp: now,
            durationSeconds: defaultDuration,
            updatedAt: new Date()
          } 
        },
        { upsert: true, new: true }
      );
      
      return {
        clientId: cleanId,
        startTimeStamp: updated.startTimeStamp || now,
        durationSeconds: updated.durationSeconds || defaultDuration
      };
    }

    return {
      clientId: cleanId,
      startTimeStamp: savedStart,
      durationSeconds: savedDuration
    };
  },

  async reiniciarTimer(clientId) {
    const cleanId = String(clientId || 'ADMIN').trim().toUpperCase();
    const now = Date.now();
    const defaultDuration = cleanId === 'ADMIN' ? (24 * 3600) : (96 * 3600);
    
    await ClientTimer.findOneAndUpdate(
      { clientId: cleanId },
      { 
        $set: { 
          startTimeStamp: now,
          durationSeconds: defaultDuration,
          updatedAt: new Date()
        } 
      },
      { upsert: true, new: true }
    );

    return { success: true, clientId: cleanId, startTimeStamp: now, durationSeconds: defaultDuration };
  }
};

// Alias por seguridad si en algún punto se invoca como obtenerOTimer
timeDashboardService.obtenerOTimer = timeDashboardService.obtenerOTier;

module.exports = timeDashboardService;
