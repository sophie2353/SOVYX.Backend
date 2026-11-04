/**
 * SODIE - Servicio de Almacenamiento y Control de Campañas (services/campaignStorageService.js)
 * Gestiona caché, persistencia en MongoDB y estados de indexación para el Radar de 4 horas.
 */

const Client = require('../models/clients');
const Audiencia = require('../models/Audiencia');

// Almacenamiento temporal en memoria con TTL
const activeCampaignsCache = new Map();

/**
 * Guarda o actualiza el campaign_id enviado desde metaServices, 
 * registrando también las customAudiences y el estado de indexación PENDIENTE.
 */
async function registrarCampaignId({ 
  clientId, 
  campaignId, 
  customAudiences = [], 
  estadoIndexacion = 'PENDIENTE', 
  tokenUsado = null,
  version = 'V3.5', 
  isAdmin = false 
}) {
  const key = isAdmin ? 'ID_CAMPAIGN_ADMIN' : `ID_CAMPAIGN_${String(clientId).toUpperCase()}`;
  const now = Date.now();
  const expiresAt = now + (72 * 60 * 60 * 1000); // 72 horas de ciclo

  const campaignData = {
    key,
    clientId: isAdmin ? 'ADMIN' : clientId,
    campaignId,
    customAudiences,
    estadoIndexacion,
    tokenUsado,
    version,
    createdAt: now,
    expiresAt
  };

  // 1. Guardar en caché rápida de memoria
  activeCampaignsCache.set(key, campaignData);

  // 2. Persistir en la base de datos (Modelo Audiencia o Client según prefieras mantener la metadata)
  try {
    const cleanClientId = isAdmin ? 'ADMIN' : String(clientId).trim().toUpperCase();
    
    // Actualizamos el documento de Audiencia para que el radar lo barra fácilmente
    await Audiencia.findOneAndUpdate(
      { clientId: cleanClientId },
      { 
        $set: { 
          clientId: cleanClientId,
          campaignIdPendiente: campaignId,
          customAudiencesPendientes: customAudiences,
          estadoIndexacion: estadoIndexacion,
          tokenUsado: tokenUsado,
          'meta.lastCampaignId': campaignId,
          'meta.version': version,
          'meta.campaignExpiresAt': new Date(expiresAt),
          'meta.status': 'PAUSED'
        } 
      },
      { upsert: true, new: true }
    );

    // Si no es admin, actualizamos también el modelo Client por compatibilidad
    if (!isAdmin) {
      await Client.findOneAndUpdate(
        { clientId: cleanClientId },
        { 
          $set: { 
            'meta.lastCampaignId': campaignId,
            'meta.version': version,
            'meta.campaignExpiresAt': new Date(expiresAt),
            'meta.status': 'PAUSED'
          } 
        },
        { upsert: true }
      );
    }
  } catch (err) {
    console.error(`⚠️ Error al guardar campaign_id y metadatos en DB para ${key}:`, err.message);
  }

  return campaignData;
}

/**
 * Obtiene el campaign_id vigente verificando la expiración
 */
async function obtenerCampaignIdVigente(clientId, isAdmin = false) {
  const key = isAdmin ? 'ID_CAMPAIGN_ADMIN' : `ID_CAMPAIGN_${String(clientId).toUpperCase()}`;
  const now = Date.now();

  let data = activeCampaignsCache.get(key);

  if (!data && !isAdmin) {
    const clientDoc = await Client.findOne({ clientId });
    if (clientDoc && clientDoc.meta?.lastCampaignId) {
      const exp = new Date(clientDoc.meta.campaignExpiresAt).getTime();
      if (exp > now) {
        data = {
          key,
          clientId,
          campaignId: clientDoc.meta.lastCampaignId,
          version: clientDoc.meta.version || 'V3.5',
          expiresAt: exp
        };
        activeCampaignsCache.set(key, data);
      }
    }
  }

  if (data) {
    if (now >= data.expiresAt) {
      activeCampaignsCache.delete(key);
      if (!isAdmin) {
        await Client.updateOne({ clientId }, { $unset: { 'meta.lastCampaignId': 1 } });
      }
      return null;
    }
    return data.campaignId;
  }

  return null;
}

/**
 * ⚡ NUEVO BLOQUE: Obtiene únicamente las campañas que siguen INACTIVAS / PENDIENTES de indexación
 * Usado exclusivamente por el Node-cron del radar.
 */
async function obtenerCampanasInactivas() {
  try {
    const pendientes = await Audiencia.find({ estadoIndexacion: 'PENDIENTE' });
    return pendientes || [];
  } catch (err) {
    console.error('⚠️ Error al consultar campañas inactivas en DB:', err.message);
    return [];
  }
}

/**
 * ⚡ NUEVO BLOQUE: Marca la campaña/audiencia como LISTA (activa para el usuario) 
 * para sacarla del radar de consultas repetitivas a Meta.
 */
async function marcarComoIndexada(clientId, campaignId) {
  try {
    const cleanClientId = String(clientId).trim().toUpperCase();
    const key = cleanClientId === 'ADMIN' ? 'ID_CAMPAIGN_ADMIN' : `ID_CAMPAIGN_${cleanClientId}`;
    
    // 1. Limpiar de caché rápida si existía
    activeCampaignsCache.delete(key);

    // 2. Actualizar en MongoDB cambiando el estado a LISTO_PARA_ACTIVAR
    return await Audiencia.findOneAndUpdate(
      { clientId: cleanClientId, campaignIdPendiente: campaignId },
      { 
        $set: { 
          estadoIndexacion: 'LISTO_PARA_ACTIVAR',
          indexadoEn: new Date()
        } 
      },
      { new: true }
    );
  } catch (err) {
    console.error(`⚠️ Error al marcar como indexada la campaña ${campaignId} para ${clientId}:`, err.message);
    return null;
  }
}

module.exports = {
  registrarCampaignId,
  obtenerCampaignIdVigente,
  obtenerCampanasInactivas,
  marcarComoIndexada
};
