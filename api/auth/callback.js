// api/auth/callback.js
router.get('/ig/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) return res.status(400).send("No se recibió el código.");

  try {
    // 1. Intercambiar CODE por TOKEN CORTO (2 horas)
    const urlShort = `https://graph.facebook.com/v25.0/oauth/access_token?` +
      `client_id=${process.env.FB_APP_ID}&` +
      `redirect_uri=https://tu-app-en-render.onrender.com/api/auth/callback&` + 
      `client_secret=${process.env.FB_APP_SECRET}&` +
      `code=${code}`;

    const resShort = await axios.get(urlShort);
    const shortToken = resShort.data.access_token;

    // 2. Intercambiar TOKEN CORTO por TOKEN LARGO (60 días)
    const urlLong = `https://graph.facebook.com/v25.0/oauth/access_token?` +
      `grant_type=fb_exchange_token&` +
      `client_id=${process.env.FB_APP_ID}&` +
      `client_secret=${process.env.FB_APP_SECRET}&` +
      `fb_exchange_token=${shortToken}`;

    const resLong = await axios.get(urlLong);
    const longToken = resLong.data.access_token;

    // 3. Guardar en tu DB de SOVYX para que la IA2 empiece a trabajar
    await db.guardarTokenCliente(longToken);

    res.send("✅ Autenticación de SOVYX exitosa. Puedes cerrar esta pestaña.");
    sovyxLogger.info("Nuevo Token de 60 días generado y guardado.");

  } catch (error) {
    sovyxLogger.error("Error en flujo de tokens", error.response?.data || error.message);
    res.status(500).send("Error procesando la seguridad.");
  }
});
