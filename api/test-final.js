const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Ajusta estas rutas a donde tengas tus servicios realmente
const campaignStorage = require('../routes/campaignStorageService'); 
const audienceStatusService = require('../routes/audienceStatusService'); 

// Endpoint GET manual para disparar la prueba cuando tú quieras
router.get('/test-final', async (req, res) => {
  // Blindaje anti-error de conexión
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      error: 'MongoDB no está conectado todavía. Espera unos segundos e intenta recargar.'
    });
  }

  try {
    console.log('🔄 [TEST GET] Consultando estado de campañas inactivas...');
    
    const pendientes = await campaignStorage.obtenerCampanasInactivas();

    if (!pendientes || pendientes.length === 0) {
      return res.json({
        success: true,
        mensaje: 'No hay campañas en estado "PENDIENTE". Lanza un borrador nuevo para probar.',
        totalPendientes: 0
      });
    }

    let detalleCampanas = [];
    pendientes.forEach((campana, index) => {
      detalleCampanas.push({
        id: index + 1,
        clientId: campana.clientId,
        campaignIdMeta: campana.campaignIdPendiente,
        audienciasInyectadas: campana.customAudiencesPendientes?.length || 0
      });
    });

    // Opcional: Ejecutar simulación del radar de 4h si quieres forzarlo en el GET
    console.log('⏰ [TEST GET] Ejecutando chequeo del radar de audiencias...');
    await audienceStatusService.ejecutarChequeo();

    return res.json({
      success: true,
      mensaje: 'Test de orquestación ejecutado con éxito vía GET.',
      totalPendientes: pendientes.length,
      campanas: detalleCampanas
    });

  } catch (error) {
    console.error('💥 Error crítico durante el test GET:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
