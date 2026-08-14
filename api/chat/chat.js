// routes/chat.js
const express = require('express');
const SOVYXIA2 = require('../modules/sovyxIA2Conversor');
const ia2 = new SOVYXIA2();

router.post('/message', async (req, res) => {
  const { mensaje, sessionId } = req.body; // El frontend genera o recupera un sessionId único

  if (!mensaje || !sessionId) {
    return res.status(400).json({ error: 'Mensaje y sessionId requeridos.' });
  }

  try {
    const respuestaIA = await ia2.generarRespuesta({ mensaje, sessionId });
    return res.status(200).json(respuestaIA);
  } catch (error) {
    console.error('Error procesando mensaje web:', error);
    return res.status(500).json({ error: 'Error interno del motor de chat.' });
  }
});

module.exports = router;
