const express = require('express');
const router = express.Router();
const { generarCheckoutKontigo } = require('../services/kontigoService');

// POST /api/pagos/crear-link
router.post('/crear-link', async (req, res) => {
  try {
    const { email, clienteId } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'El email del cliente es obligatorio' });
    }

    const checkoutUrl = await generarCheckoutKontigo({ email, clienteId });
    res.status(200).json({ status: 'SUCCESS', checkoutUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
