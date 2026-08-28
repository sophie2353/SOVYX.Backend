const sovyxLogger = require('./sovyxLogger');

class SOVYXIA2Conversor {
  constructor(estilo = 'aggressive_closer') {
    this.name = "SODIE IA2";
    this.estilo = estilo;
    this.contexto = {}; 

    // Botones predeterminados de respuesta rápida
    this.defaultQuickReplies = [
      { label: "¿Cómo funciona?", payload: "como_funciona" },
      { label: "Protocolo Ecommerce (100K€)", payload: "ecommerce" },
      { label: "Métodos de pago", payload: "metodos_pago" },
      { label: "Reservar slot ($1,000)", payload: "acceder" }
    ];

    this.plantillas = {
      "hola": [
        "Gracias por confirmar que este software funciona, ¿qué preguntas tienes?\n\nQuedan solo 2 cupos disponibles para la infraestructura esta semana. La oferta es simple: $1,000 de acceso inicial y $9,000 cuando veas los resultados en 48 horas ($10,000 USD total). ¿Tienes el Ads Manager listo?"
      ],

      "cuanto_cuesta": [
        "El costo total son $10,000 USD. Pagas $1,000 para reservar 1 de los 2 cupos y activar el despliegue. Los $9,000 restantes los liquidas a las 48H directamente del retorno de las ventas que SOVYX te genera."
      ],

      "como_funciona": [
        "El proceso de integración es de precisión militar:\n1️⃣ Reservas 1 de los 2 cupos pagando $1,000 (Tarjeta o Apple Pay).\n2️⃣ Subes la hoja de cálculo exportada de Shopify/CRM con tu data de compradores previos para calibración espejo (IA1 + IA3).\n3️⃣ Inyectas la pauta y corremos durante 48H.\n4️⃣ Al validar la aceleración de ventas en tu panel, liquidas los $9,000 finales."
      ],

      "despues_de_pagar": [
        "Inmediatamente confirmes tus $1,000 de reserva:\n1️⃣ Te agregas como evaluador en Facebook y conectas tu cuenta.\n2️⃣ Subes tu lista de compradores previos exportada de Shopify para iniciar la inyección de datos.\n3️⃣ En 24 horas ves los primeros resultados antes de actualizar el borrador de hora 24 a 48. Sin vueltas."
      ],

      "metodos_pago": [
        "Puedes procesar el pago inicial de $1,000 con Tarjeta de Crédito/Débito Internacional o Apple Pay. Para la liquidación final de $9,000 se habilita la pasarela de cripto/transferencia directa al confirmar resultados."
      ],

      "Ecommerce": [
        "Para alcanzar los 100K€ este mes con un producto de 27€ necesitas 3.700 ventas. Con el método tradicional de Meta Ads vas a quemar más de 25.000€ intentando que el Píxel aprenda a quién venderle. No tienes 90 días para especular; te quedan menos de 20. Este es el protocolo de aceleración con SOVYX:\n\n" +
        "• Acceso y Prueba (48 Horas): Inyectas la data de tus compradores validados y activas 1.000€/día en anuncios como lo vienes haciendo.\n" +
        "• Clonación de Audiencia: SODIE multiplica cada comprador real en 100 perfiles idénticos de alta conversión.\n" +
        "• Validación Condicionada: Si en 48 horas confirmas la aceleración de ventas en tu panel, liquidas los $9.000 del software. Si no hay resultados, te detienes ahí solo con los 1.000$ de acceso.\n" +
        "• Escalado a 100K€: 5K$ de entrada a esta fase y con cada venta nueva procesada cada 24 horas, la IA recalibra el motor para mantener el costo de adquisición congelado o más bajo mientras alcanzas las 3.700 ventas.\n" +
        "• Comisión de Rendimiento: Al alcanzar la meta de los 100K€ en el mes, se aplica un 15% de comisión sobre el resultado generado.\n" +
        "• Capacidad Limitada del Servidor: Al ingresar tu tienda, serías el último en acceder para destinar toda la capacidad de cómputo a tus resultados y a los del cliente ya activo.\n" +
        "• Otra opción: 5K$ + 500$/día en ads en una tienda nueva con producto validado antes con miles de compras donde todo lo facturado me quedo con el 20% 🗿\n\n" +
        "Si tienes la lista de compradores lista, el servidor puede iniciar la inyección de datos inmediatamente después de ingresar como evaluador en Facebook, conectarlo y luego subes la hoja de cálculo con los resultados previos exportándolos de Shopify.\n\n" +
        "Después, sigues el último paso y en 24 horas ves los primeros resultados antes de actualizar el borrador de hora 24 a 48."
      ],

      "objecion": [
        "Si $1,000 te parecen un obstáculo para escalar una oferta con un motor probado de clonación de audiencia, esta infraestructura no es para ti. Solo hay 2 cupos para no saturar cómputo. Si no reservas hoy, el contador llega a cero y la ruta se cierra."
      ],

      "acceder": [
        "Perfecto. Voy a habilitar tu checkout de reserva de $1,000. En cuanto el pago sea procesado, el contador global restará 1 cupo de los 2 disponibles y desbloqueará el cargador de Shopify. ¿Listo para el enlace? 🚀"
      ],

      "default": [
        "Quedan solo 2 cupos en el servidor para mantener el procesamiento dedicado. ¿Vas a reservar tu slot con los $1,000 iniciales o dejas pasar la capacidad de cómputo? 👺"
      ]
    };

    this.patronesIntencion = {
      saludo: ['hola', 'hey', 'buenos dias', 'que tal', 'buenas', 'inicio', 'comenzar'],
      precio: ['precio', 'cuesta', 'valor', 'inversion', 'cuanto', 'costo', '10000', '1000', '9000'],
      ecommerce: ['ecommerce', 'tienda', 'shopify', '100k', '27', 'producto', 'clonacion', 'comisiones'],
      como_funciona: ['como funciona', 'explica', 'proceso', 'como es', 'pasos', 'protocolo'],
      despues_de_pagar: ['despues de pagar', 'que hago despues', 'que sigue', 'luego de pagar', 'pague', 'evaluador'],
      metodos_pago: ['pago', 'tarjeta', 'apple pay', 'como pago', 'transferencia', 'checkout', 'kontigo', 'cripto'],
      objecion: ['caro', 'riesgo', 'seguro', 'perder', 'lo pienso', 'garantia'],
      acceder: ['quiero entrar', 'acceder', 'comprar', 'pagar', 'reserva', 'cupo', 'enlace', 'link']
    };
  }

