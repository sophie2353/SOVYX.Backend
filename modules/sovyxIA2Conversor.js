// modules/sovyxIA2Conversor.js
const sovyxLogger = require('./sovyxLogger');
const config = require('../config/tokens'); 
const metaAdsApi = require('./metaAdsApi'); 
const ia3 = require('./sovyxIA3Analyzer'); 

class SOVYXIA2Conversor {
  constructor(estilo = 'high_ticket_client') {
    this.name = "SOVYX IA2";
    this.estilo = estilo;
    this.contexto = {}; 
    
    this.plantillas = {
      "hola": [
        "¡Hey! ¿Cómo vas? Veo que te interesa escalar con infraestructura de IA. ¿Qué es lo que más te llamó la atención de SOVYX? 🦁",
        "Hola. Directo al grano: SOVYX no es un curso, es un sistema que montamos por ti. ¿Qué duda específica tienes?"
      ],
      
      "cuánto cuesta": [
        "La inversión en la infraestructura completa de SOVYX es de ${precio}. Esto incluye el despliegue de las 3 IAs y 12 meses de desarrollo técnico. Pero mira mis historias... estoy dejando que algunos validen primero con una Fase Beta. ¿Te interesa ver cómo funciona antes de los 5k?",
        "Son ${precio} (Pago único). Actualmente solo nos quedan ${slots} slots porque el despliegue es personalizado. ¿Estás listo para este nivel de escala o prefieres probar la Fase Beta primero?"
      ],
      
      "como_funciona": [
        "Es un ecosistema de 3 núcleos:\n1️⃣ IA1: Filtra gente con alto capital.\n2️⃣ IA2: Filtra y cierra en DMs (como hago ahora contigo).\n3️⃣ IA3: Analiza las ventas y optimiza el proceso.\n\nBásicamente, tú solo subes el contenido y la máquina hace el resto. 🚀"
      ],

      "ver_demanda": [
        "Lo que ves en mis historias es la IA2 gestionando a los 100 perfiles que filtramos hoy. El sistema está cerrando ahora mismo. Por eso solo libero 4 slots: mi equipo y yo nos enfocamos en que tu despliegue sea igual de agresivo. ¿Quieres uno o prefieres esperar al próximo ciclo? 🥱",
        "Exacto, eso es el núcleo conversacional en acción. Hay mucha gente en fila y solo 4 slots disponibles. La pregunta no es si funciona, es si vas a entrar tú o tu competencia. 🦁"
      ],

      "fase_beta": [
        "Hagamos algo: Entras en Fase Beta. Solo inviertes $260 en ads (2 posts). Si la IA2 no te cierra al menos una venta de $2,000, no me pagas nada. Riesgo cero. Cuando la IA cierre esa venta, me pagas mi 50% de comisión y activamos el slot de $5k para escalar. ¿Trato? 👺"
      ],
      
      "resultados": [
        "Los resultados están en mis historias en tiempo real. He decidido demostrar que las IAs venden solas antes de pedírtelo a ti. Solo quedan ${slots} cupos para los que quieren dejar de responder DMs manualmente."
      ],
      
      "caro": [
        "Caro es perder el 90% de tus leads por no responder a tiempo. SOVYX trabaja 24/7. Si haces una sola venta de $2,000 en la Fase Beta, ya validaste el sistema. ¿Lo ves ahora?"
      ],
      
      "compra": [
        "Excelente. Para asegurar tu slot (quedan ${slots}), procesa el pago aquí: ${paymentLink}\n\n⚠️ NOTA: El sistema valida transacciones automáticamente. Envíame el comprobante para darte acceso VIP."
      ],

      "agotado": [
        "Lo siento, acabamos de asignar el último slot disponible. Regístrate en la Lista de Espera VIP por si alguien no concreta su pago: ${linkFormulario}"
      ],
      
      "post_pago": [
        "✅ ¡Pago detectado en el núcleo! 🎉\n\nBienvenido a SOVYX. Completa este formulario de activación: ${linkFormulario}\n\nEn cuanto lo envíes, mi núcleo generativo te enviará la estrategia de historias para empezar HOY. ¿Hacemos historia?"
      ],
      
      "default": [
        "¿Cuál es tu cuello de botella ahora: captar leads o cerrarlos? SOVYX resuelve ambos.",
        "¿Buscas un curso o un sistema de infraestructura que trabaje por ti? 🥱"
      ]
    };

    this.patronesIntencion = {
      saludo: ['hola', 'hey', 'hi', 'buenos dias', 'que tal'],
      precio: ['precio', 'cuesta', 'valor', 'inversión', 'cuanto', 'costo'],
      como_funciona: ['como funciona', 'explica', 'proceso', 'como es'],
      resultados: ['resultado', 'logrado', 'casos', 'ejemplos', 'demanda', 'viendo'],
      objecion: ['caro', 'mucho', 'no tengo', 'no me alcanza', 'dinero'],
      compra: ['pagar', 'comprar', 'quiero entrar', 'acceder', 'link de pago'],
      post_pago: ['ya pague', 'listo el pago', 'comprobante']
    };
  }

