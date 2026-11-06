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

        // ⚡ ENCAPSULAMOS EN TRY-CATCH INTERNO: Si falla 1 cliente, el bucle sigue con los demás
        try {
          const targetAudienceId = customAudiencesPendientes[0].id;
          
          // 🚨 FIX V26.0: Solicitar upper_bound y delivery_status
          const url = `${GRAPH_BASE_URL}/${targetAudienceId}?fields=name,delivery_status,approximate_count_upper_bound&access_token=${activeToken}`;

          const res = await fetch(url);
          const data = await res.json();

          if (data.error) {
            console.error(`⚠️ Error consultando audiencia ${targetAudienceId} (${clientId}):`, data.error.message);
            continue;
          }

          // ⚡ Extraemos el alcance actualizado
          const alcanceAprox = data.approximate_count_upper_bound || 0;
          
          // ⚡ Verificamos si Meta ya lo marcó como "Listo para entrega" (Código 200)
          const isReady = data.delivery_status && data.delivery_status.code === 200;

          if (isReady || alcanceAprox > 1000) {
            console.log(`✨ [Radar 4H] ¡Audiencia de ${clientId} INDEXADA con éxito! Alcance est: ${alcanceAprox}`);

            // A) Notificar al cliente y/o Admin vía Push
            await this.enviarNotificacionPush({
              clientId,
              campaignId: campaignIdPendiente,
              alcance: alcanceAprox > 0 ? alcanceAprox : 'Generando...'
            });

            // B) Comunicar a campaignStorage que pase de PENDIENTE a LISTO_PARA_ACTIVAR
            await campaignStorage.marcarComoIndexada(clientId, campaignIdPendiente);
            console.log(`🔒 [Radar 4H] Campaña ${campaignIdPendiente} de [${clientId}] marcada como ACTIVA/LISTA en Storage.`);
          } else {
            console.log(`⏳ [Radar 4H] Audiencia de ${clientId} aún procesando en Meta. Se volverá a intentar en el próximo ciclo.`);
          }

        } catch (innerError) {
          console.error(`💥 Error de red procesando al cliente ${clientId}:`, innerError.message);
        }
      }
    } catch (err) {
      console.error('💥 Error crítico en el radar de 4 horas:', err.message);
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

 // iniciarCron4Horas() {
   // cron.schedule('0 */4 * * *', () => {
   //   this.ejecutarChequeo();
 //   });
 //   console.log(' [Cron Job] Radar de audiencias inactivas activo (Ejecución cada 4 horas).');
//  }
};

module.exports = audienceStatusService;
