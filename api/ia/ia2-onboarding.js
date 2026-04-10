// api/ia/ia2-onboarding.js
const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { enviarMensajeIG } = require('../../modules/instagramApi');
const config = require('../../config/tokens');
const sovyxLogger = require('../../modules/sovyxLogger');

// Configuración de Gemini (Usando la API Key del config)
const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

router.post('/webhook-forms', async (req, res) => {
  try {
    //userId es el IGSID (Instagram Scoped ID) para que el mensaje llegue al DM correcto
    const { userId, email, linkCurso, nicho, nombreCliente } = req.body;

    if (!userId || !linkCurso) {
      sovyxLogger.error('Onboarding fallido: Faltan datos', { userId, linkCurso });
      return res.status(400).json({ error: "Faltan datos críticos (userId o linkCurso)" });
    }

    sovyxLogger.info(`SOVYX Onboarding: Procesando material de ${nombreCliente} 🧬`);

    // 1. LLAMADA A GEMINI PARA ESTRATEGIA PERSONALIZADA
    const model = genAI.getGenerativeModel({ model: config.gemini.model || "gemini-1.5-flash" });
    
    const prompt = `
      Actúa como el estratega de contenido de élite de SOVYX. 
      Nicho: ${nicho}
      Material: ${linkCurso}
      
      TAREA: Crea 3 guiones breves para Historias de Instagram.
      Objetivo: Vender este programa como High Ticket (5,000 USDT).
      Tono: Profesional, sofisticado, directo al dolor y agresivo con el beneficio.
      Formato: Historia 1 (Hook), Historia 2 (Valor/Autoridad), Historia 3 (CTA directo al DM).
    `;

    const result = await model.generateContent(prompt);
    const estrategia = result.response.text();

    // 2. CONSTRUCCIÓN DEL MENSAJE FINAL
    const mensajeFinal = `
¡Estrategia de historias completada, ${nombreCliente}! 📧💅🏽

He analizado tu material y aquí tienes tu plan de acción para empezar a calentar la cuenta ahora mismo:

${estrategia}

⌛ LO QUE SIGUE (PROTOCOLO FINAL):
Mi arquitecto humano está configurando tus tokens de acceso exclusivos y la conexión con Meta Ads Manager. 

En breve recibirás una notificación manual para:
1. Aceptar la invitación a nuestro Business Manager.
2. Configurar el método de pago para los anuncios (tú mantienes el control total).

Una vez hecho esto, el motor SOVYX tomará el control total de la escala. 👺🚀
    `.trim();

    // 3. ENVIAR POR INSTAGRAM (Asegúrate que enviarMensajeIG use el token correcto de la cuenta matriz)
    await enviarMensajeIG(userId, mensajeFinal, 'sovyx'); 

    sovyxLogger.info(`✅ Onboarding exitoso para ${nombreCliente}. Estrategia enviada.`);
    
    res.json({ 
      success: true, 
      message: "Onboarding de IA2 finalizado. Mensaje enviado a IG." 
    });

  } catch (error) {
    sovyxLogger.error('Error crítico en Onboarding IA2', { error: error.message });
    res.status(500).json({ error: "Error en el sistema de onboarding" });
  }
});

module.exports = router;
