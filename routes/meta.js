// ====================================================
// Archivo: routes/meta.js
// Lógica exclusiva de Meta Graph API e IA-1
// ====================================================

const express = require('express');
const router = express.Router();
const sovyxDatabase = require('../modules/sovyxDatabase');
const metaService = require('../services/metaService');

// ----------------------------------------------------
// 1. POST /api/meta/conectar 
// Canjea Token FB por Long-Lived Token y guarda credenciales en DB
// ----------------------------------------------------
router.post('/conectar', async (req, res) => {
  try {
    const { email, userToken } = req.body;

    if (!email || !userToken) {
      return res.status(400).json({ error: 'El email y el userToken de Facebook son requeridos.' });
    }

    // A. Canjear Short-Lived Token por Token de Larga Duración (60 días)
    const urlCanje = `https://graph.facebook.com/v25.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&fb_exchange_token=${userToken}`;
    const resCanje = await fetch(urlCanje);
    const dataCanje = await resCanje.json();

    if (dataCanje.error) {
      throw new Error(`Error Meta Token: ${dataCanje.error.message}`);
    }

    const longLivedToken = dataCanje.access_token;

    // B. Obtener ID de Ad Account y FanPage del usuario
    const urlInfo = `https://graph.facebook.com/v25.0/me?fields=adaccounts,accounts&access_token=${longLivedToken}`;
    const resInfo = await fetch(urlInfo);
    const dataInfo = await resInfo.json();

    const adAccountId = dataInfo.adaccounts?.data[0]?.id;
    const pageId = dataInfo.accounts?.data[0]?.id;

    // C. Guardar credenciales Meta vinculadas al cliente en MongoDB
    await sovyxDatabase.guardarCredencialesMeta(email, {
      accessToken: longLivedToken,
      adAccountId,
      pageId,
      estadoMeta: 'CONECTADO'
    });

    console.log(`🔗 [META ROUTE] Cuenta vinculada con éxito para: ${email}`);

    res.status(200).json({
      status: 'SUCCESS',
      mensaje: 'Meta vinculado con éxito. 🦁',
      adAccountId,
      pageId
    });
  } catch (error) {
    console.error('🔴 Error al conectar Meta:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// 2. POST /api/meta/iniciar-ciclo 
// Busca borrador "Prueba Hora 1-24", inyecta IA-1 y activa la campaña
// ----------------------------------------------------
router.post('/iniciar-ciclo', async (req, res) => {
  try {
    const { email, segmentacionInicial } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'El email del cliente es obligatorio.' });
    }

    const cliente = await sovyxDatabase.obtenerCliente(email);

    if (!cliente?.meta?.accessToken) {
      return res.status(400).json({ error: 'El cliente no tiene una cuenta de Meta conectada.' });
    }

    // A. Localizar el borrador de campaña preparado por el usuario
    const borrador1 = await metaService.buscarBorrador(
      cliente.meta.adAccountId, 
      cliente.meta.accessToken, 
      "Prueba Hora 1-24"
    );

    if (!borrador1) {
      return res.status(404).json({ error: 'No se encontró el borrador "Prueba Hora 1-24" en Ads Manager.' });
    }

    // B. Inyectar públicos objetivo / segmentación calculada por IA-1 y encender la campaña
    await metaService.inyectarSegmentacionYActivar(
      cliente.meta.accessToken, 
      borrador1.id, 
      segmentacionInicial
    );

    // C. Registrar en base de datos la fecha de inicio del ciclo 48H
    await sovyxDatabase.actualizarEstadoCiclo(email, 'HORA_1_24_ACTIVA', {
      'ciclo.fechaInicio': new Date(),
      'ciclo.campaignId1': borrador1.id
    });

    console.log(`⚡ [META ROUTE] Ciclo 48H activado para: ${email}`);

    res.status(200).json({
      status: 'SUCCESS',
      mensaje: 'Campaña "Prueba Hora 1-24" optimizada con IA-1 y activada correctamente. 🚀'
    });
  } catch (error) {
    console.error('🔴 Error al iniciar ciclo 48H:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