  detectarIntencion(mensaje, payload, tipo) {
    if (tipo === 'ecommerce' || payload === 'ecommerce') return 'ecommerce';
    if (payload && this.plantillas[payload]) return payload;

    const m = (mensaje || '').toLowerCase();
    for (const [intencion, patrones] of Object.entries(this.patronesIntencion)) {
      if (patrones.some(p => m.includes(p))) return intencion;
    }
    return 'default';
  }

  async generarRespuesta({ mensaje, sessionId, payload, tipo }) {
    if (!this.contexto[sessionId]) this.contexto[sessionId] = { etapa: "inicio" };
    
    let intencion = this.detectarIntencion(mensaje, payload, tipo);
    let respuestaRaw = this.plantillas[intencion] || this.plantillas.default;
    
    if (Array.isArray(respuestaRaw)) {
      respuestaRaw = respuestaRaw[Math.floor(Math.random() * respuestaRaw.length)];
    }

    let quickReplies = [...this.defaultQuickReplies];
    if (intencion === 'acceder') {
      quickReplies = [
        { label: "Checkout Reserva ($1,000)", payload: "checkout_link" },
        { label: "¿Qué hago después de pagar?", payload: "despues_de_pagar" }
      ];
    } else if (intencion === 'ecommerce') {
      quickReplies = [
        { label: "Reservar Slot ($1,000)", payload: "acceder" },
        { label: "¿Qué hago después de pagar?", payload: "despues_de_pagar" }
      ];
    }

    return {
      mensaje: respuestaRaw,
      intencion: intencion,
      quickReplies: quickReplies
    };
  }
}

module.exports = SOVYXIA2Conversor;
