const express = require('express');
const router = express.Router();
const Client = require('../models/Client'); // Importas tu modelo

router.post('/connect', async (req, res) => {
  try {
    const { userId, userAccessToken } = req.body;

    if (!userAccessToken || !userId) {
      return res.status(400).json({ error: "Faltan datos requeridos (userId o userAccessToken)" });
    }

    // 1. Graph API: Obtener Cuenta Publicitaria
    const adAccountRes = await fetch(`https://graph.facebook.com/v20.0/me/adaccounts?fields=id,name&access_token=${userAccessToken}`);
    const adAccountData = await adAccountRes.json();

    if (adAccountData.error) {
      return res.status(400).json({ error: "Error Graph API (adaccounts)", details: adAccountData.error });
    }

    const firstAccount = adAccountData.data && adAccountData.data[0];
    if (!firstAccount) {
      return res.status(404).json({ error: "No se encontraron cuentas publicitarias asociadas" });
    }

    const actId = firstAccount.id;

    // 2. Graph API: Obtener Pixel ID
    const pixelRes = await fetch(`https://graph.facebook.com/v20.0/${actId}/adspixels?fields=id,name&access_token=${userAccessToken}`);
    const pixelData = await pixelRes.json();
    const firstPixel = pixelData.data && pixelData.data[0];
    const pixelId = firstPixel ? firstPixel.id : null;

    // 3. Almacenamiento en Mongo (Sin crear variables sueltas)
    const clientUpdated = await Client.findOneAndUpdate(
      { userId }, // Busca al cliente por su ID
      {
        $set: {
          'meta.act_id': actId,
          'meta.pixel_id': pixelId,
          'meta.fb_token': userAccessToken,
          'meta.account_name': firstAccount.name,
          'meta.updatedAt': new Date()
        }
      },
      { new: true, upsert: true } // Si no existe el cliente, lo crea
    );

    return res.status(200).json({
      success: true,
      message: "Credenciales de Meta guardadas exitosamente en MongoDB",
      data: clientUpdated.meta
    });

  } catch (err) {
    console.error("Error en /api/facebook/connect:", err);
    return res.status(500).json({ error: "Error interno en el servidor" });
  }
});

module.exports = router;
