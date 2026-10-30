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

/**
 * Helper para resolver credenciales: Soporta ADMIN y clientes dinámicos de CLIENT-#01 al #10+
 */
function getMetaCredentials({ token, clientId = 'ADMIN', pixelId = null, adAccountId = null }) {
  const cleanClientId = String(clientId).trim().toUpperCase();
  const isAdmin = cleanClientId.includes('ADMIN') || cleanClientId === 'CLIENT-#00' || !cleanClientId;

  const finalToken = token || process.env.ADMIN_TOKEN || process.env.META_ACCESS_TOKEN || process.env.META_SYSTEM_TOKEN;

  const finalPixelId = isAdmin 
    ? (pixelId || process.env.META_PIXEL_ID) 
    : (pixelId || null);

  const rawAccountId = isAdmin 
    ? (adAccountId || process.env.META_AD_ACCOUNT_ID) 
    : adAccountId;
    
  const finalAdAccountId = rawAccountId ? String(rawAccountId).replace(/^act_/, '').trim() : null;

  return {
    token: finalToken,
    pixelId: finalPixelId,
    adAccountId: finalAdAccountId,
    isAdmin
  };
}

/**
 * Helper interno para parsear e interceptar el Error #100 de Meta LTV
 */
function formatMetaError(dataError) {
  const code = dataError.code;
  const msg = dataError.message || '';
  const userMsg = dataError.error_user_msg || '';

  if (code === 100 && (msg.includes('Customer Value') || userMsg.includes('value') || msg.includes('value'))) {
    return {
      isLtvError: true,
      errorCode: 'VALUE_TERMS_REQUIRED',
      message: 'La cuenta publicitaria no ha activado los Términos de Valor de Cliente (LTV) en Meta.',
      instructions: 'Debes activar la segmentación por Value subiendo una lista de prueba CSV en el panel de tu cuenta publicitaria, marcar "Sí incluye valor de cliente", aceptar los términos de Meta e intentar nuevamente.'
    };
  }

  return {
    isLtvError: false,
    message: `Meta API Error [Code ${code}]: ${msg}`
  };
}

