/**
 * SODIE - Radar de Verificación de Audiencias (Cada 4 Horas)
 */
const cron = require('node-cron');
const campaignStorage = require('./campaignStorageService');
const webpush = require('web-push');

const GRAPH_VERSION = 'v26.0';
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

const audienceStatusService = {
  
  async ejecutarChequeo() {
    console.log('⏰ [Radar 4H] Solicitando campañas inactivas a campaignStorage...');

    try {
      // 1. SOLICITAR SOLO LAS CAMPAÑAS INACTIVAS/PENDIENTES
      const pendientes = await campaignStorage.obtenerCampanasInactivas();

      if (!pendientes || pendientes.length === 0) {
        console.log('💤 [Radar 4H] Cero campañas inactivas. No se realizarán llamadas a Meta API.');
        return;
      }

      console.log(`📌 [Radar 4H] Procesando ${pendientes.length} campaña(s) inactiva(s)...`);
      const adminToken = process.env.ADMIN_TOKEN || process.env.META_ACCESS_TOKEN;

      for (const item of pendientes) {
        const { clientId, campaignIdPendiente, customAudiencesPendientes, tokenUsado } = item;
        const activeToken = tokenUsado || adminToken;

        if (!customAudiencesPendientes || customAudiencesPendientes.length === 0) continue;

        // Tomamos la primera audiencia de la lista
        const targetAudienceId = customAudiencesPendientes[0].id;
        const url = `${GRAPH_BASE_URL}/${targetAudienceId}?fields=name,operation_status,approximate_count&access_token=${activeToken}`;

        const res = await fetch(url);
        const data = await res.json();

        if (data.error) {
          console.error(`⚠️ Error consultando audiencia ${targetAudienceId} (${clientId}):`, data.error.message);
          continue;
        }

        const alcanceAprox = data.approximate_count || 0;
        const operationCode = data.operation_status?.code;

        // 2. SI YA TIENE ALCANCE O ESTÁ PROCESADA POR META:
        if (alcanceAprox > 0 || (operationCode && operationCode !== 1)) {
          console.log(`✨ [Radar 4H] ¡Audiencia de ${clientId} INDEXADA con éxito! Alcance: ${alcanceAprox}`);

          // A) Notificar al cliente y/o Admin vía Push
          await this.enviarNotificacionPush({
            clientId,
            campaignId: campaignIdPendiente,
            alcance: alcanceAprox
          });

          // B) Comunicar a campaignStorage que pase de PENDIENTE a LISTO_PARA_ACTIVAR
          // (Al cambiar el estado, la próxima consulta de las 4 horas YA NO la traerá)
          await campaignStorage.marcarComoIndexada(clientId, campaignIdPendiente);
          console.log(`🔒 [Radar 4H] Campaña ${campaignIdPendiente} de [${clientId}] marcada como ACTIVA/LISTA en Storage.`);
        }
      }
    } catch (err) {
      console.error('💥 Error en el radar de 4 horas:', err.message);
    }
  },

  async enviarNotificacionPush({ clientId, campaignId, alcance }) {
    console.log(`🔔 [PUSH DISPARADA] Cliente: ${clientId} | Campaña: ${campaignId} | Alcance indexado: ${alcance}`);
    
    const payload = JSON.stringify({
      title: '🚀 ¡Audiencia SODIE Lista!',
      body: `La audiencia de tu campaña [${clientId}] ha sido indexada con éxito por Meta (${alcance} usuarios). Ya puedes activarla.`,
      icon: '/assets/icon-sodie.png',
      data: { clientId, campaignId }
    });

    // Enviar por VAPID webpush...
  },

  // Programar el Cron Job exactamente CADA 4 HORAS ('0 */4 * * *')
  iniciarCron4Horas() {
    cron.schedule('0 */4 * * *', () => {
      audienceStatusService.ejecutarChequeo();
    });
    console.log('⏰ [Cron Job] Radar de audiencias inactivas activo (Ejecución cada 4 horas).');
  }
};

module.exports = audienceStatusService;
