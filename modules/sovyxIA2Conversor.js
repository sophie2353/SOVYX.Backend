// modules/sovyxIA2Conversor.js
const sovyxLogger = require('./sovyxLogger');

class SOVYXIA2Conversor {
  constructor(estilo = 'aggressive_closer') {
    this.name = "SOVYX IA2";
    this.estilo = estilo;
    this.contexto = {}; 
    
    // Botones predeterminados de respuesta rápida
    this.defaultQuickReplies = [
      { label: "¿Cómo funciona?", payload: "como_funciona" },
      { label: "¿Qué debo hacer después de pagar?", payload: "despues_de_pagar" },
      { label: "Métodos de pago", payload: "metodos_pago" },
      { label: "Reservar slot ($1,000)", payload: "acceder" }
    ];

    this.plantillas = {
      "hola": [
        "Gracias por confirmar que este software funciona, ¿qué preguntas tienes? 🗿\n\nQuedan solo 4 cupos disponibles para la infraestructura esta semana. La oferta es simple: $1,000 de acceso inicial y $4,000 cuando veas los resultados en 48 horas. ¿Tienes el Ads Manager listo?"
      ],
      
      "cuanto_cuesta": [
        "El costo total son $5,000. Pagas $1,000 para reservar 1 de los 4 cupos y activar el despliegue. Los $4,000 restantes los pagas a las 48H directamente del retorno de las ventas que SOVYX te genera. 🫦💅🏽"
      ],
      
      "como_funciona": [
        "El proceso de integración es de precisión militar:\n1️⃣ Reservas 1 de los 4 cupos pagando $1,000 (Tarjeta o Apple Pay).\n2️⃣ Subes el archivo CSV con tu data de clientes anteriores para calibración espejo (IA1 + IA3).\n3️⃣ Corremos la pauta con $100/día durante 48H.\n4️⃣ Al caer las ventas High Ticket, liquidas los $4,000 finales. 😮‍💨"
      ],

      "despues_de_pagar": [
        "Inmediatamente confirmes tus $1,000 de reserva:\n1️⃣ Se desbloquea la sección de carga de data en tu panel.\n2️⃣ Subes tu lista CSV de clientes y la IA1 arma el borrador exacto en tu Meta Ads.\n3️⃣ Das el clic final de aprobación para lanzar las campañas en borrador. Sin vueltas. 🚀"
      ],
      
      "metodos_pago": [
        "Puedes procesar el pago inicial de $1,000 con Tarjeta de Crédito/Débito Internacional o mediante Apple Pay. El slot se descuenta en tiempo real del contador global en la web al confirmarse el cobro. 💳🍎"
      ],
      
      "objecion": [
        "Si $1,000 te parecen un obstáculo para escalar una oferta High Ticket con un motor probado, esta infraestructura no es para ti. No reservo cupos sin pago. Hay otros usuarios viendo la pantalla ahora mismo. 🥱",
        "Solo abro 4 cupos porque la optimización en las primeras 48H requiere procesamiento dedicado. Si no reservas hoy, el contador llega a cero y la ruta se cierra. 👺"
      ],
      
      "acceder": [
        "Perfecto. Voy a habilitar tu checkout de reserva de $1,000. En cuanto el pago sea procesado, el contador global restará 1 cupo y podrás subir tu data de clientes. ¿Listo para el enlace de pago? 🚀"
      ],

      "default": [
        "Quedan pocos cupos en el panel. ¿Vas a reservar tu slot de 48H con los $1,000 iniciales o dejas pasar el tráfico? 👺"
      ]
    };

    this.patronesIntencion = {
      saludo: ['hola', 'hey', 'buenos dias', 'que tal', 'buenas', 'inicio', 'comenzar'],
      precio: ['precio', 'cuesta', 'valor', 'inversion', 'cuanto', 'costo', '5000', '1000', '4000'],
      como_funciona: ['como funciona', 'explica', 'proceso', 'como es', 'pasos'],
      despues_de_pagar: ['despues de pagar', 'que hago despues', 'que sigue', 'luego de pagar', 'pague'],
      metodos_pago: ['pago', 'tarjeta', 'apple pay', 'como pago', 'transferencia', 'checkout', 'stripe'],
      objecion: ['caro', 'riesgo', 'seguro', 'perder', 'lo pienso', 'garantia'],
      acceder: ['quiero entrar', 'acceder', 'comprar', 'pagar', 'reserva', 'cupo', 'enlace', 'link']
    };
  }

  detectarIntencion(mensaje, payload) {
    // Si el frontend envía directamente el identificador del botón (payload), lo usa directamente
    if (payload && this.plantillas[payload]) {
      return payload;
    }

    const m = (mensaje || '').toLowerCase();
    for (const [intencion, patrones] of Object.entries(this.patronesIntencion)) {
      if (patrones.some(p => m.includes(p))) return intencion;
    }
    return 'default';
  }

  async generarRespuesta({ mensaje, sessionId, payload }) {
    if (!this.contexto[sessionId]) this.contexto[sessionId] = { etapa: "inicio" };
    
    let intencion = this.detectarIntencion(mensaje, payload);
    let respuestaRaw = this.plantillas[intencion] || this.plantillas.default;
    
    if (Array.isArray(respuestaRaw)) {
      respuestaRaw = respuestaRaw[Math.floor(Math.random() * respuestaRaw.length)];
    }

    // Adaptar los botones dinámicamente si el usuario da clic en "Reservar"
    let quickReplies = [...this.defaultQuickReplies];
    if (intencion === 'acceder') {
      quickReplies = [
        { label: "💳 Ir al Checkout ($1,000)", payload: "checkout_link" },
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
