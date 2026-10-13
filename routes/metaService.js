// routes/metaService.js
const crypto = require('crypto');
const campaignStorage = require('./campaignStorageService');

const GRAPH_VERSION = 'v26.0';
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

/**
 * Cifrado obligatorio SHA-256 para Meta Graph API
 */
function hashData(value) {
  if (!value || typeof value !== 'string') return null;
  const clean = value.trim().toLowerCase();
  if (!clean) return null;
  return crypto.createHash('sha256').update(clean).digest('hex');
}

/**
 * Nombre estandarizado de campaña: PRUEBA - SODIE - {CLIENT_ID}
 */
function buildCampaignName(clientId = 'ADMIN') {
  const cleanId = String(clientId).trim().toUpperCase();
  return `PRUEBA - SODIE - ${cleanId}`;
}

const metaService = {
  // =========================================================================
  // 1. BUSCAR BORRADORES EXISTENTES
  // =========================================================================
  async buscarBorrador(adAccountId, token, clientId = 'ADMIN') {
    if (!adAccountId) return null;
    const targetName = buildCampaignName(clientId);
    const cleanAccountId = adAccountId.replace(/^act_/, '');
    const url = `${GRAPH_BASE_URL}/act_${cleanAccountId}/campaigns?fields=id,name,status&access_token=${token}`;
    
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) throw new Error(`Meta API Error: ${data.error.message}`);
    
    return data.data?.find(c => c.name.trim().toUpperCase() === targetName.toUpperCase());
  },

  // =========================================================================
  // 2. CREACIÓN DE AUDIENCIA SEMILLA Y LOOKALIKES (RETENIDOS O GENERADOS)
  // =========================================================================
  async crearAudienciaSemillaConValor(adAccountId, token, name) {
    const cleanAccountId = adAccountId.replace(/^act_/, '');
    const url = `${GRAPH_BASE_URL}/act_${cleanAccountId}/customaudiences`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        subtype: 'CUSTOM',
        description: 'Semilla inyectada desde IA1 SODIE (Value-Based)',
        customer_file_source: 'USER_PROVIDED_ONLY',
        is_value_based: true,
        access_token: token
      })
    });
    
    const data = await res.json();
    if (data.error) throw new Error(`Meta API Error (Custom Audience): ${data.error.message}`);
    return data.id;
  },

  async inyectarUsuariosSemilla(audienceId, usersPayload, token) {
    const url = `${GRAPH_BASE_URL}/${audienceId}/users`;
    const schema = ['EMAIL', 'PHONE', 'FN', 'LN', 'COUNTRY', 'VALUE'];

    const formattedData = usersPayload.map(u => [
      hashData(u.email),
      hashData(u.phone),
      hashData(u.firstName || u.first_name),
      hashData(u.lastName || u.last_name),
      hashData(u.country),
      typeof u.value === 'number' ? u.value : parseFloat(u.value || 0)
    ]).filter(row => row[0] || row[1]);

    if (!formattedData.length) {
      throw new Error('⚠️ No se encontraron registros válidos con email o teléfono en el Excel subido.');
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payload: { schema, data: formattedData },
        access_token: token
      })
    });

    const data = await res.json();
    if (data.error) throw new Error(`Meta API Error (User Ingestion): ${data.error.message}`);
    return data;
  },

  async crearLookalike1PorCiento(adAccountId, seedAudienceId, countryCode, token) {
    const cleanAccountId = adAccountId.replace(/^act_/, '');
    const url = `${GRAPH_BASE_URL}/act_${cleanAccountId}/customaudiences`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `LAL 1% ${countryCode.toUpperCase()} - SODIE Value-Based`,
        subtype: 'LOOKALIKE',
        origin_audience_id: seedAudienceId,
        lookalike_spec: JSON.stringify({
          type: 'value_driven',
          ratio: 0.01,
          location_spec: {
            geo_locations: { countries: [countryCode.toUpperCase()] }
          }
        }),
        access_token: token
      })
    });

    const data = await res.json();
    if (data.error) throw new Error(`Meta API Error (Lookalike ${countryCode}): ${data.error.message}`);
    return data.id;
  },

  async procesarEInyectarLookalikes({ adAccountId, token, usersPayload }) {
    if (!usersPayload || !usersPayload.length) {
      throw new Error('⚠️ No hay registros en el Excel para procesar segmentación.');
    }

    const countriesFound = [...new Set(
      usersPayload
        .map(u => (u.country || '').trim().toUpperCase())
        .filter(c => c.length === 2)
    )];

    if (!countriesFound.length) countriesFound.push('US');

    // 1. Crear Audiencia Semilla
    const seedAudienceId = await this.crearAudienciaSemillaConValor(
      adAccountId, 
      token, 
      `SODIE_Seed_Value_${Date.now()}`
    );

    // 2. Inyectar registros cifrados SHA-256
    await this.inyectarUsuariosSemilla(seedAudienceId, usersPayload, token);

    // 3. Generar Lookalikes 1% por cada país detectado
    const lookalikeIds = [];
    for (const country of countriesFound) {
      try {
        const lalId = await this.crearLookalike1PorCiento(adAccountId, seedAudienceId, country, token);
        lookalikeIds.push(lalId);
      } catch (err) {
        console.error(`Error creando Lookalike 1% para país ${country}:`, err.message);
      }
    }

    return {
      custom_audiences: lookalikeIds.length > 0 
        ? lookalikeIds.map(id => ({ id })) 
        : [{ id: seedAudienceId }]
    };
  },

  // =========================================================================
  // 3. CREACIÓN DE CAMPAÑA + ADSET (RECIBE LAL DE RETENCIÓN + ACT_ID + PIXEL)
  // =========================================================================
  async crearCampanaVentas({ 
    actId, 
    token, 
    pixelId, 
    clientId = 'ADMIN', 
    dailyBudget = 1000, 
    customAudiences = [] 
  }) {
    if (!actId) {
      throw new Error('⚠️ Imposible crear campaña: Falta el actId de la cuenta publicitaria.');
    }

    const cleanAccountId = actId.replace(/^act_/, '');
    const campaignName = buildCampaignName(clientId);

    // 1. Crear Campaña (JSON Limpio - evita Error #200 e Invalid Parameter)
    const campaignUrl = `${GRAPH_BASE_URL}/act_${cleanAccountId}/campaigns`;
    const campaignRes = await fetch(campaignUrl, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: campaignName,
        objective: 'OUTCOME_SALES',
        status: 'PAUSED',
        special_ad_categories: [], // Array vacío explícito
        access_token: token
      })
    });

    const campaignData = await campaignRes.json();
    if (campaignData.error) throw new Error(`Meta API Campaign Error: ${campaignData.error.message}`);
    const campaignId = campaignData.id;

    // 2. Crear AdSet e inyectar la segmentación/Lookalikes retenidos
    const adSetUrl = `${GRAPH_BASE_URL}/act_${cleanAccountId}/adsets`;
    const adSetBody = {
      name: `${campaignName} - AdSet Sales Purchase (LAL 1% Value)`,
      campaign_id: campaignId,
      daily_budget: dailyBudget,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'VALUE',
      targeting: { custom_audiences: customAudiences },
      status: 'PAUSED',
      access_token: token
    };

    if (pixelId) {
      adSetBody.promoted_object = { pixel_id: pixelId, custom_event_type: 'PURCHASE' };
    }

    const adSetRes = await fetch(adSetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adSetBody)
    });
    
    const adSetData = await adSetRes.json();
    
    // Fallback si la cuenta aún no reúne volumen para 'VALUE'
    if (adSetData.error && adSetData.error.message.includes('VALUE')) {
      adSetBody.optimization_goal = 'OFFSITE_CONVERSIONS';
      const fallbackRes = await fetch(adSetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adSetBody)
      });
      const fallbackData = await fallbackRes.json();
      adSetData.id = fallbackData.id;
    }

    return {
      success: true,
      act_id: cleanAccountId,
      campaignId,
      adSetId: adSetData.id || null,
      status: 'PAUSED',
      campaignName
    };
  },

  // =========================================================================
  // 4. CICLO DE 24 HORAS & ORQUESTACIÓN DE LALs
  // =========================================================================
  async pausarCampana(token, campaignId) {
    if (!campaignId) return null;
    const res = await fetch(`${GRAPH_BASE_URL}/${campaignId}?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAUSED', access_token: token })
    });
    return res.json();
  },

  async obtenerMetricas(token, campaignId) {
    if (!campaignId) return {};
    const url = `${GRAPH_BASE_URL}/${campaignId}/insights?fields=impressions,clicks,cpc,ctr,spend,reach,action_values,actions&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.data?.[0] || {};
  },

  async procesarCicloHora24({ 
    clientId = 'CLIENT-#01', 
    token, 
    adAccountId, 
    pixelId,
    usersPayload = null,
    customAudiences = [],
    dailyBudget = 1000,
    version = 'V3.5'
  }) {
    try {
      if (!adAccountId) {
        throw new Error('⚠️ [MetaServices] Se requiere un adAccountId válido para ejecutar la inyección en Meta.');
      }

      const cleanAccountId = adAccountId.replace(/^act_/, '');

      // 1. Si no nos pasan customAudiences ya retenidas pero viene un usersPayload nuevo, las procesamos al vuelo
      let finalAudiences = customAudiences;
      if ((!finalAudiences || finalAudiences.length === 0) && usersPayload && usersPayload.length > 0) {
        console.log('🔄 [MetaServices] Procesando Audiencia Semilla + Lookalikes al vuelo...');
        const generatedLal = await this.procesarEInyectarLookalikes({
          adAccountId: cleanAccountId,
          token,
          usersPayload
        });
        finalAudiences = generatedLal.custom_audiences;
      }

      // 2. Desactivar o pausar borrador anterior
      const borradorExistente = await this.buscarBorrador(cleanAccountId, token, clientId);
      if (borradorExistente) {
        await this.pausarCampana(token, borradorExistente.id);
      }

      // 3. Inyectar audiencias retenidas + ActID + Pixel para armar borrador
      const nuevaCampana = await this.crearCampanaVentas({
        actId: cleanAccountId,
        token,
        pixelId,
        clientId,
        dailyBudget,
        customAudiences: finalAudiences
      });

      // 4. Guardar ID de campaña en storage con TTL de 24 horas
      const isAdmin = String(clientId).toUpperCase().includes('ADMIN') || clientId === 'CLIENT-#00';
      await campaignStorage.registrarCampaignId({
        clientId,
        campaignId: nuevaCampana.campaignId,
        version,
        isAdmin
      });

      return { 
        success: true, 
        act_id: cleanAccountId,
        campaignId: nuevaCampana.campaignId, 
        status: 'PAUSED',
        campaignName: nuevaCampana.campaignName
      };
    } catch (error) {
      console.error('💥 Error en procesarCicloHora24 (MetaServices):', error);
      throw error;
    }
  },

  async verificarEstadoCampana(token, campaignId) {
    if (!campaignId) return false;
    const url = `${GRAPH_BASE_URL}/${campaignId}?fields=status,name&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) throw new Error(`Meta API Error: ${data.error.message}`);
    return data.status === 'ACTIVE';
  }
};

module.exports = metaService;
