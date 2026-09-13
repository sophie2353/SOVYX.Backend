const express = require('express');
const router = express.Router();

class SOVYXIA2Conversor {
  constructor(estilo = 'aggressive_closer') {
    this.name = "SODIE IA2";
    this.estilo = estilo;
    this.contexto = {}; 

    // Botones predeterminados de respuesta rápida
    this.defaultQuickReplies = [
      { label: "¿Cómo crear cuenta en Binance?", payload: "crear_binance" },
      { label: "¿Cómo recargar en Binance?", payload: "recargar_binance" },
      { label: "¿3 Cuotas?", payload: "tres_cuotas" },
      { label: "¿Cómo funciona?", payload: "como_funciona" },
      { label: "SODIE vs SaaS / Agencias", payload: "comparacion" },
      { label: "Protocolo Ecommerce (100K€)", payload: "ecommerce" },
      { label: "Reservar slot ($1,000)", payload: "acceder" }
    ];

    this.plantillas = {
      "hola": [
        "Gracias por confirmar que este software funciona, ¿qué preguntas tienes?\n\nQuedan solo 2 cupos disponibles para evaluadores (máximo 20 cuentas activas). La oferta es simple: $1,000 de acceso inicial y $9,000 cuando veas los resultados en 48 horas ($10,000 USD total). ¿Tienes el Ads Manager listo?"
      ],

      "crear_binance": [
        "Descargas la aplicación, creas el perfil, verificas identidad y recargas. Máximo toma 20 minutos.",
        "Serán solo 3 transacciones si no tienes cuenta Binance, SODIE genera resultados desde la primera hora. ¿Quieres saber cómo se recarga?",
        "Tienes esa opción, seguir perdiendo dinero en ads o, que alguien decida reservar su cupo mientras dudas.",
        "Si quieres saber el porqué usar Binance para los 2 evaluadores, puedes dar clic al enlace de Términos y Datos abajo del Formulario después de dar clic en Pagar en la tarjeta final."
      ],

      "recargar_binance": [
        "Se puede recargar de las siguientes formas:\n\n1. P2P: Haces una transferencia bancaria a un tercero y recargas tu wallet.\n2. Tarjeta internacional: Recargas directamente desde tarjeta.",
        "Al pagar en la hora 48 es solo iniciar sesión y listo.",
        "Lo recomendable es recargar por parte los 9K$: tienes 96 horas, es decir 4 días donde puedes recargar 2.500$/día y los 1K$ restantes en Binance lo puedes retirar sin problema desde la propia plataforma.\n\nAunque, para cuentas verificadas el límite diario es más alto. Es recomendación por si se recarga con tarjeta internacional."
      ],

      "tres_cuotas": [
        "Existen 3 opciones de pago para la liquidación final:\n\n1. Pagar 3 cuotas (3.000$ c/u en Hora 48-72-96)\n2. Pagar 2 cuotas (6.000$ hora 48 y 3.000$ hora 72)\n3. Pagar 1 cuota (9.000$ Hora 48)",
        "El objetivo de las 3 cuotas y el porqué está establecida únicamente en el contrato es para recargar la cuenta Binance a medida que el software genera resultados y poder verificar cómo actúa la campaña sin SODIE activo.",
        "Ante cualquier cambio se deberá notificar previamente en la sección de pagos en vista del cliente y elegir la comodidad deseada."
      ],

      "cuanto_cuesta": [
        "El costo total son $10,000 USD. Pagas $1,000 para reservar 1 de los 2 cupos iniciales para evaluadores y activar el despliegue. Los $9,000 restantes los liquidas a las 48H en 3 partes por Binance Pay directamente de un porcentaje del retorno de las ventas que SODIE te genera."
      ],

      "como_funciona": [
        "Las herramientas de contenido te ayudan a redactar o diseñar más rápido, pero no evitan que quemes presupuesto en pauta. Si lanzas 50 anuncios generados por IA a una audiencia mal segmentada, solo estás quemando tu dinero a mayor velocidad. SODIE no resuelve un problema de redacción; resuelve la ineficiencia de tu gasto publicitario.",
        "El proceso de integración es de precisión militar:\n\n1️⃣ Reservas 1 de los 2 cupos para evaluadores ($1,000).\n2️⃣ Subes la hoja de cálculo exportada de Shopify/CRM con tu data de compradores previos para calibración espejo (IA1 + IA3).\n3️⃣ En 10 minutos, sin tocar tu tarjeta ni tus creativos, la inteligencia de datos valida tu estructura publicitaria para buscar retornos de 5x a 10x desde el día uno.\n4️⃣ Al validar la aceleración de ventas en 48H, liquidas los $9,000 finales."
      ],

      "comparacion": [
        "Comparemos estas dos opciones:\n\n1. SaaS de Contenido (Low-Ticket): Ahorra $200 al mes en un diseñador o copywriter. Le entrega un archivo que el cliente aún debe configurar, testear y optimizar manualmente.\n2. SODIE: Evita perder $3,000 o $5,000 en campañas publicitarias fallidas y acelera el tiempo a retorno de 90 días a 10 minutos.",
        "Las agencias tradicionales te cobran un fee mensual para pasar 90 días haciendo pruebas manuales con un ROAS mediocre de 2x. Las herramientas de IA masivas te dan textos e imágenes para que tú hagas todo el trabajo pesado.\n\nLo que SODIE entrega es infraestructura de conversión: en 10 minutos, sin tocar tu tarjeta ni tus creativos, la inteligencia de datos valida tu estructura publicitaria para buscar retornos de 5x a 10x desde el día uno."
      ],

      "diferencia_herramientas": [
        "Si estás buscando una herramienta de $30 dólares al mes para generar publicaciones de redes sociales, hay cientos en el mercado. SODIE es exclusivo para negocios que manejan presupuesto publicitario real, entienden el costo de oportunidad de esperar meses por resultados y necesitan eficiencia de capital inmediata.",
        "Por estabilidad y rendimiento del algoritmo, solo operamos con un máximo de 20 cuentas activas con 2 inicialmente para evaluadores."
      ],

      "cupo_3": [
        "El Cupo 3 significa empezar la lista de espera de 18 cupos que se activa la V4 en 14 días.",
        "Si ya están los 2 cupos disponibles, únete a la lista de espera y puedes ver la base de la V4 y resultados en tiempo real de los 2 evaluadores cerca del día 14.",
        "¿Quieres obtener un ROAS de 4 a 10 con SODIE o prefieres quedar fuera perdiendo miles al mes?"
      ],

      "despues_de_pagar": [
        "Inmediatamente confirmes tus $1,000 de reserva:\n\n1️⃣ Te agregas como evaluador en Facebook y conectas tu cuenta.\n2️⃣ Subes tu lista de compradores previos exportada de Shopify para iniciar la inyección de datos.\n3️⃣ En 24 horas ves los primeros resultados antes de actualizar el borrador de hora 24 a 48. Sin vueltas."
      ],

      "metodos_pago": [
        "Puedes procesar el pago inicial de $1,000 con Tarjeta de Crédito/Débito Internacional o Apple Pay.",
        "Para la liquidación final de $9,000 se habilita la pasarela de cripto (Binance Pay) / transferencia directa al confirmar resultados."
      ],

      "ecommerce": [
        "Para alcanzar los 100K€ este mes con un producto de 27€ necesitas 3.700 ventas. Con el método tradicional de Meta Ads vas a quemar más de 25.000€ intentando que el Píxel aprenda a quién venderle. No tienes 90 días para especular; te quedan menos de 20.",
        "Este es el protocolo de aceleración con SODIE:\n\n• Acceso y Prueba (48 Horas): Inyectas la data de tus compradores validados y activas 1.000€/día en anuncios como lo vienes haciendo.\n• Clonación de Audiencia: SODIE multiplica cada comprador real en 100 perfiles idénticos de alta conversión.\n• Validación Condicionada: Si en 48 horas confirmas la aceleración de ventas en tu panel, liquidas los $9.000 del software. Si no hay resultados, te detienes ahí solo con los 1.000$ de acceso.",
        "• Escalado a 100K€: 5K$ de entrada a esta fase y con cada venta nueva procesada cada 24 horas, la IA recalibra el motor para mantener el costo de adquisición congelado o más bajo mientras alcanzas las 3.700 ventas.\n• Comisión de Rendimiento: Al alcanzar la meta de los 100K€ en el mes, se aplica un 15% de comisión sobre el resultado generado.\n• Capacidad Limitada del Servidor: Al ingresar tu tienda, serías el último en acceder para destinar toda la capacidad de cómputo a tus resultados (máximo 20 cuentas activas, 2 inicialmente para evaluadores).",
        "Si tienes la lista de compradores lista, el servidor puede iniciar la inyección de datos inmediatamente después de ingresar como evaluador en Facebook y conectar la cuenta."
      ],

      "objecion": [
        "Si $1,000 te parecen un obstáculo para escalar una oferta con un motor probado de clonación de audiencia, esta infraestructura no es para ti.",
        "SODIE es exclusivo para negocios que manejan presupuesto real. Por rendimiento del algoritmo, solo operamos con un máximo de 20 cuentas activas (2 para evaluadores)."
      ],

      "acceder": [
        "Perfecto. Voy a habilitar tu checkout de reserva de $1,000.",
        "En cuanto el pago sea procesado, el contador global restará 1 cupo de los 2 disponibles para evaluadores y desbloqueará el cargador de Shopify. ¿Listo para el enlace? 🚀"
      ],

      "default": [
        "SODIE no es una herramienta de $30 dólares para publicaciones; es infraestructura de conversión que evita perder miles en campañas fallidas.",
        "Solo operamos con un máximo de 20 cuentas activas con 2 inicialmente para evaluadores. ¿Vas a reservar tu slot con los $1,000 iniciales o dejas pasar la capacidad de cómputo? 👺"
      ]
    };

    this.patronesIntencion = {
      saludo: ['hola', 'hey', 'buenos dias', 'que tal', 'buenas', 'inicio', 'comenzar'],
      crear_binance: ['crear binance', 'cuenta binance', 'crear cuenta en binance', 'como creo binance'],
      recargar_binance: ['recargar binance', 'como recargar', 'recargar wallet', 'p2p', 'tarjeta internacional binance'],
      tres_cuotas: ['3 cuotas', 'tres cuotas', 'cuotas', '6000', '3000', 'opciones de pago'],
      precio: ['precio', 'cuesta', 'valor', 'inversion', 'cuanto', 'costo', '10000', '1000', '9000'],
      ecommerce: ['ecommerce', 'tienda', 'shopify', '100k', '27', 'producto', 'clonacion', 'comisiones'],
      como_funciona: ['como funciona', 'explica', 'proceso', 'como es', 'pasos', 'protocolo'],
      comparacion: ['comparacion', 'comparar', 'saas', 'agencia', 'agencias', 'copywriter', 'diseñador', 'roas', 'fee', 'low-ticket', 'low ticket'],
      diferencia_herramientas: ['30', 'herramienta', 'barato', 'redes sociales', 'publicaciones', 'contenido', 'creativos', 'redaccion'],
      cupo_3: ['cupo 3', 'cupo3', 'tercer cupo', '3er cupo', 'lista de espera', 'v4', 'lleno', 'sin cupos'],
      despues_de_pagar: ['despues de pagar', 'que hago despues', 'que sigue', 'luego de pagar', 'pague', 'evaluador'],
      metodos_pago: ['pago', 'tarjeta', 'apple pay', 'como pago', 'transferencia', 'checkout', 'kontigo', 'cripto', 'binance pay'],
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
    
    // Normalizamos a un Array para soportar múltiples mensajes
    let mensajesArray = Array.isArray(respuestaRaw) ? respuestaRaw : [respuestaRaw];

    let quickReplies = [...this.defaultQuickReplies];
    if (intencion === 'acceder') {
      quickReplies = [
        { label: "Checkout Reserva ($1,000)", payload: "checkout_link" },
        { label: "¿Qué hago después de pagar?", payload: "despues_de_pagar" }
      ];
    } else if (intencion === 'crear_binance' || intencion === 'recargar_binance' || intencion === 'tres_cuotas') {
      quickReplies = [
        { label: "¿Cómo recargar en Binance?", payload: "recargar_binance" },
        { label: "¿3 Cuotas?", payload: "tres_cuotas" },
        { label: "Reservar slot ($1,000)", payload: "acceder" }
      ];
    } else if (intencion === 'ecommerce') {
      quickReplies = [
        { label: "Reservar Slot ($1,000)", payload: "acceder" },
        { label: "¿Qué hago después de pagar?", payload: "despues_de_pagar" }
      ];
    } else if (intencion === 'cupo_3') {
      quickReplies = [
        { label: "Unirme a Lista de Espera (V4)", payload: "cupo_3" },
        { label: "Reservar Slot ($1,000)", payload: "acceder" }
      ];
    } else if (intencion === 'comparacion' || intencion === 'diferencia_herramientas') {
      quickReplies = [
        { label: "¿Cómo funciona?", payload: "como_funciona" },
        { label: "Reservar Slot ($1,000)", payload: "acceder" }
      ];
    }

    return {
      messages: mensajesArray,                    // Múltiples mensajes
      mensaje: mensajesArray.join("\n\n"),        // Compatibilidad con clientes antiguos
      reply: mensajesArray.join("\n\n"),
      intencion: intencion,
      quickReplies: quickReplies
    };
  }
}

const ia2Instance = new SOVYXIA2Conversor();

router.post(['/conversar', '/message', '/'], async (req, res) => {
  try {
    const { message, mensaje, sessionId, payload, tipo } = req.body;
    const inputTexto = message || mensaje || '';

    const result = await ia2Instance.generarRespuesta({
      mensaje: inputTexto,
      sessionId: sessionId || 'sess_default',
      payload,
      tipo
    });

    return res.json({
      success: true,
      messages: result.messages,     // Array de mensajes
      reply: result.reply,
      response: result.mensaje,
      mensaje: result.mensaje,
      text: result.mensaje,
      intencion: result.intencion,
      quickReplies: result.quickReplies,
      status: 'ACTIVE'
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      error: 'Falla al procesar la respuesta en IA2: ' + error.message 
    });
  }
});

module.exports = router;
