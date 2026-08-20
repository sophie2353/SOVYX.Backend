const cron = require('node-cron');
const sovyxDatabase = require('../services/sovyxDatabase');
const metaService = require('../services/metaService');

// Se ejecuta cada hora en punto
cron.schedule('0 * * * *', async () => {
  console.log('⏰ Revisando ciclos de automatización de SOVYX...');
  try {
    const clientes = await sovyxDatabase.obtenerClientesActivos();
    const ahora = new Date();

    for (const cliente of clientes) {
      const horasTranscurridas = (ahora - new Date(cliente.ciclo.fechaInicio)) / (1000 * 60 * 60);

      // Transición a las 24 Horas: Lanza el segundo borrador
      if (cliente.ciclo.estado === 'HORA_1_24_ACTIVA' && horasTranscurridas >= 24) {
        await metaService.pausarCampana(cliente.meta.accessToken, cliente.ciclo.campaignId1);
        const metricas = await metaService.obtenerMetricas(cliente.meta.accessToken, cliente.ciclo.campaignId1);

        const borrador2 = await metaService.buscarBorrador(
          cliente.meta.adAccountId, 
          cliente.meta.accessToken, 
          "Prueba Hora 24-48"
        );

        if (borrador2) {
          const targetOptimizado = { /* Segmentación corregida por IA3 */ };
          await metaService.inyectarSegmentacionYActivar(cliente.meta.accessToken, borrador2.id, targetOptimizado);

          await sovyxDatabase.actualizarEstadoCiclo(cliente.email, 'HORA_24_48_ACTIVA', {
            'ciclo.campaignId2': borrador2.id,
            'ciclo.metricas24h': metricas
          });
        }
      }

      // Transición a las 48 Horas: Cierre de ciclo
      if (cliente.ciclo.estado === 'HORA_24_48_ACTIVA' && horasTranscurridas >= 48) {
        await metaService.pausarCampana(cliente.meta.accessToken, cliente.ciclo.campaignId2);
        await sovyxDatabase.actualizarEstadoCiclo(cliente.email, 'FINALIZADO');
      }
    }
  } catch (err) {
    console.error('Error en cronjob SOVYX:', err.message);
  }
});
