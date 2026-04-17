const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { enviarMensajeIG } = require('../../modules/instagramApi');
const config = require('../../config/tokens');
const sovyxLogger = require('../../modules/sovyxLogger');

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

router.post('/webhook-forms', async (req, res) => {
  try {
    // Recibimos instagram_user del Sheets
    const { instagram_user, email, linkCurso, nicho, nombreCliente } = req.body;

    if (!instagram_user || !linkCurso) {
      sovyxLogger.error('Onboarding fallido: Faltan datos críticos');
      return res.status(400).json({ error: "Faltan datos" });
    }

    sovyxLogger.info(`SOVYX Onboarding: Procesando material de ${nombreCliente} 🧬`);

    const model = genAI.getGenerativeModel({ model: config.gemini.model });
    
    // PROMPT MEJORADO: Nivel "Infraestructura de Lujo"
    const prompt = `
      Actúa como el Director de Estrategia de SOVYX. Tu cliente es ${nombreCliente}, del nicho ${nicho}.
      Material a analizar: ${linkCurso}
      
      TAREA: Crea 3 guiones de alto impacto para Instagram Stories.
      TONO: Minimalista, opulento, sofisticado y extremadamente directo. Cero relleno.
      REGLA: No uses frases de vendedor barato. Habla de "infraestructura", "escala" y "automatización de élite".
      
      ESTRUCTURA:
      1. El Gancho: Un dolor específico del nicho que solo la IA resuelve.
      2. La Autoridad: Por qué este material + la IA de SOVYX es la única salida.
      3. El Cierre: Llamado a la acción agresivo para ir al DM.
    `;

    const result = await model.generateContent(prompt);
    const estrategia = result.response.text();

    const mensajeFinal = `
¡Estrategia de infraestructura lista, ${nombreCliente}! 📧💅🏽

He analizado tu material y este es el despliegue táctico para tus historias de hoy:

${estrategia}

⌛ PROTOCOLO FINAL:
Mi equipo humano ya tiene la señal de tu pago. Estamos configurando tus accesos exclusivos a Meta Ads. 

Pronto recibirás la invitación al Business Manager para que tomes el control del presupuesto. El motor SOVYX está calentando. 👺🚀
    `.trim();

    // ENVIAR POR INSTAGRAM 
    // Nota: Aquí 'instagram_user' debe ser convertido a ID o usado según tu módulo
    await enviarMensajeIG(instagram_user, mensajeFinal, 'sovyx'); 

    res.json({ success: true, message: "Onboarding completado." });

  } catch (error) {
    sovyxLogger.error('Error crítico en Onboarding', { error: error.message });
    res.status(500).json({ error: "Error en el sistema" });
  }
});

module.exports = router;
