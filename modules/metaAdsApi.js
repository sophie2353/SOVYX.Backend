const axios = require('axios');
const sovyxLogger = require('./sovyxLogger');
const config = require('../config/tokens');

class MetaAdsApi {
  constructor() {
    this.baseUrl = 'https://graph.facebook.com/v25.0';
    this.accessToken = config.metaAccessToken;
    this.adAccountId = config.adAccountId;
  }

  async lanzarCampanaSovyx(segmentacionIA1, creativeId) {
    try {
      sovyxLogger.info(`MetaAPI: Intentando lanzar campaña - Modo: ${segmentacionIA1.status}`);

  
      const adSetResponse = await axios.post(`${this.baseUrl}/${this.adAccountId}/adsets`, {
        name: segmentacionIA1.name,
        optimization_goal: segmentacionIA1.optimization_goal,
        billing_event: segmentacionIA1.billing_event,
        bid_amount: 100,
        daily_budget: 1500, 
        campaign_id: config.campaignId,
        targeting: JSON.stringify(segmentacionIA1.targeting),
        status: segmentacionIA1.status,
        access_token: this.accessToken
      });

      const adSetId = adSetResponse.data.id;
      sovyxLogger.info(`MetaAPI: AdSet creado con éxito. ID: ${adSetId}`);

      return adSetId;
    } catch (error) {
      sovyxLogger.error('MetaAPI: Error al lanzar en Meta', error.response.data);
      throw error;
    }
  }
}

module.exports = new MetaAdsApi();
