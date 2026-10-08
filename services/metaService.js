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
  // 1. BÚSQUEDA DE CAMPAÑAS PREVIAS
  // =========================================================================

  async buscarBorrador(adAccountId, token, clientId = 'ADMIN') {
    const targetName = buildCampaignName(clientId);
    const cleanAccountId = adAccountId.replace(/^act_/, '');
    const url = `${GRAPH_BASE_URL}/act_${cleanAccountId}/campaigns?fields=id,name,status&access_token=${token}`;
    
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) throw new Error(`Meta API Error: ${data.error.message}`);
    
    return data.data?.find(c => c.name.trim().toUpperCase() === targetName.toUpperCase());
  },

  // =========================================================================
  // 2. SEGMENTACIÓN DE ALTO VALOR (AUDIENCIAS VALUE-BASED & LAL 1%)
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
        description: 'Semilla inyectada desde IA1 SODIE (Value-Based pura)',
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

    // Cifrar datos personales y conservar el VALUE numérico plano
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
        payload: {
          schema: schema,
          data: formattedData
        },
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
            geo_locations: {
              countries: [countryCode.toUpperCase()]
            }
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

    if (!countriesFound.length) {
      throw new Error('⚠️ No se detectaron códigos de país válidos (ej. VE, CO, MX) en la columna country.');
    }

    const seedAudienceId = await this.crearAudienciaSemillaConValor(
      adAccountId, 
      token, 
      `SODIE_Seed_Value_${Date.now()}`
    );

    await this.inyectarUsuariosSemilla(seedAudienceId, usersPayload, token);

    const lookalikeIds = [];
    for (const country of countriesFound) {
      try {
        const lalId = await this.crearLookalike1PorCiento(adAccountId, seedAudienceId, country, token);
        lookalikeIds.push(lalId);
      } catch (err) {
        console.error(`Error creando Lookalike 1% para país ${country}:`, err.message);
      }
    }

    if (!lookalikeIds.length) {
      throw new Error('No se pudo generar ningún Lookalike 1% en Meta Ads.');
    }

    return {
      custom_audiences: lookalikeIds.map(id => ({ id }))
    };
  },

  // =========================================================================
  // 3. CREACIÓN DE BORRADOR (PURCHASE / VENTAS)
  // =========================================================================

  async crearCampanaVentas({ 
    actId, 
    token, 
    pixelId, 
    clientId = 'ADMIN', 
    dailyBudget = 1000, 
    usersPayload 
  }) {
    const cleanAccountId = actId.replace(/^act_/, '');
    const campaignName = buildCampaignName(clientId);

    const campaignUrl = `${GRAPH_BASE_URL}/act_${cleanAccountId}/campaigns`;
    const campaignParams = new URLSearchParams({
      name: campaignName,
      objective: 'OUTCOME_SALES',
      status: 'PAUSED',
      special_ad_categories: '[]',
      access_token: token
    });

    const campaignRes = await fetch(campaignUrl, { method: 'POST', body: campaignParams });
    const campaignData = await campaignRes.json();
    if (campaignData.error) throw new Error(`Meta API Campaign Error: ${campaignData.error.message}`);
    const campaignId = campaignData.id;

    const lalTargeting = await this.procesarEInyectarLookalikes({
      adAccountId: cleanAccountId,
      token,
      usersPayload
    });

    const adSetUrl = `${GRAPH_BASE_URL}/act_${cleanAccountId}/adsets`;
    const adSetBody = {
      name: `${campaignName} - AdSet Sales Purchase (LAL 1% Value)`,
      campaign_id: campaignId,
      daily_budget: dailyBudget,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'VALUE',
      targeting: {
        custom_audiences: lalTargeting.custom_audiences
      },
      status: 'PAUSED',
      access_token: token
    };

    if (pixelId) {
      adSetBody.promoted_object = { 
        pixel_id: pixelId, 
        custom_event_type: 'PURCHASE'
      };
    }

    const adSetRes = await fetch(adSetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adSetBody)
    });
    
    const adSetData = await adSetRes.json();
    
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
  // 4. CICLO DE 24 HORAS & DESACTIVACIÓN
  // =========================================================================

  async pausarCampana(token, campaignId) {
    const res = await fetch(`${GRAPH_BASE_URL}/${campaignId}?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        status: 'PAUSED',
        access_token: token 
      })
    });
    return res.json();
  },

  async obtenerMetricas(token, campaignId) {
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
    usersPayload,
    dailyBudget = 1000,
    version = 'V3.5'
  }) {
    try {
      const cleanAccountId = adAccountId.replace(/^act_/, '');
      
      // 1. Desactivar campaña/borrador anterior si existía
      const borradorExistente = await this.buscarBorrador(cleanAccountId, token, clientId);
      if (borradorExistente) {
        await this.pausarCampana(token, borradorExistente.id);
      }

      // 2. Crear nuevo borrador en PAUSED con los datos frescos del Excel
      const nuevaCampana = await this.crearCampanaVentas({
        actId: cleanAccountId,
        token,
        pixelId,
        clientId,
        dailyBudget,
        usersPayload
      });

      // 3. Registrar el ID en storageService (asocia a DB/Memoria con TTL 24h)
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
        campaignName: nuevaCampana.campaignName,
        message: 'Borrador creado y registrado en storageService. Notificar a facebookRoutes para confirmacion.html.'
      };
    } catch (error) {
      console.error('Error en procesarCicloHora24 (MetaServices):', error);
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
