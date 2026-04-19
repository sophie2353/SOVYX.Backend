// modules/sovyxIA2Conversor.js
const sovyxLogger = require('./sovyxLogger');
const config = require('../config/tokens'); 

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
        "La inversión en la infraestructura completa de SOVYX es de ${precio}. Esto incluye el despliegue de las 3 IAs y 11 meses de desarrollo técnico a tu servicio. ¿Ves el ROI que esto genera en tu nicho?",
        "Son ${precio} (Pago único). Actualmente solo nos quedan ${slots} slots disponibles porque el despliegue es personalizado. ¿Estás listo para este nivel de escala?"
      ],
      
      "como_funciona": [
        "Es un ecosistema de 3 núcleos:\n1️⃣ IA1: Filtra solo gente con alto poder adquisitivo.\n2️⃣ IA2: Filtra y cierra por ti en DMs (como ahora).\n3️⃣ IA3: Analiza cada venta y optimiza a las otras dos.\n\nBásicamente, tú solo subes el contenido y la máquina hace el resto. 🚀"
      ],
      
      "resultados": [
        "Los resultados los tienes en mis historias. He decidido arriesgar mi propia marca para demostrar que las IAs venden solas antes de pedírtelo a ti. El sistema funciona, punto. ¿Quieres ser uno de los ${slots} elegibles?"
      ],
      
      "caro": [
        "Caro es seguir perdiendo el 90% de tus leads por no responder a tiempo o segmentar mal. SOVYX trabaja 24/7 sin sueldo. Si haces 2 ventas High Ticket, ya recuperaste la inversión. ¿Lo ves así?",
        "Entiendo. Pero esto no es un gasto, es infraestructura. Una agencia te cobraría eso mensualmente. Aquí lo pagas una vez. ¿Prefieres cantidad o tecnología que cierre?"
      ],
      
      "compra": [
        "Excelente. Para asegurar tu slot (recuerda que solo quedan ${slots}), procesa el pago aquí: ${paymentLink}\n\n⚠️ NOTA: El sistema valida transacciones automáticamente. Envíame el comprobante por aquí en cuanto lo tengas para entregarte tu acceso VIP."
      ],

      "agotado": [
        "Lo siento, acabamos de asignar el último slot de infraestructura disponible para este ciclo. 🚫\n\nSin embargo, por el nivel de interés que mostraste, puedo darte acceso a la **Lista de Espera VIP**. Si alguien no concreta su pago en las próximas 24h o para el lanzamiento de SOEDITIA, serás el primero en la fila.\n\nRegístrate aquí para guardar tu prioridad: ${linkFormulario}"
      ],
      
      "post_pago": [
        "✅ ¡Pago detectado en el núcleo! 🎉\n\nBienvenido a la infraestructura SOVYX. Ahora el paso definitivo:\n\n📋 Completa este formulario de activación: ${linkFormulario}\n\nEn cuanto lo envíes, mi núcleo generativo analizará tu contenido y te enviará una estrategia de historias por IG para que empecetes HOY. \n\nMientras tanto, configuraré tu acceso a Meta para que tú mismo pongas tu tarjeta. ¿Hacemos historia?"
      ],
      
      "default": [
        "Cuéntame, ¿cuál es tu mayor cuello de botella ahora: captar leads o cerrarlos? SOVYX resuelve ambos.",
        "Entiendo. Pero dime, ¿estás buscando un curso o un sistema que trabaje por ti?"
      ]
    };

    this.patronesIntencion = {
      saludo: ['hola', 'hey', 'hi', 'buenos dias', 'que tal'],
      precio: ['precio', 'cuesta', 'valor', 'inversión', 'cuanto', 'costo'],
      como_funciona: ['como funciona', 'explica', 'proceso', 'como es'],
      resultados: ['resultado', 'logrado', 'casos', 'ejemplos'],
      objecion: ['caro', 'mucho', 'no tengo', 'no me alcanza', 'dinero'],
      compra: ['pagar', 'comprar', 'quiero entrar', 'acceder', 'link de pago', 'enlace de pago'],
      post_pago: ['ya pague', 'listo el pago', 'pago realizado', 'aqui esta el comprobante', 'comprobante']
    };
  }

  detectarIntencion(mensaje) {
    const m = mensaje.toLowerCase();
    for (const [intencion, patrones] of Object.entries(this.patronesIntencion)) {
      if (patrones.some(p => m.includes(p))) return intencion;
    }
    return 'default';
  }

  // MÉTODO MAESTRO: Decide links de pago y formularios dinámicamente
  personalizar(txt) {
    const slots = config.sovyx.slotsRestantes;
    let paymentLink = "";
    let formLink = config.forms.onboardingVIP;

    // Lógica de Doble Pasarela
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

    // Si no hay cupos y quiere comprar, forzamos la plantilla de agotado
    if (intencion === 'compra' && slots <= 0) {
      intencion = 'agotado';
    }

    let clavePlantilla = intencion;
    if (intencion === 'objecion') clavePlantilla = 'caro';

    let respuestaRaw = this.plantillas[clavePlantilla] || this.plantillas.default;
    
    if (Array.isArray(respuestaRaw)) {
      respuestaRaw = respuestaRaw[Math.floor(Math.random() * respuestaRaw.length)];
    }

    const respuesta = this.personalizar(respuestaRaw);

    // Actualización de etapa
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
