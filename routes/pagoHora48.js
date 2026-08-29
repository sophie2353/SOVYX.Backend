const express = require('express');
const router = express.Router();

// 1. Guardar los 4 links en la base de datos/nube
router.post('/guardar-links', async (req, res) => {
  try {
    const { clienteId, linksPago } = req.body; 
    // linksPago = [{ plan: 'Final', url: 'https://pasarela2.com/pay/xxx' }, ...]
    
    // Aquí guardas en tu BD (Mongo, Supabase, Firebase, etc.)
    await guardarEnBaseDeDatos(clienteId, linksPago);

    return res.status(200).json({ ok: true, mensaje: "4 links de pago almacenados con éxito." });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// 2. Obtener el link de pago cuando el cliente llega a la Hora 48
router.get('/obtener-link/:clienteId', async (req, res) => {
  try {
    const { clienteId } = req.params;
    const dataCliente = await obtenerDeBaseDeDatos(clienteId);

    return res.status(200).json({
      ok: true,
      urlPagoHora48: dataCliente.urlPagoHora48, // Link de la nueva pasarela
      precioFinal: 9000
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "No se pudo recuperar el link de pago." });
  }
});

module.exports = router;