const metaService = {
  // =========================================================================
  // 1. BUSCAR BORRADORES EXISTENTES
  // =========================================================================
  async buscarBorrador(adAccountId, token, clientId = 'ADMIN') {
    const creds = getMetaCredentials({ token, clientId, adAccountId });
    if (!creds.adAccountId) return null;
    
    const targetName = buildCampaignName(clientId);
    const url = `${GRAPH_BASE_URL}/act_${creds.adAccountId}/campaigns?fields=id,name,status&access_token=${creds.token}`;
    
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) throw new Error(`Meta API Error: ${data.error.message}`);
    
    return data.data?.find(c => c.name.trim().toUpperCase() === targetName.toUpperCase());
  },

  // =========================================================================
  // 2. CREACIÓN DE AUDIENCIA SEMILLA Y LOOKALIKES (RETENIDOS O GENERADOS)
  // =========================================================================
  async crearAudienciaSemillaConValor(adAccountId, token, name, clientId = 'ADMIN') {
    const creds = getMetaCredentials({ token, clientId, adAccountId });
    if (!creds.adAccountId) throw new Error('⚠️ Falta el adAccountId para crear audiencia semilla.');

    const url = `${GRAPH_BASE_URL}/act_${creds.adAccountId}/customaudiences`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        subtype: 'CUSTOM',
        description: 'Semilla inyectada desde SODIE (Value-Based)',
        customer_file_source: 'USER_PROVIDED_ONLY',
        is_value_based: true,
        access_token: creds.token
      })
    });
    
    const data = await res.json();
    if (data.error) {
      const parsedErr = formatMetaError(data.error);
      if (parsedErr.isLtvError) {
        const err = new Error(parsedErr.message);
        err.errorCode = parsedErr.errorCode;
        err.instructions = parsedErr.instructions;
        throw err;
      }
      throw new Error(parsedErr.message);
    }
    return data.id;
  },

  async inyectarUsuariosSemilla(audienceId, usersPayload, token) {
    const activeToken = token || process.env.ADMIN_TOKEN || process.env.META_ACCESS_TOKEN;
    const url = `${GRAPH_BASE_URL}/${audienceId}/users`;
    
    const schema = ['EMAIL', 'PHONE', 'FN', 'LN', 'COUNTRY', 'LOOKALIKE_VALUE'];

    const formattedData = usersPayload.map(u => {
      const country = (u.country || u.pais || 'US').toString().trim().toUpperCase();
      const rawValue = u.value !== undefined ? u.value : (u.valor !== undefined ? u.valor : 1000);
      const valueNum = typeof rawValue === 'number' ? rawValue : parseFloat(rawValue || 1000);
      
      const emailSimulado = u.email || `lead_${country.toLowerCase()}_${Date.now()}@sodie-leads.com`;
      const phoneSimulado = u.phone || `+1555${Math.floor(100000 + Math.random() * 900000)}`;
      const fnSimulado = u.firstName || u.nombre || 'Customer';
      const lnSimulado = u.lastName || u.apellido || 'Target';

      return [
        hashData(emailSimulado),
        hashData(phoneSimulado),
        hashData(fnSimulado),
        hashData(lnSimulado),
        country,
        valueNum > 0 ? valueNum : 10000 
      ];
    }).filter(row => row[0] && row[1]);

    if (!formattedData.length) {
      throw new Error('⚠️ No se encontraron registros válidos para la inyección de valor.');
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payload: { schema, data: formattedData },
        access_token: activeToken
      })
    });

    const data = await res.json();
    if (data.error) {
      const parsedErr = formatMetaError(data.error);
      if (parsedErr.isLtvError) {
        const err = new Error(parsedErr.message);
        err.errorCode = parsedErr.errorCode;
        err.instructions = parsedErr.instructions;
        throw err;
      }
      throw new Error(parsedErr.message);
    }
    return data;
  },

  async crearLookalike1PorCiento(adAccountId, seedAudienceId, countryCode, token, clientId = 'ADMIN') {
    const creds = getMetaCredentials({ token, clientId, adAccountId });
    const url = `${GRAPH_BASE_URL}/act_${creds.adAccountId}/customaudiences`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `LAL 1% ${countryCode.toUpperCase()} - SODIE Value-Based`,
        subtype: 'LOOKALIKE',
        origin_audience_id: seedAudienceId,
        lookalike_spec: JSON.stringify({
          ratio: 0.01,
          location_spec: {
            geo_locations: { countries: [countryCode.toUpperCase()] }
          }
        }),
        access_token: creds.token
      })
    });

    const data = await res.json();
    if (data.error) throw new Error(`Meta API Error (Lookalike ${countryCode}): ${data.error.message}`);
    return data.id;
  },

  async procesarEInyectarLookalikes({ adAccountId, token, usersPayload, clientId = 'ADMIN' }) {
    if (!usersPayload || !usersPayload.length) {
      throw new Error('⚠️ No hay registros de usuarios para procesar segmentación.');
    }

    const creds = getMetaCredentials({ token, clientId, adAccountId });

    const countriesFound = [...new Set(
      usersPayload
        .map(u => (u.country || u.pais || '').trim().toUpperCase())
        .filter(c => c.length === 2)
    )];

    if (!countriesFound.length) countriesFound.push('US');

    const seedAudienceId = await this.crearAudienciaSemillaConValor(
      creds.adAccountId, 
      creds.token, 
      `SODIE_Seed_Value_${Date.now()}`,
      clientId
    );

    await this.inyectarUsuariosSemilla(seedAudienceId, usersPayload, creds.token);

    const lookalikeIds = [];
    for (const country of countriesFound) {
      try {
        const lalId = await this.crearLookalike1PorCiento(creds.adAccountId, seedAudienceId, country, creds.token, clientId);
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
  // 3. CREACIÓN DE CAMPAÑA + ADSET (Soporta ADMIN y CLIENT-#01 al #10+)
  // =========================================================================
  async crearCampanaVentas({ 
    actId, 
    token, 
    pixelId, 
    clientId = 'ADMIN', 
    dailyBudget, 
    customAudiences = [],
    minAge = 25, 
    maxAge = 65, 
    websiteUrl = 'https://sodie.app'
  }) {
    const creds = getMetaCredentials({ token, clientId, pixelId, adAccountId: actId });

    if (!creds.adAccountId) {
      throw new Error(`⚠️ Imposible crear campaña para ${clientId}: Falta el adAccountId de la cuenta publicitaria.`);
    }

    const campaignName = buildCampaignName(clientId);
    const rawBudget = dailyBudget !== undefined ? dailyBudget : (clientId === 'ADMIN' ? 1000 : 3900);
    const finalDailyBudget = rawBudget < 100 ? rawBudget * 100 : rawBudget; 

    console.log(`📊 [SODIE Engine] Configurando campaña para [${clientId}] con presupuesto diario de: $${finalDailyBudget / 100} USD`);

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
    // 2. EXTRAER PAGE ID E INSTAGRAM ID (A prueba de balas)
    // ---------------------------------------------------------
    const accountDetailsUrl = `${GRAPH_BASE_URL}/act_${creds.adAccountId}?fields=promote_pages{id,instagram_business_account},pixels{id}&access_token=${creds.token}`;
    const accountRes = await fetch(accountDetailsUrl);
    const accountData = await accountRes.json();
    
    let pageId = null;
    let instagramId = null;
    let finalPixelId = null; // A este nivel solo sacamos la page y el ig, el pixel se pasa via creds
    
    if (accountData.promote_pages && accountData.promote_pages.data.length > 0) {
      pageId = accountData.promote_pages.data[0].id;
      instagramId = accountData.promote_pages.data[0].instagram_business_account?.id || null;
    }

    if (!pageId) {
      console.warn(`⚠️ [SODIE Engine] La cuenta ${creds.adAccountId} no devolvió promote_pages. Usando página matriz de respaldo.`);
      pageId = process.env.META_PAGE_ID || ''; 
    }

    // ---------------------------------------------------------
    // 3. SUBIR IMAGEN DESDE INTERNET (LA SOLUCIÓN NUCLEAR)
    // ---------------------------------------------------------
    console.log(`[SODIE] Obteniendo imagen comodín directamente de la nube...`);
    
    const imgRes = await fetch('https://placehold.co/1080x1080/1a1a1a/34d399/png?text=Borrador+SODIE');
    const imageBuffer = await imgRes.arrayBuffer();
    const imgBlob = new Blob([imageBuffer], { type: 'image/png' });
    
    const form = new FormData();
    form.append('filename', imgBlob, 'sodie_placeholder.png');
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
    // 4. CREAR AD SET (Conjunto de Anuncios)
    // ---------------------------------------------------------
    const formattedAudiences = (customAudiences || []).map(aud => {
      if (typeof aud === 'string') return { id: aud };
      if (aud && aud.id) return { id: aud.id };
      return null;
    }).filter(Boolean);

    const adSetUrl = `${GRAPH_BASE_URL}/act_${creds.adAccountId}/adsets`;
    
    // Cumplimos el requisito de Meta. Tu Lookalike filtrará el tráfico real.
    const targetingData = {
      geo_locations: { countries: ['US', 'VE', 'ES', 'MX', 'CO', 'AR', 'CL', 'PE'] }, 
      age_min: parseInt(minAge, 10) || 18, 
      age_max: parseInt(maxAge, 10) || 65
    };

    if (formattedAudiences.length > 0) {
      targetingData.custom_audiences = formattedAudiences;
    }

    const adSetBody = {
      name: `${campaignName} - AdSet (LAL 1% Value)`,
      campaign_id: campaignId,
      daily_budget: finalDailyBudget,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'OFFSITE_CONVERSIONS',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting: targetingData,
      status: 'PAUSED',
      // PARCHE EUROPEO: Obligatorio para evitar el error 100 de la captura
      dsa_beneficiary: "SODIE Client", 
      dsa_payor: "SODIE Client",
      access_token: creds.token
    };

    if (creds.pixelId) {
      adSetBody.promoted_object = { pixel_id: creds.pixelId, custom_event_type: 'PURCHASE' };
    }

    const adSetRes = await fetch(adSetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adSetBody)
    });
    
    const adSetData = await adSetRes.json();
    if (adSetData.error) {
      console.error("💥 [DEBUG ADSET] Error de Meta:", JSON.stringify(adSetData.error, null, 2));
      console.error("💥 [DEBUG ADSET] Payload enviado:", JSON.stringify(adSetBody, null, 2));
      throw new Error(`Meta API AdSet Error: ${adSetData.error.message}`);
    }

    // ---------------------------------------------------------
    // 5. CREAR AD CREATIVE (DISEÑO BASE)
    // ---------------------------------------------------------
    const creativeUrl = `${GRAPH_BASE_URL}/act_${creds.adAccountId}/adcreatives`;
    
    const objectStorySpec = {
      page_id: pageId,
      link_data: {
        image_hash: imageHash,
        link: websiteUrl,
        message: 'Tu anuncio va aquí. Selecciona "Usar publicación existente" en la configuración y modifica instagram / pagina de facebook.',
        call_to_action: {
          type: 'LEARN_MORE',
          value: { link: websiteUrl }
        }
      }
    };

    if (instagramId) {
      objectStorySpec.instagram_actor_id = instagramId;
    }

    const creativeBody = {
      name: 'Creative - SODIE',
      object_story_spec: objectStorySpec,
      access_token: creds.token
    };

    const creativeRes = await fetch(creativeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creativeBody)
    });
    
    const creativeData = await creativeRes.json();
    if (creativeData.error) {
      console.error("💥 [DEBUG CREATIVE] Error de Meta:", JSON.stringify(creativeData.error, null, 2));
      console.error("💥 [DEBUG CREATIVE] Payload enviado:", JSON.stringify(creativeBody, null, 2));
      throw new Error(`Meta API Creative Error: ${creativeData.error.message}`);
    }

    // ---------------------------------------------------------
    // 6. CREAR AD (ANUNCIO FINAL EN EL BORRADOR)
    // ---------------------------------------------------------
    const adUrl = `${GRAPH_BASE_URL}/act_${creds.adAccountId}/ads`;
    
    const adBody = {
      name: 'Anuncio Borrador SODIE',
      adset_id: adSetData.id,
      creative: { creative_id: creativeData.id },
      status: 'PAUSED',
      access_token: creds.token
    };

    const adRes = await fetch(adUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adBody)
    });

    const adFinalData = await adRes.json();
    if (adFinalData.error) {
      console.error("💥 [DEBUG AD] Error de Meta:", JSON.stringify(adFinalData.error, null, 2));
      console.error("💥 [DEBUG AD] Payload enviado:", JSON.stringify(adBody, null, 2));
      throw new Error(`Meta API Ad Error: ${adFinalData.error.message}`);
    }

    return {
      success: true,
      act_id: creds.adAccountId,
      pixel_id: creds.pixelId,
      campaignId,
      adSetId: adSetData.id,
      adId: adFinalData.id,
      status: 'PAUSED',
      campaignName,
      daily_budget_usd: finalDailyBudget / 100
    };
  },
  
  // =========================================================================
  // 4. CICLO DE 72 HORAS & ORQUESTACIÓN DE LALs
  // =========================================================================
  async pausarCampana(token, campaignId) {
    if (!campaignId) return null;
    const activeToken = token || process.env.ADMIN_TOKEN || process.env.META_ACCESS_TOKEN;
    const res = await fetch(`${GRAPH_BASE_URL}/${campaignId}?access_token=${activeToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAUSED', access_token: activeToken })
    });
    return res.json();
  },

  async obtenerMetricas(token, campaignId) {
    if (!campaignId) return {};
    const activeToken = token || process.env.ADMIN_TOKEN || process.env.META_ACCESS_TOKEN;
    const url = `${GRAPH_BASE_URL}/${campaignId}/insights?fields=impressions,clicks,cpc,ctr,spend,reach,action_values,actions&access_token=${activeToken}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.data?.[0] || {};
  },

  async procesarCicloHora72({ 
    clientId = 'CLIENT-#01', 
    token, 
    adAccountId, 
    pixelId,
    usersPayload = null,
    customAudiences = [],
    dailyBudget = 1000,
    version = 'V3.5',
    minAge,      
    maxAge,      
    websiteUrl   
  }) {    
    try {
      const creds = getMetaCredentials({ token, clientId, pixelId, adAccountId });

      if (!creds.adAccountId) {
        throw new Error(`⚠️ [MetaServices] Se requiere un adAccountId válido para ejecutar la inyección en Meta para ${clientId}.`);
      }

      let finalAudiences = customAudiences;
      if ((!finalAudiences || finalAudiences.length === 0) && usersPayload && usersPayload.length > 0) {
        console.log(`🔄 [MetaServices] Procesando Audiencia Semilla + Lookalikes al vuelo para ${clientId}...`);
        const generatedLal = await this.procesarEInyectarLookalikes({
          adAccountId: creds.adAccountId,
          token: creds.token,
          usersPayload,
          clientId
        });
        finalAudiences = generatedLal.custom_audiences;
      }

      const borradorExistente = await this.buscarBorrador(creds.adAccountId, creds.token, clientId);
      if (borradorExistente) {
        await this.pausarCampana(creds.token, borradorExistente.id);
      }

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

      await campaignStorage.registrarCampaignId({
        clientId,
        campaignId: nuevaCampana.campaignId,
        version,
        isAdmin: creds.isAdmin,
        ttlHours: 72
      });

      return { 
        success: true, 
        act_id: creds.adAccountId,
        pixel_id: creds.pixelId,
        campaignId: nuevaCampana.campaignId, 
        status: 'PAUSED',
        campaignName: nuevaCampana.campaignName,
        cycleHours: 72
      };
    } catch (error) {
      console.error('💥 Error en procesarCicloHora72 (MetaServices):', error);
      throw error;
    }
  },

  async procesarCicloHora24(params) {
    return this.procesarCicloHora72(params);
  },

  async verificarEstadoCampana(token, campaignId) {
    if (!campaignId) return false;
    const activeToken = token || process.env.ADMIN_TOKEN || process.env.META_ACCESS_TOKEN;
    const url = `${GRAPH_BASE_URL}/${campaignId}?fields=status,name&access_token=${activeToken}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) throw new Error(`Meta API Error: ${data.error.message}`);
    return data.status === 'ACTIVE';
  }
};

module.exports = metaService;
