// routes/metaService.js
const crypto = require('crypto');
const campaignStorage = require('./campaignStorageService');
const fs = require('fs/promises'); // Para leer la imagen local
const path = require('path');      

const GRAPH_VERSION = 'v26.0';
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Función cazadora de imágenes (No falla nunca)
async function getPlaceholderBuffer() {
  const rutas = [
    path.join(__dirname, 'sodie-placeholder.jpg'), // Busca en routes
    path.join(__dirname, '..', 'public', 'sodie-placeholder.jpg'), // Busca en public subiendo de routes
    path.join(process.cwd(), 'public', 'sodie-placeholder.jpg'), // Busca en public desde la raíz
    path.join(process.cwd(), 'routes', 'sodie-placeholder.jpg') // Busca en routes desde la raíz
  ];

  for (const ruta of rutas) {
    try {
      // Intenta leer el archivo
      const buffer = await fs.readFile(ruta);
      console.log(`✅ [SODIE] ¡Imagen encontrada mágicamente en!: ${ruta}`);
      return buffer;
    } catch (e) {
      // Si no está ahí, pasa a la siguiente ruta en silencio
    }
  }
  
  // Si llega hasta aquí, Git de verdad te odia y no subió el archivo.
  throw new Error('💀 La imagen comodín no existe en el servidor. Git no la está subiendo a Render.');
}

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

  // 1. Token: Siempre usa el System User Token central de ADMIN como fallback
  const finalToken = token || process.env.ADMIN_TOKEN || process.env.META_ACCESS_TOKEN || process.env.META_SYSTEM_TOKEN;

  // 2. Pixel ID: Si es ADMIN usa el de entorno, si es cliente usa el pixelId específico enviado
  const finalPixelId = isAdmin 
    ? (pixelId || process.env.META_PIXEL_ID) 
    : (pixelId || null);

  // 3. Ad Account ID: Si es ADMIN usa el de entorno, si es cliente usa el adAccountId enviado
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
    
    // 💡 ¡El campo oficial exacto que pedía Meta para el valor en la API!
    const schema = ['EMAIL', 'PHONE', 'FN', 'LN', 'COUNTRY', 'LOOKALIKE_VALUE'];

    const formattedData = usersPayload.map(u => {
      const country = (u.country || u.pais || 'US').toString().trim().toUpperCase();
      const rawValue = u.value !== undefined ? u.value : (u.valor !== undefined ? u.valor : 1000);
      const valueNum = typeof rawValue === 'number' ? rawValue : parseFloat(rawValue || 1000);
      
      const emailSimulado = u.email || `lead_${country.toLowerCase()}_${Date.now()}@sodie-leads.com`;
      const phoneSimulado = u.phone || `+1555${Math.floor(100000 + Math.random() * 900000)}`;
      const fnSimulado = u.firstName || u.nombre || 'Customer';
      const lnSimulado = u.lastName || u.apellido || 'Target';

      // 💡 Retornamos los datos PII cifrados + el país + el valor real de LTV
      return [
        hashData(emailSimulado),
        hashData(phoneSimulado),
        hashData(fnSimulado),
        hashData(lnSimulado),
        country,
        valueNum > 0 ? valueNum : 10000 // <--- ¡Aquí viaja el valor exacto para segmentar a los que quieres!
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

    // 1. Crear Audiencia Semilla
    const seedAudienceId = await this.crearAudienciaSemillaConValor(
      creds.adAccountId, 
      creds.token, 
      `SODIE_Seed_Value_${Date.now()}`,
      clientId
    );

    // 2. Inyectar registros cifrados SHA-256 con LOOKALIKE_VALUE
    await this.inyectarUsuariosSemilla(seedAudienceId, usersPayload, creds.token);

    // 3. Generar Lookalikes 1% por cada país detectado
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
// Asegúrate de tener GRAPH_BASE_URL, getMetaCredentials y buildCampaignName definidos arriba.
async crearCampanaVentas({ 
    actId, 
    token, 
    pixelId, 
    clientId = 'ADMIN', 
    dailyBudget, 
    customAudiences = [],
    minAge = 25, 
    maxAge = 65, 
    websiteUrl = 'https://sodie/hash.app'
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
    // 2. EXTRAER PAGE ID E INSTAGRAM ID
    // ---------------------------------------------------------
        // ---------------------------------------------------------
    // 2. EXTRAER PAGE ID E INSTAGRAM ID (A prueba de balas)
    // ---------------------------------------------------------
    const accountDetailsUrl = `${GRAPH_BASE_URL}/act_${creds.adAccountId}?fields=promote_pages{id,instagram_business_account},pixels{id}&access_token=${creds.token}`;
    const accountRes = await fetch(accountDetailsUrl);
    const accountData = await accountRes.json();
    
    let pageId = null;
    let instagramId = null;
    let finalPixelId = null;
    
    // Intentar sacar la página del cliente
    if (accountData.promote_pages && accountData.promote_pages.data.length > 0) {
      pageId = accountData.promote_pages.data[0].id;
      instagramId = accountData.promote_pages.data[0].instagram_business_account?.id || null;
    }

    // 🛡️ PLAN DE SEGURIDAD TOTAL: Si el cliente no tiene la página vinculada en su API, 
    // usamos tu Fanpage matriz de SODIE por defecto para que el borrador SE CREE SÍ O SÍ, 
    // evitando que el sistema colapse y frustre al usuario.
    if (!pageId) {
      console.warn(`⚠️ [SODIE Engine] La cuenta ${creds.adAccountId} no devolvió promote_pages. Usando página matriz de respaldo.`);
      pageId = process.env.META_PAGE_ID || ''; 
    }
    // ---------------------------------------------------------
    // 3. SUBIR IMAGEN LOCAL Y OBTENER HASH
    // ---------------------------------------------------------
    // Ajusta la ruta relativa según dónde esté tu archivo metaService.js
    // process.cwd() apunta a la raíz de tu proyecto backend.
         // ---------------------------------------------------------
    // 3. SUBIR IMAGEN LOCAL Y OBTENER HASH (El Inmortal)
    // ---------------------------------------------------------
    // Llamamos a nuestra función cazadora que nos devuelve el archivo listo
    const imageBuffer = await getPlaceholderBuffer();
    const imgBlob = new Blob([imageBuffer], { type: 'image/jpeg' });
    
    const form = new FormData();
    form.append('filename', imgBlob, 'sodie_placeholder.jpg');
    form.append('access_token', creds.token);

    const uploadUrl = `${GRAPH_BASE_URL}/act_${creds.adAccountId}/adimages`;
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      body: form
    });

    const uploadData = await uploadRes.json();
    if (uploadData.error) throw new Error(`Meta API Error subiendo imagen: ${uploadData.error.message}`);
    
    // Hash generado por Meta
    const imageHash = uploadData.images['sodie_placeholder.jpg'].hash;
    // ---------------------------------------------------------
    // 4. CREAR AD SET (CON EDAD Y AUDIENCIAS)
    // ---------------------------------------------------------
   const formattedAudiences = (customAudiences || []).map(aud => {
      if (typeof aud === 'string') return { id: aud };
      if (aud && aud.id) return { id: aud.id };
      return null;
    }).filter(Boolean);

    const adSetUrl = `${GRAPH_BASE_URL}/act_${creds.adAccountId}/adsets`;
    const adSetBody = {
      name: `${campaignName} - AdSet (LAL 1% Value)`,
      campaign_id: campaignId,
      daily_budget: finalDailyBudget,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'OFFSITE_CONVERSIONS',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting: { 
        custom_audiences: formattedAudiences,
        age_min: parseInt(minAge, 10), // 🔥 Casteo estricto de los datos de MongoDB
        age_max: parseInt(maxAge, 10)
      },
      status: 'PAUSED',
      access_token: creds.token
    };

    // 🔥 Usamos finalPixelId (el del Admin o el del Cliente)
    if (finalPixelId) {
      adSetBody.promoted_object = { pixel_id: finalPixelId, custom_event_type: 'PURCHASE' };
    }

    const adSetRes = await fetch(adSetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adSetBody)
    });
    
    const adSetData = await adSetRes.json();
    if (adSetData.error) throw new Error(`Meta API AdSet Error: ${adSetData.error.message}`);
    // ---------------------------------------------------------
    // 5. CREAR AD CREATIVE (DISEÑO BASE)
    // ---------------------------------------------------------
    const creativeUrl = `${GRAPH_BASE_URL}/act_${creds.adAccountId}/adcreatives`;
    const creativeRes = await fetch(creativeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Creative Placeholder - SODIE',
        object_story_spec: {
          page_id: pageId,
          instagram_actor_id: instagramId,
          link_data: {
            image_hash: imageHash, // Inyectamos el hash que obtuvimos en el paso 3
            link: websiteUrl,
            message: 'Tu anuncio va aquí. Selecciona "Usar publicación existente" en la configuración y modifica instagram / pagina de facebook.',
            call_to_action: {
              type: 'LEARN_MORE',
              value: { link: websiteUrl }
            }
          }
        },
        access_token: creds.token
      })
    });
    
    const creativeData = await creativeRes.json();
    if (creativeData.error) throw new Error(`Meta API Creative Error: ${creativeData.error.message}`);

    // ---------------------------------------------------------
    // 6. CREAR AD (ANUNCIO FINAL EN EL BORRADOR)
    // ---------------------------------------------------------
    const adUrl = `${GRAPH_BASE_URL}/act_${creds.adAccountId}/ads`;
    const adRes = await fetch(adUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Anuncio Borrador SODIE',
        adset_id: adSetData.id,
        creative: { creative_id: creativeData.id },
        status: 'PAUSED', // Listo pero apagado, esperando edición del cliente
        access_token: creds.token
      })
    });

    const adFinalData = await adRes.json();
    if (adFinalData.error) throw new Error(`Meta API Ad Error: ${adFinalData.error.message}`);

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
    minAge,      // 🔥 NUEVO: Recibirlo
    maxAge,      // 🔥 NUEVO: Recibirlo
    websiteUrl   // 🔥 NUEVO: Recibirlo
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
      minAge,      // 🔥 NUEVO: Pasarlo al creador final
      maxAge,      // 🔥 NUEVO: Pasarlo al creador final
      websiteUrl   // 🔥 NUEVO: Pasarlo al creador final
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
