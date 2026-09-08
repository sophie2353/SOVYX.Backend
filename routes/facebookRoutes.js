const express = require('express');
const router = express.Router();
// Importa tu modelo de base de datos (por ejemplo, Usuario o Cliente)
const User = require('../models/User'); // Ajusta la ruta a tu modelo

// POST /api/facebook/connect
router.post('/connect', async (req, res) => {
  try {
    const { userId, userAccessToken } = req.body;

    if (!userAccessToken) {
      return res.status(400).json({ error: "Falta el userAccessToken del cliente" });
    }

    // 1. Obtener la cuenta publicitaria (act_id)
    const adAccountUrl = `https://graph.facebook.com/v25.0/me/adaccounts?fields=id,name&access_token=${userAccessToken}`;
    const adAccountRes = await fetch(adAccountUrl);
    const adAccountData = await adAccountRes.json();

    if (adAccountData.error) {
      return res.status(400).json({ error: "Error Graph API (adaccounts)", details: adAccountData.error });
    }

    const firstAccount = adAccountData.data && adAccountData.data[0];
    if (!firstAccount) {
      return res.status(404).json({ error: "No se encontraron cuentas publicitarias asociadas a este usuario" });
    }

    const actId = firstAccount.id; // "act_123456789"

    // 2. Obtener el Pixel ID
    const pixelUrl = `https://graph.facebook.com/v20.0/${actId}/adspixels?fields=id,name&access_token=${userAccessToken}`;
    const pixelRes = await fetch(pixelUrl);
    const pixelData = await pixelRes.json();

    const firstPixel = pixelData.data && pixelData.data[0];
    const pixelId = firstPixel ? firstPixel.id : null;

    // 3. Persistir en MongoDB
    if (userId) {
      await User.findByIdAndUpdate(
        userId,
        {
          act_id: actId,
          pixel_id: pixelId,
          fb_token: userAccessToken,
          account_name: firstAccount.name,
          updatedAt: new Date()
        },
        { new: true, upsert: true }
      );
    }

    console.log(`[SOVYX FB Connect] Cliente ${userId} vinculado con éxito:`, { actId, pixelId });

    return res.status(200).json({
      success: true,
      message: "Cuenta publicitaria y Pixel vinculados exitosamente",
      data: {
        act_id: actId,
        pixel_id: pixelId,
        account_name: firstAccount.name
      }
    });

  } catch (err) {
    console.error("Error en /api/facebook/connect:", err);
    return res.status(500).json({ error: "Error interno en el servidor" });
  }
});

module.exports = router;
