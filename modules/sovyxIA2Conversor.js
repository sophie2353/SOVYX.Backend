// modules/sovyxIA2Conversor.js
const sovyxLogger = require('./sovyxLogger');
const config = require('../config/tokens'); // Importamos la configuración centralizada

class SOVYXIA2Conversor {
  constructor(estilo = 'high_ticket_client') {
    this.name = "SOVYX IA2";
    this.estilo = estilo;
    this.contexto = {}; 
    this.linkFormulario = 'https://forms.gle/W9BXc4bmHb2EHifg8';
    // Extraemos el link de Kontigo directamente desde el config
    this.linkKontigo = config.payments.kontigo; 
    
    this.plantillas = {
      "hola": [
        "¡Hey! ¿Cómo vas? Veo que te interesa escalar con infraestructura de IA. ¿Qué es lo que más te llamó la atención de SOVYX? 🦁",
        "Hola. Directo al grano: SOVYX no es un curso, es un sistema que montamos por ti. ¿Qué duda específica tienes?"
      ],
      
      "cuánto cuesta": [
        "La inversión en la infraestructura completa de SOVYX es de ${precio}. Esto incluye el despliegue de las 3 IAs y 11 meses de desarrollo técnico a tu servicio. ¿Ves el ROI que esto genera en tu nicho?",
        "Son ${precio} (Pago único). Actualmente solo nos quedan 4 slots disponibles para este mes porque el despliegue es personalizado. ¿Estás listo para este nivel de escala?"
      ],
      
      "como_funciona": [
        "Es un ecosistema de 3 núcleos:\n1️⃣ IA1: Filtra solo gente con alto poder adquisitivo.\n2️⃣ IA2: Filtra y cierra por ti en DMs (como ahora).\n3️⃣ IA3: Analiza cada venta y optimiza a las otras dos.\n\nBásicamente, tú solo subes el contenido y la máquina hace el resto. 🚀"
      ],
      
      "resultados": [
        "Los resultados los tienes en mis historias. He decidido arriesgar mi propia marca para demostrar que las IAs venden solas antes de pedírtelo a ti. El sistema funciona, punto. ¿Quieres ser uno de los 4 de este mes?"
      ],
      
      "caro": [
        "Caro es seguir perdiendo el 90% de tus leads por no responder a tiempo o segmentar mal. SOVYX trabaja 24/7 sin sueldo. Si haces 2 ventas High Ticket, ya recuperaste la inversión. ¿Lo ves así?",
        "Entiendo. Pero esto no es un gasto, es infraestructura. Una agencia te cobraría eso mensualmente. Aquí lo pagas una vez. ¿Prefieres cantidad o tecnología que cierre?"
      ],
      
      "compra": [
        "Excelente. Para asegurar tu slot (recuerda que solo quedan 4), procesa el pago aquí: ${paymentLink}\n\n⚠️ IMPORTANTE: Solo aceptamos Binance Pay por velocidad de activación. Envíame el comprobante por aquí en cuanto lo tengas para pasarte el Formulario de Onboarding."
      ],
      
      "post_pago": [
        "✅ ¡Pago detectado por el sistema! 🎉\n\nBienvenido a la infraestructura SOVYX. Ahora el paso más importante:\n\n📋 Completa este formulario de activación: ${linkFormulario}\n\nAhí me enviarás el link de tu material/curso. En cuanto lo envíes, mi núcleo generativo analizará tu contenido y te enviará una estrategia de historias por correo e IG para que empieces HOY. \n\nMientras tú haces eso, yo configuraré manualmente tu acceso a la App de Meta para que tú mismo pongas tu tarjeta y lancemos. ¿Hacemos que suceda?"
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
      pensando: ['pensar', 'decidir', 'ver', 'duda'],
      compra: ['pagar', 'comprar', 'quiero entrar', 'acceder', 'link de pago'],
      post_pago: ['ya pague', 'listo el pago', 'pago realizado', 'aqui esta el comprobante', 'comprobante']
    };
  }

  // ============================================
  // PROCESAMIENTO
  // ============================================
  
  async iniciarContexto(clienteId) {
    this.contexto[clienteId] = {
      etapa: "inicio",
      historial: []
    };
    return this.contexto[clienteId];
  }

  detectarIntencion(mensaje) {
    const m = mensaje.toLowerCase();
    for (const [intencion, patrones] of Object.entries(this.patronesIntencion)) {
      if (patrones.some(p => m.includes(p))) return intencion;
    }
    return 'default';
  }

  personalizar(txt) {
    return txt
      .replace(/\${precio}/g, '5,000 USDT')
      .replace(/\${paymentLink}/g, this.linkKontigo) // Inyecta el link de Kontigo directamente
      .replace(/\${linkFormulario}/g, this.linkFormulario);
  }

  async generarRespuesta({ mensaje, usuario }) {
    const clienteId = usuario?.id || 'unknown';
    if (!this.contexto[clienteId]) await this.iniciarContexto(clienteId);
    
    const ctx = this.contexto[clienteId];
    const intencion = this.detectarIntencion(mensaje);
    
    // Mapeo corregido para usar las plantillas de arriba
    let clavePlantilla = intencion;
    if (intencion === 'como_funciona') clavePlantilla = 'como_funciona';
    if (intencion === 'objecion') clavePlantilla = 'caro';
    if (intencion === 'compra') clavePlantilla = 'compra';

    let respuestaRaw = this.plantillas[clavePlantilla] || this.plantillas.default;
    
    if (Array.isArray(respuestaRaw)) {
      respuestaRaw = respuestaRaw[Math.floor(Math.random() * respuestaRaw.length)];
    }

    const respuesta = this.personalizar(respuestaRaw);

    // Lógica de avance de etapa
    if (intencion === 'compra') ctx.etapa = 'pago_pendiente';
    if (intencion === 'post_pago') ctx.etapa = 'onboarding';

    return {
      mensaje: respuesta,
      etapa: ctx.etapa,
      intencion: intencion
    };
  }
}

module.exports = SOVYXIA2Conversor;
