const crypto = require('crypto');
const { sendSSEUpdate } = require('../routes/campaignRoutes');

const GRAPH_VERSION = 'v25.0';
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

/**
 * Helper para aplicar cifrado SHA-256 (Requisito obligatorio de Meta Graph API)
 */
function hashData(value) {
  if (!value || typeof value !== 'string') return null;
  const clean = value.trim().toLowerCase();
  if (!clean) return null;
  return crypto.createHash('sha256').update(clean).digest('hex');
}

const metaService = {
  // =========================================================================
  // BÚSQUEDA Y LECTURA
  // =========================================================================

  // Buscar borrador/campaña por nombre exacto ("Prueba Hora 24")
  async buscarBorrador(adAccountId, token, nombreBorrador = "Prueba Hora 24") {
    const cleanAccountId = adAccountId.replace(/^act_/, '');
    const url = `${GRAPH_BASE_URL}/act_${cleanAccountId}/campaigns?fields=id,name,status&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) throw new Error(`Meta API Error: ${data.error.message}`);
    
    return data.data?.find(c => c.name.trim().toLowerCase() === nombreBorrador.trim().toLowerCase());
  },

  // =========================================================================
  // CREACIÓN Y GESTIÓN DE AUDIENCIAS (VALUE-BASED & LOOKALIKES)
  // =========================================================================

  /**
   * Crear Audiencia Personalizada con soporte de Valor de Cliente (Customer Lifetime Value)
   */
  async crearAudienciaSemillaConValor(adAccountId, token, name) {
    const cleanAccountId = adAccountId.replace(/^act_/, '');
    const url = `${GRAPH_BASE_URL}/act_${cleanAccountId}/customaudiences`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        subtype: 'CUSTOM',
        description: 'Semilla inyectada desde IA1 SOVYX (Value-Based)',
        customer_file_source: 'USER_PROVIDED_ONLY',
        is_value_based: true, // 👈 Activa Value-Based Audience
        access_token: token
      })
    });
    
    const data = await res.json();
    if (data.error) throw new Error(`Meta API Error (Custom Audience): ${data.error.message}`);
    return data.id;
  },

  /**
   * Inyectar usuarios cifrados (SHA-256) + Campo VALUE (numérico sin hash)
   */
  async inyectarUsuariosSemilla(audienceId, usersPayload, token) {
    const url = `${GRAPH_BASE_URL}/${audienceId}/users`;
    const schema = ['EMAIL', 'PHONE', 'FN', 'LN', 'COUNTRY', 'VALUE'];

    const formattedData = usersPayload.map(u => [
      hashData(u.email),
      hashData(u.phone),
      hashData(u.firstName),
      hashData(u.lastName),
      hashData(u.country),
      typeof u.value === 'number' ? u.value : parseFloat(u.value || 0) // VALUE numérico plano
    ]).filter(row => row[0] || row[1]); // Debe poseer al menos email o teléfono

    if (!formattedData.length) {
      console.warn('⚠️ No se encontraron registros válidos para inyectar a la audiencia.');
      return null;
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

  /**
   * Generar Lookalike del 1% (ratio: 0.01) para un país específico priorizando valor
   */
  async crearLookalike1PorCiento(adAccountId, seedAudienceId, countryCode, token) {
    const cleanAccountId = adAccountId.replace(/^act_/, '');
    const url = `${GRAPH_BASE_URL}/act_${cleanAccountId}/customaudiences`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `LAL 1% ${countryCode.toUpperCase()} - SOVYX Value-Based`,
        subtype: 'LOOKALIKE',
        origin_audience_id: seedAudienceId,
        lookalike_spec: JSON.stringify({
          type: 'value_driven', // Prioriza usuarios de mayor valor
          ratio: 0.01,         // Precision 1%
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

  /**
   * Generar proceso completo de cifrado e inyección LAL por valor
   */
  async procesarEInyectarLookalikes({ adAccountId, token, usersPayload, countriesFound = ['US'] }) {
    if (!usersPayload || !usersPayload.length) {
      console.log('⚠️ No hay usersPayload disponible. Se omitirá creación de LAL.');
      return null;
    }

    console.log(`🚀 Cifrando datos e inyectando Semilla de Valor con ${usersPayload.length} registros...`);
    const seedAudienceId = await this.crearAudienciaSemillaConValor(
      adAccountId, 
      token, 
      `SOVYX_Seed_Value_${Date.now()}`
    );

    await this.inyectarUsuariosSemilla(seedAudienceId, usersPayload, token);

    console.log(`🎯 Generando Públicos Similares (LAL 1% Value-Driven) para: ${countriesFound.join(', ')}...`);
    const lookalikeIds = [];
    
    for (const country of countriesFound) {
      try {
        const lalId = await this.crearLookalike1PorCiento(adAccountId, seedAudienceId, country, token);
        lookalikeIds.push(lalId);
      } catch (err) {
        console.error(`❌ Error creando Lookalike para país ${country}:`, err.message);
      }
    }

    return {
      custom_audiences: lookalikeIds.map(id => ({ id }))
    };
  },

  // =========================================================================
  // CREACIÓN DE CAMPAÑA DE VENTAS EN SITIO WEB (DESDE CERO)
  // =========================================================================

  /**
   * Crea una campaña enfocada en Ventas (OUTCOME_SALES / Value Optimization)
   */
  async crearCampanaVentas({ actId, token, pixelId, name = "Prueba Hora 24", status = "PAUSED", dailyBudget = 1000, targeting, usersPayload, countriesFound }) {
    const cleanAccountId = actId.replace(/^act_/, '');

    // 1. Crear Campaña con objetivo OUTCOME_SALES (Ventas en sitio web)
    const campaignUrl = `${GRAPH_BASE_URL}/act_${cleanAccountId}/campaigns`;
    const campaignParams = new URLSearchParams({
      name,
      objective: 'OUTCOME_SALES', // 🎯 Objetivos de Ventas Directas
      status,
      special_ad_categories: '[]',
      access_token: token
    });

    const campaignRes = await fetch(campaignUrl, { method: 'POST', body: campaignParams });
    const campaignData = await campaignRes.json();
    if (campaignData.error) throw new Error(`Meta API Campaign Error: ${campaignData.error.message}`);
    const campaignId = campaignData.id;

    // 2. Procesar Audiencias Lookalike por Valor
    let targetingConfig = targeting || { geo_locations: { countries: countriesFound || ['US'] } };
    if (usersPayload && usersPayload.length > 0) {
      const lalTargeting = await this.procesarEInyectarLookalikes({
        adAccountId: cleanAccountId,
        token,
        usersPayload,
        countriesFound
      });
      if (lalTargeting) {
        targetingConfig = { ...targetingConfig, custom_audiences: lalTargeting.custom_audiences };
      }
    }

    // 3. Crear AdSet Optimizado para Conversión/Valor en Sitio Web
    const adSetUrl = `${GRAPH_BASE_URL}/act_${cleanAccountId}/adsets`;
    const adSetBody = {
      name: `${name} - AdSet Value Sales`,
      campaign_id: campaignId,
      daily_budget: dailyBudget,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'VALUE', // 👈 Optimización orientada a maximizar el valor de conversiones
      targeting: targetingConfig,
      status,
      access_token: token
    };

    if (pixelId) {
      adSetBody.promoted_object = { 
        pixel_id: pixelId, 
        custom_event_type: 'PURCHASE' // 🛒 Evento de compra en sitio web
      };
    }

    const adSetRes = await fetch(adSetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adSetBody)
    });
    
    const adSetData = await adSetRes.json();
    if (adSetData.error) {
      // Fallback a OFFSITE_CONVERSIONS si el ad account no tiene habilitado optimización por VALUE directa
      if (adSetData.error.message.includes('VALUE')) {
        adSetBody.optimization_goal = 'OFFSITE_CONVERSIONS';
        const fallbackRes = await fetch(adSetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(adSetBody)
        });
        const fallbackData = await fallbackRes.json();
        if (fallbackData.error) console.warn("Advertencia al crear AdSet (Fallback):", fallbackData.error.message);
        adSetData.id = fallbackData.id;
      } else {
        console.warn("Advertencia al crear AdSet:", adSetData.error.message);
      }
    }

    return {
      success: true,
      act_id: cleanAccountId,
      campaignId,
      adSetId: adSetData.id || null,
      status
    };
  },

  // =========================================================================
  // ACTIVACIÓN, PAUSA Y CICLO DE 24 HORAS
  // =========================================================================

  async inyectarSegmentacionYActivar(token, campaignId, dataSegmentacion, adAccountId, usersPayload, countriesFound) {
    const adSetUrl = `${GRAPH_BASE_URL}/${campaignId}/adsets?access_token=${token}`;
    const resSet = await fetch(adSetUrl);
    const dataSet = await resSet.json();
    const adSetId = dataSet.data?.[0]?.id;

    if (adSetId) {
      let targetingConfig = dataSegmentacion || {};

      if (usersPayload && usersPayload.length > 0 && adAccountId) {
        const lalTargeting = await this.procesarEInyectarLookalikes({
          adAccountId,
          token,
          usersPayload,
          countriesFound
        });

        if (lalTargeting) {
          targetingConfig = {
            ...targetingConfig,
            custom_audiences: lalTargeting.custom_audiences
          };
        }
      }

      await fetch(`${GRAPH_BASE_URL}/${adSetId}?access_token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          targeting: targetingConfig,
          access_token: token 
        })
      });
    }

    await fetch(`${GRAPH_BASE_URL}/${campaignId}?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        status: 'ACTIVE',
        access_token: token 
      })
    });
  },

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

  /**
   * Ciclo de 24 Horas: Pausa la campaña previa "Prueba Hora 24" o crea/activa la nueva desde cero
   */
  async procesarCicloHora24({ 
    sessionId, 
    token, 
    adAccountId, 
    pixelId,
    nombreBorrador = 'Prueba Hora 24', 
    dataSegmentacion,
    usersPayload,
    countriesFound,
    dailyBudget
  }) {
    try {
      const cleanAccountId = adAccountId.replace(/^act_/, '');
      const borradorExistente = await this.buscarBorrador(cleanAccountId, token, nombreBorrador);

      let campaignId;

      if (borradorExistente) {
        // Pausar si estaba activa para refrescar el ciclo
        await this.pausarCampana(token, borradorExistente.id);
        campaignId = borradorExistente.id;
        
        await this.inyectarSegmentacionYActivar(
          token, 
          campaignId, 
          dataSegmentacion, 
          cleanAccountId, 
          usersPayload, 
          countriesFound
        );
      } else {
        // Crear de 0 con objetivo Ventas + Lookalike por valor
        const nuevaCampana = await this.crearCampanaVentas({
          actId: cleanAccountId,
          token,
          pixelId,
          name: nombreBorrador,
          status: 'ACTIVE',
          dailyBudget,
          targeting: dataSegmentacion,
          usersPayload,
          countriesFound
        });
        campaignId = nuevaCampana.campaignId;
      }

      const rawMetrics = await this.obtenerMetricas(token, campaignId);
      
      const formattedMetrics = {
        visitors: parseInt(rawMetrics.clicks || 0),
        reach: parseInt(rawMetrics.reach || rawMetrics.impressions || 0),
        spend: `$${parseFloat(rawMetrics.spend || 0).toFixed(2)}`,
        conversions: rawMetrics.actions?.find(a => a.action_type === 'purchase')?.value || 0
      };

      if (typeof sendSSEUpdate === 'function') sendSSEUpdate(sessionId, formattedMetrics);

      return { 
        success: true, 
        act_id: cleanAccountId,
        campaignId, 
        status: 'ACTIVE', 
        metrics: formattedMetrics 
      };
    } catch (error) {
      console.error('Error en procesarCicloHora24:', error);
      throw error;
    }
  }
};

module.exports = metaService;
