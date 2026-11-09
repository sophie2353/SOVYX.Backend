/**
 * SODIE - Radar de Verificación de Audiencias (Cada 4 Horas)
 */
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

          // 🚨 CONSULTA EXTENDIDA: Incluye operation_status y objeto delivery_status completo
const url = `${GRAPH_BASE_URL}/${targetAudienceId}?fields=name,delivery_status,operation_status,approximate_count_lower_bound,approximate_count_upper_bound&access_token=${activeToken}`;

const res = await fetch(url);
const data = await res.json();

if (data.error) {
  console.error(`⚠️ Error Meta Graph API (${clientId}):`, JSON.stringify(data.error, null, 2));
} else {
  const alcanceAprox = data.approximate_count_upper_bound || 0;
  const isReady = data.delivery_status && data.delivery_status.code === 200;

  // LOG DETALLADO DE DIAGNÓSTICO
  console.log(`🔍 [DIAGNÓSTICO COMPLETO - ${clientId}]`);
  console.log(`   └─ Delivery Status:`, JSON.stringify(data.delivery_status));
  console.log(`   └─ Operation Status:`, JSON.stringify(data.operation_status));
  console.log(`   └─ Alcance Est.: ${alcanceAprox} usuarios`);

  if (isReady || alcanceAprox > 1000) {
    await this.enviarNotificacionPush({
      clientId,
      campaignId: campaignIdPendiente,
      alcance: alcanceAprox > 0 ? alcanceAprox : 'Generando...'
    });
    await campaignStorage.marcarComoIndexada(clientId, campaignIdPendiente);
  } else {
    // Si sigue en revisión, guardamos o imprimimos la razón que da Meta
    const razonMeta = data.delivery_status?.description || 'En proceso de igualación de datos';
    console.log(`⏳ [Radar 4H] Estado: "${razonMeta}". Reintento en el próximo ciclo.`);
  }
}
        } catch (innerError) {
          console.error(`💥 Error de red procesando al cliente ${clientId}:`, innerError.message);
        }

        // =====================================================================
        // ⚡ THROTTLING (EL FRENO DE MANO) - AHORA SÍ DENTRO DEL BUCLE FOR
        // =====================================================================
        // Si hay más campañas en la lista, obligamos al servidor a esperar 
        // 30 segundos exactos antes de consultar al siguiente cliente.
        console.log(`⏳ [Radar Throttling] Pausando 30 segundos antes de consultar la siguiente campaña...`);
        await new Promise(resolve => setTimeout(resolve, 30000));
        
      } // <-- AQUÍ CIERRA EL BUCLE FOR (Después de la pausa)

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
  }
};

module.exports = audienceStatusService;
