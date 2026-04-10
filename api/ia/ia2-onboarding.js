// api/ia/ia2-onboarding.js
const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { enviarMensajeIG } = require('../../modules/instagramApi');
const config = require('../../config/tokens');
const sovyxLogger = require('../../modules/sovyxLogger');

// Configuración de Gemini
const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

router.post('/webhook-forms', async (req, res) => {
  try {
    // Estos campos deben coincidir con lo que envías desde el Apps Script de Google Sheets
    const { userId, email, linkCurso, nicho, nombreCliente } = req.body;

    if (!userId || !linkCurso) {
      return res.status(400).json({ error: "Faltan datos críticos (userId o linkCurso)" });
    }

    sovyxLogger.info(`SOVYX Onboarding: Procesando material de ${nombreCliente}`);

    // 1. LLAMADA A GEMINI PARA ESTRATEGIA PERSONALIZADA
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      Eres el estratega de contenido de SOVYX. 
      Analiza el nicho "${nicho}" y este enlace de curso/material: "${linkCurso}".
      Crea una estructura de 3 historias de Instagram (Hook, Valor, CTA) para venderlo como High Ticket (5,000 USDT).
      Sé breve, agresivo y profesional.
    `;

    const result = await model.generateContent(prompt);
    const estrategia = result.response.text();

    // 2. MENSAJE DE CIERRE DE ONBOARDING
    const mensajeFinal = `
¡Estrategia de historias completada, ${nombreCliente}! 📧💅🏽

He analizado tu material y aquí tienes tu plan de acción para empezar a calentar la cuenta ahora mismo:

${estrategia}

⌛LO QUE SIGUE (TRABAJO MANUAL):
Mi arquitecto humano está configurando tus tokens de acceso exclusivos y la conexión con Meta Ads Manager. 

En breve recibirás una notificación manual para:
1. Aceptar la invitación a nuestro Business Manager.
2. Configurar tu tarjeta bancaria para el presupuesto de anuncios (recuerda que tú tienes el control total de tus datos financieros).

Una vez hecho esto, SOVYX tomará el control total. 👺🚀
    `.trim();

    // 3. ENVIAR POR INSTAGRAM
    await enviarMensajeIG(userId, mensajeFinal);

    res.json({ success: true, message: "Onboarding de IA2 finalizado con éxito." });

  } catch (error) {
    sovyxLogger.error('Error crítico en Onboarding IA2', { error: error.message });
    res.status(500).json({ error: "Error en el sistema de onboarding" });
  }
});

module.exports = router;
