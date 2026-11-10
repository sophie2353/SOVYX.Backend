const crypto = require('crypto');

const GRAPH_VERSION = 'v26.0';
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

function hashData(value) {
  if (!value || typeof value !== 'string') return null;
  const clean = value.trim().toLowerCase();
  if (!clean) return null;
  return crypto.createHash('sha256').update(clean).digest('hex');
}

/**
 * Nombre estandarizado de campaña: NOMBRE - {CLIENT_ID}
 */
function buildCampaignName(clientId = 'ADMIN') {
  const cleanId = String(clientId).trim().toUpperCase();
  return ` NOMBRE- ${cleanId}`;
}

async crearCampanaVentas({ 
    actId, 
    token, 
    pixelId, 
    clientId = 'ADMIN', 
    dailyBudget = 3300, 
    customAudiences = [],
    minAge = 22, 
    maxAge = 55, 
    websiteUrl = 'https://sitiowebaelegir.com'
  }) {
    const creds = getMetaCredentials({ token, clientId, pixelId, adAccountId: actId });

    if (!creds.adAccountId) {
      throw new Error(`⚠️ Imposible crear campaña para ${clientId}: Falta el adAccountId de la cuenta publicitaria.`);
    }

    const campaignName = buildCampaignName(clientId);
    
    // BLINDAJE DE PRESUPUESTO: Si viene menor a 100 se asumen dólares y se pasa a centavos (3300 = $33.00)
    const rawBudget = dailyBudget !== undefined ? Number(dailyBudget) : 3300;
    const finalDailyBudget = rawBudget < 100 ? rawBudget * 100 : rawBudget; 

    console.log(`📊 [Engine] Configurando campaña para [${clientId}] con presupuesto diario total de: $${finalDailyBudget / 100} USD`);

    // ---------------------------------------------------------
    // 1. CREAR CAMPAÑA
    // ---------------------------------------------------------
    const campaignUrl = `${GRAPH_BASE_URL}/act_${creds.adAccountId}/campaigns`;
    const campaignRes = await fetch(campaignUrl, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: campaignName,
        objective: 'OUTCOME_SALES',
        status: 'PAUSED',
        is_adset_budget_sharing_enabled: false, 
        special_ad_categories: ['NONE'],
        access_token: creds.token
      })
    });

    const campaignData = await campaignRes.json();
    if (campaignData.error) throw new Error(`Meta API Campaign Error: ${campaignData.error.message}`);
    const campaignId = campaignData.id;
