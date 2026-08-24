const metaService = {
  // 1. Buscar borrador por nombre exacto
  async buscarBorrador(adAccountId, token, nombreBorrador) {
    const url = `https://graph.facebook.com/v25.0/${adAccountId}/campaigns?fields=id,name,status&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) throw new Error(`Meta API Error: ${data.error.message}`);
    
    return data.data.find(c => c.name.trim().toLowerCase() === nombreBorrador.trim().toLowerCase());
  },

  // 2. Inyectar segmentación al AdSet y activar campaña
  async inyectarSegmentacionYActivar(token, campaignId, dataSegmentacion) {
    // Obtener el AdSet de la campaña
    const adSetUrl = `https://graph.facebook.com/v25.0/${campaignId}/adsets?access_token=${token}`;
    const resSet = await fetch(adSetUrl);
    const dataSet = await resSet.json();
    const adSetId = dataSet.data?.[0]?.id;

    if (adSetId && dataSegmentacion) {
      await fetch(`https://graph.facebook.com/v25.0/${adSetId}?access_token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targeting: dataSegmentacion })
      });
    }

    // Activar la campaña
    await fetch(`https://graph.facebook.com/v25.0/${campaignId}?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE' })
    });
  },

  // 3. Pausar campaña al cumplir las 24h
  async pausarCampana(token, campaignId) {
    await fetch(`https://graph.facebook.com/v25.0/${campaignId}?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAUSED' })
    });
  },

  // 4. Leer métricas para la IA3
  async obtenerMetricas(token, campaignId) {
    const url = `https://graph.facebook.com/v25.0/${campaignId}/insights?fields=impressions,clicks,cpc,ctr,spend&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.data?.[0] || {};
  }
};

module.exports = metaService;
