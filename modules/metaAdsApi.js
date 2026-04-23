// modules/metaAdsApi.js
const axios = require('axios');
const sovyxLogger = require('./sovyxLogger');
const config = require('../config/tokens');

class MetaAdsApi {
  constructor() {
    this.baseUrl = config.facebook.baseUrl || 'https://graph.facebook.com/v25.0';
    this.accessToken = config.facebook.token; // Tu Token Largo de 60 días
    this.adAccountId = config.facebook.adAccountId;
  }

  // ============================================
  // REPORTE DE VENTAS (EL DISPARADOR DE ROI) 💰
  // ============================================
  async reportarConversionVenta(usuarioId, monto = 5000) {
    try {
      sovyxLogger.info(`MetaAPI: Reportando venta de $${monto} para el usuario ${usuarioId}`);

      // Enviamos el evento de "Purchase" (Compra) a Meta
      const response = await axios.post(`${this.baseUrl}/${this.adAccountId}/events`, {
        data: [{
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          action_source: "system",
          user_data: {
            // Meta usa el ID de Instagram para vincular al comprador
            external_id: [usuarioId] 
          },
          custom_data: {
            value: monto,
            currency: "USD",
            content_name: "SOVYX High Ticket Slot"
          }
        }],
        access_token: this.accessToken
      });

      sovyxLogger.success(`✅ MetaAPI: Conversión reportada. El algoritmo ahora buscará gente como ${usuarioId}`);
      return response.data;
    } catch (error) {
      sovyxLogger.error('MetaAPI: Error al reportar conversión', error.response?.data || error.message);
      // No lanzamos error para no romper el flujo del chat si Meta falla
      return null;
    }
  }

  async lanzarCampanaSovyx(segmentacionIA1, creativeId) {
    try {
      sovyxLogger.info(`MetaAPI: Intentando lanzar campaña - Modo: ${segmentacionIA1.status}`);

      const adSetResponse = await axios.post(`${this.baseUrl}/${this.adAccountId}/adsets`, {
        name: segmentacionIA1.name,
        optimization_goal: segmentacionIA1.optimization_goal,
        billing_event: segmentacionIA1.billing_event,
        bid_amount: 100,
        daily_budget: 800,
        campaign_id: config.campaignId,
        targeting: JSON.stringify(segmentacionIA1.targeting),
        status: segmentacionIA1.status,
        access_token: this.accessToken
      });

      const adSetId = adSetResponse.data.id;
      sovyxLogger.info(`MetaAPI: AdSet creado con éxito. ID: ${adSetId}`);

      return adSetId;
    } catch (error) {
      sovyxLogger.error('MetaAPI: Error al lanzar en Meta', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = new MetaAdsApi();
