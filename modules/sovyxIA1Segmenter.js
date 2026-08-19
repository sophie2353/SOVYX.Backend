// backend/controllers/campaignController.js
const config = require('../config/tokens');
const axios = require('axios');
const CampaignLog = require('../models/CampaignLog'); // Tu modelo de BD (MongoDB, Supabase, etc.)

async function handleProcessAndDraft(req, res) {
  try {
    const { rawData } = req.body;

    // 1. Procesamiento Estadístico
    const countries = rawData.map(d => d.country);
    const niches = rawData.map(d => d.niche);
    const ages = rawData.map(d => d.age);

    const topCountry = getMode(countries);
    const topNiche = getMode(niches);
    const avgAge = getAverageAge(ages);

    const aggregatedSegment = {
      country: topCountry,
      niche: topNiche,
      ageRange: { min: Math.max(18, avgAge - 5), max: Math.min(65, avgAge + 5) },
      totalProcessed: rawData.length
    };

    // 2. Creación del Borrador en Meta Ads
    const { accessToken, adAccountId } = config.meta; 
    const metaResponse = await axios.post(
      `https://graph.facebook.com/v25.0/act_${adAccountId}/campaigns`,
      {
        name: `SOVYX Draft - ${topNiche} (${topCountry})`,
        objective: 'OUTCOME_LEADS',
        status: 'PAUSED',
        special_ad_categories: ['NONE'],
        access_token: accessToken
      }
    );

    const campaignId = metaResponse.data.id;

    // 3. REGISTRO EN BD PARA LA IA3 (EL CAMBIO CLAVE)
    await CampaignLog.create({
      metaCampaignId: campaignId,
      initialTargeting: aggregatedSegment,
      status: 'DRAFT',
      createdAt: new Date()
    });

    return res.status(200).json({
      success: true,
      message: 'Borrador en Meta y registro para IA3 guardado correctamente.',
      campaignId,
      segmentation: aggregatedSegment
    });

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Error interno en el controlador' });
  }
}