// ---------------------------------------------------------
    // 3. SUBIR IMAGEN DESDE INTERNET
    // ---------------------------------------------------------
    const imgRes = await fetch('https://placehold.co/1080x1080/1a1a1a/34d399/png?text=Borrador+IMAGEN+EJEMPLO');
    const imageBuffer = await imgRes.arrayBuffer();
    const imgBlob = new Blob([imageBuffer], { type: 'image/png' });
    
    const form = new FormData();
    form.append('filename', imgBlob, 'dsl_placeholder.png');
    form.append('access_token', creds.token);

    const uploadUrl = `${GRAPH_BASE_URL}/act_${creds.adAccountId}/adimages`;
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      body: form
    });

    const uploadData = await uploadRes.json();
    if (uploadData.error) throw new Error(`Meta API Error subiendo imagen: ${uploadData.error.message}`);
    
    const imageHash = uploadData.images['sodie_placeholder.png'].hash;

    // ---------------------------------------------------------
    // 4, 5 y 6. CICLO POR CADA PAÍS (CON ADVANTAGE+ AUDIENCE HABILITADO)
    // ---------------------------------------------------------
    const targets = (customAudiences && customAudiences.length > 0) 
      ? customAudiences 
      : [{ country: 'US', id: null }];

    const budgetPerAdSet = Math.floor(finalDailyBudget / targets.length);
    const createdAdSets = [];
    const createdAds = [];

         for (const target of targets) {
      const countryCode = target.country || 'US';
      const adSetUrl = `${GRAPH_BASE_URL}/act_${creds.adAccountId}/adsets`;
      
      // Segmentación ESTRICTA: Tu panel manda, no Meta.
      let targetingData = {
        geo_locations: { countries: [countryCode] }, 
        age_min: parseInt(minAge, 10) || 22, 
        age_max: parseInt(maxAge, 10) || 55, 
        publisher_platforms: ['facebook', 'instagram'],
        targeting_automation: { advantage_audience: 0 } 
      };

      // Si hay Lookalike, se inyecta (ejemplo lookalike abajo)
      if (target.id && String(target.id).trim() !== '') {
        targetingData.custom_audiences = [{ id: String(target.id).trim() }];
      }

      const adSetBody = {
        name: `${campaignName} - AdSet LAL 1% Estricto (${countryCode})`,
        campaign_id: campaignId,
        daily_budget: budgetPerAdSet,
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'OFFSITE_CONVERSIONS',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        targeting: targetingData,
        status: 'PAUSED',
        access_token: creds.token
      };

      if (creds.pixelId) {
        adSetBody.promoted_object = { pixel_id: creds.pixelId, custom_event_type: 'PURCHASE' };
      }

      let adSetRes = await fetch(adSetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adSetBody)
      });
      let adSetData = await adSetRes.json();

      // ⚡ Fallback automático limpio por si la audiencia custom da error
      if (adSetData.error) {
        console.warn(`⚠️ [Engine] Falló AdSet con Lookalike para ${countryCode} (${adSetData.error.message}). Aplicando fallback a geo abierto...`);
        
        delete adSetBody.targeting.custom_audiences;
        adSetBody.name = `${campaignName} - AdSet Geo Open (${countryCode})`;

        const retryRes = await fetch(adSetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(adSetBody)
        });
        adSetData = await retryRes.json();

        if (adSetData.error) {
          console.error('💥 ERROR CRUDO DE META:', JSON.stringify(adSetData.error, null, 2));
          throw new Error(`Meta API AdSet Error Definitivo (${countryCode}): ${adSetData.error.message}`);
        } else {
          console.log(`✅ [Engine] Recuperación exitosa para ${countryCode} mediante fallback automático.`);
        }
      }

      createdAdSets.push(adSetData.id);

      // -- CREATIVE --
      const creativeUrl = `${GRAPH_BASE_URL}/act_${creds.adAccountId}/adcreatives`;
      const objectStorySpec = {
        page_id: pageId,
        link_data: {
          image_hash: imageHash,
          link: websiteUrl,
          message: `Ecosistema (nombre definido) - Automatización de pautas publicitarias de alto rendimiento. Actualiza tus datos correspondientes`,
          call_to_action: { type: 'LEARN_MORE', value: { link: websiteUrl } }
        }
      };

      const creativeRes = await fetch(creativeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Creative - SODIE - ${countryCode}`,
          object_story_spec: objectStorySpec,
          access_token: creds.token
        })
      });
      const creativeData = await creativeRes.json();
      if (creativeData.error) throw new Error(`Meta API Creative Error (${countryCode}): ${creativeData.error.message}`);

      // -- AD --
      const adUrl = `${GRAPH_BASE_URL}/act_${creds.adAccountId}/ads`;
      const adRes = await fetch(adUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Borrador SODIE - ${countryCode}`,
          adset_id: adSetData.id,
          creative: { creative_id: creativeData.id },
          status: 'PAUSED',
          access_token: creds.token
        })
      });
      const adFinalData = await adRes.json();
      if (adFinalData.error) throw new Error(`Meta API Ad Error (${countryCode}): ${adFinalData.error.message}`);
      
      createdAds.push(adFinalData.id);
    }

    return {
      success: true,
      act_id: creds.adAccountId,
      pixel_id: creds.pixelId,
      campaignId,
      adSetIds: createdAdSets,
      adIds: createdAds,
      status: 'PAUSED',
      campaignName,
      daily_budget_usd: finalDailyBudget / 100,
      total_adsets: createdAdSets.length
    };
  },
const nuevaCampana = await this.crearCampanaVentas({
        actId: creds.adAccountId,
        token: creds.token,
        pixelId: creds.pixelId,
        clientId,
        dailyBudget,
        customAudiences: finalAudiences,
        minAge,      
        maxAge,      
        websiteUrl   
      });
