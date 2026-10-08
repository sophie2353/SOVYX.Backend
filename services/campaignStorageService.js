const Client = require('../models/clients');

// Almacenamiento temporal en memoria con TTL de 24 horas
const activeCampaignsCache = new Map();

/**
 * Guarda o actualiza el campaign_id enviado desde metaServices o adminRoutes
 */.
async function registrarCampaignId({ clientId, campaignId, version = 'V3.5', isAdmin = false }) {
  const key = isAdmin ? 'ID_CAMPAIGN_ADMIN' : `ID_CAMPAIGN_${clientId.toUpperCase()}`;
  const now = Date.now();
  const expiresAt = now + (24 * 60 * 60 * 1000); // Expiración exacta de 24 horas (V3.5)

  const campaignData = {
    key,
    clientId: isAdmin ? 'ADMIN' : clientId,
    campaignId,
    version,
    createdAt: now,
    expiresAt
  };

  // 1. Guardar en caché rápida de memoria
  activeCampaignsCache.set(key, campaignData);

  // 2. Persistir en la base de datos
  try {
    if (!isAdmin) {
      await Client.findOneAndUpdate(
        { clientId },
        { 
          $set: { 
            'meta.lastCampaignId': campaignId,
            'meta.version': version,
            'meta.campaignExpiresAt': new Date(expiresAt),
            'meta.status': 'ACTIVE'
          } 
        },
        { upsert: true }
      );
    }
  } catch (err) {
    console.error(`⚠️ Error al guardar campaign_id en DB para ${key}:`, err.message);
  }

  return campaignData;
}

/**
 * Obtiene el campaign_id vigente verificando que no hayan pasado las 24h
 */
async function obtenerCampaignIdVigente(clientId, isAdmin = false) {
  const key = isAdmin ? 'ID_CAMPAIGN_ADMIN' : `ID_CAMPAIGN_${clientId.toUpperCase()}`;
  const now = Date.now();

  // 1. Buscar en caché
  let data = activeCampaignsCache.get(key);

  // 2. Si no está en caché, consultar DB
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

  // 3. Validación de auto-eliminación de 24 horas (V3.5)
  if (data) {
    if (now >= data.expiresAt) {
      // Pasaron las 24h: se elimina para dar paso a la siguiente campaña
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

module.exports = {
  registrarCampaignId,
  obtenerCampaignIdVigente
};