  detectarIntencion(mensaje) {
    const m = mensaje.toLowerCase();
    for (const [intencion, patrones] of Object.entries(this.patronesIntencion)) {
      if (patrones.some(p => m.includes(p))) return intencion;
    }
    return 'default';
  }

  personalizar(txt) {
    const slots = config.sovyx.slotsRestantes;
    let paymentLink = "";
    let formLink = config.forms.onboardingVIP;

    if (slots === 4) {
      paymentLink = config.payments.kontigo;
    } else if (slots > 0) {
      paymentLink = config.payments.binance.payLink;
    } else {
      paymentLink = "SIN_CUPOS";
      formLink = config.forms.listaEspera;
    }

    return txt
      .replace(/\${precio}/g, '5,000 USDT')
      .replace(/\${slots}/g, slots > 0 ? slots : "0")
      .replace(/\${paymentLink}/g, paymentLink)
      .replace(/\${linkFormulario}/g, formLink);
  }

  async generarRespuesta({ mensaje, usuario }) {
    const clienteId = usuario?.id || 'unknown';
    if (!this.contexto[clienteId]) this.contexto[clienteId] = { etapa: "inicio" };
    
    const ctx = this.contexto[clienteId];
    let intencion = this.detectarIntencion(mensaje);
    const slots = config.sovyx.slotsRestantes;

    // Lógica de Fase Beta para los 100 perfiles filtrados
    if (intencion === 'precio' || intencion === 'default') {
       // Si el usuario pregunta o interactúa después de ver la demanda, le ofrecemos la beta
       if(ctx.etapa === "inicio") {
          clavePlantilla = 'fase_beta';
       }
    }

    if (intencion === 'resultados') {
      clavePlantilla = 'ver_demanda';
    }

    if (intencion === 'compra' && slots <= 0) {
      intencion = 'agotado';
    }

    if (intencion === 'post_pago') {
      try {
        await metaAdsApi.reportarConversionVenta(clienteId, 5000);
        const analyzer = new ia3();
        await analyzer.analizarConversacionDeExito(clienteId, 'sovyx');
        sovyxLogger.success(`💰 IA2: Protocolo de venta completado para ${clienteId}`);
      } catch (err) {
        sovyxLogger.error('Error en disparadores post-pago IA2', err.message);
      }
    }

    let clavePlantilla = intencion;
    if (intencion === 'objecion') clavePlantilla = 'caro';
    if (intencion === 'resultados') clavePlantilla = 'ver_demanda';

    let respuestaRaw = this.plantillas[clavePlantilla] || this.plantillas.default;
    
    if (Array.isArray(respuestaRaw)) {
      respuestaRaw = respuestaRaw[Math.floor(Math.random() * respuestaRaw.length)];
    }

    const respuesta = this.personalizar(respuestaRaw);

    if (intencion === 'compra') ctx.etapa = 'pago_pendiente';
    if (intencion === 'post_pago') ctx.etapa = 'onboarding';
    if (intencion === 'agotado') ctx.etapa = 'lista_espera';

    return {
      mensaje: respuesta,
      etapa: ctx.etapa,
      intencion: intencion
    };
  }
}

module.exports = SOVYXIA2Conversor;
