const express = require('express');
const router = express.Router();
const sovyxLogger = require('./sovyxLogger');

class SOVYXIA2Conversor {
  constructor(estilo = 'aggressive_closer') {
    this.name = "SODIE IA2";
    this.estilo = estilo;
    this.contexto = {}; 

    // Botones predeterminados de respuesta rápida
    this.defaultQuickReplies = [
      { label: "¿Cómo funciona?", payload: "como_funciona" },
      { label: "SODIE vs SaaS / Agencias", payload: "comparacion" },
      { label: "Protocolo Ecommerce (100K€)", payload: "ecommerce" },
      { label: "Reservar slot ($1,000)", payload: "acceder" }
    ];

    this.plantillas = {
      "hola": [
        "Gracias por confirmar que este software funciona, ¿qué preguntas tienes?\n\nQuedan solo 2 cupos disponibles para evaluadores (máximo 20 cuentas activas). La oferta es simple: $1,000 de acceso inicial y $9,000 cuando veas los resultados en 48 horas ($10,000 USD total). ¿Tienes el Ads Manager listo?"
      ],

      "cuanto_cuesta": [
        "El costo total son $10,000 USD. Pagas $1,000 para reservar 1 de los 2 cupos iniciales para evaluadores y activar el despliegue. Los $9,000 restantes los liquidas a las 48H en 3 partes por Binance Pay directamente de un porcentaje del retorno de las ventas que SODIE te genera."
      ],

      "como_funciona": [
        "1. Las herramientas de contenido te ayudan a redactar o diseñar más rápido, pero no evitan que quemes presupuesto en pauta. Si lanzas 50 anuncios generados por IA a una audiencia mal segmentada, solo estás quemando tu dinero a mayor velocidad. SODIE no resuelve un problema de redacción; resuelve la ineficiencia de tu gasto publicitario.\n\n" +
        "El proceso de integración es de precisión militar:\n" +
        "1️⃣ Reservas 1 de los 2 cupos para evaluadores ($1,000).\n" +
        "2️⃣ Subes la hoja de cálculo exportada de Shopify/CRM con tu data de compradores previos para calibración espejo (IA1 + IA3).\n" +
        "3️⃣ En 10 minutos, sin tocar tu tarjeta ni tus creativos, la inteligencia de datos valida tu estructura publicitaria para buscar retornos de 5x a 10x desde el día uno.\n" +
        "4️⃣ Al validar la aceleración de ventas en 48H, liquidas los $9,000 finales."
      ],

      "comparacion": [
        "Comparemos estas dos opciones:\n" +
        "1. SaaS de Contenido (Low-Ticket): Ahorra $200 al mes en un diseñador o copywriter. Le entrega un archivo que el cliente aún debe configurar, testear y optimizar manualmente.\n" +
        "2. SODIE: Evita perder $3,000 o $5,000 en campañas publicitarias fallidas y acelera el tiempo a retorno de 90 días a 10 minutos.\n\n" +
        "Las agencias tradicionales te cobran un fee mensual para pasar 90 días haciendo pruebas manuales con un ROAS mediocre de 2x. Las herramientas de IA masivas te dan textos e imágenes para que tú hagas todo el trabajo pesado. Lo que SODIE entrega es infraestructura de conversión: en 10 minutos, sin tocar tu tarjeta ni tus creativos, la inteligencia de datos valida tu estructura publicitaria para buscar retornos de 5x a 10x desde el día uno."
      ],

      "diferencia_herramientas": [
        "Si estás buscando una herramienta de $30 dólares al mes para generar publicaciones de redes sociales, hay cientos en el mercado. SODIE es exclusivo para negocios que manejan presupuesto publicitario real, entienden el costo de oportunidad de esperar meses por resultados y necesitan eficiencia de capital inmediata. Por estabilidad y rendimiento del algoritmo, solo operamos con un máximo de 20 cuentas activas con 2 inicialmente para evaluadores."
      ],

      "despues_de_pagar": [
        "Inmediatamente confirmes tus $1,000 de reserva:\n1️⃣ Te agregas como evaluador en Facebook y conectas tu cuenta.\n2️⃣ Subes tu lista de compradores previos exportada de Shopify para iniciar la inyección de datos.\n3️⃣ En 24 horas ves los primeros resultados antes de actualizar el borrador de hora 24 a 48. Sin vueltas."
      ],

      "metodos_pago": [
        "Puedes procesar el pago inicial de $1,000 con Tarjeta de Crédito/Débito Internacional o Apple Pay. Para la liquidación final de $9,000 se habilita la pasarela de cripto/transferencia directa al confirmar resultados."
      ],

      "ecommerce": [
        "Para alcanzar los 100K€ este mes con un producto de 27€ necesitas 3.700 ventas. Con el método tradicional de Meta Ads vas a quemar más de 25.000€ intentando que el Píxel aprenda a quién venderle. No tienes 90 días para especular; te quedan menos de 20. Este es el protocolo de aceleración con SODIE:\n\n" +
        "• Acceso y Prueba (48 Horas): Inyectas la data de tus compradores validados y activas 1.000€/día en anuncios como lo vienes haciendo.\n" +
        "• Clonación de Audiencia: SODIE multiplica cada comprador real en 100 perfiles idénticos de alta conversión.\n" +
        "• Validación Condicionada: Si en 48 horas confirmas la aceleración de ventas en tu panel, liquidas los $9.000 del software. Si no hay resultados, te detienes ahí solo con los 1.000$ de acceso.\n" +
        "• Escalado a 100K€: 5K$ de entrada a esta fase y con cada venta nueva procesada cada 24 horas, la IA recalibra el motor para mantener el costo de adquisición congelado o más bajo mientras alcanzas las 3.700 ventas.\n" +
        "• Comisión de Rendimiento: Al alcanzar la meta de los 100K€ en el mes, se aplica un 15% de comisión sobre el resultado generado.\n" +
        "• Capacidad Limitada del Servidor: Al ingresar tu tienda, serías el último en acceder para destinar toda la capacidad de cómputo a tus resultados (máximo 20 cuentas activas, 2 inicialmente para evaluadores).\n\n" +
        "Si tienes la lista de compradores lista, el servidor puede iniciar la inyección de datos inmediatamente después de ingresar como evaluador en Facebook y conectar la cuenta."
      ],

      "objecion": [
        "Si $1,000 te parecen un obstáculo para escalar una oferta con un motor probado de clonación de audiencia, esta infraestructura no es para ti. SODIE es exclusivo para negocios que manejan presupuesto real. Por rendimiento del algoritmo, solo operamos con un máximo de 20 cuentas activas (2 para evaluadores)."
      ],

      "acceder": [
        "Perfecto. Voy a habilitar tu checkout de reserva de $1,000. En cuanto el pago sea procesado, el contador global restará 1 cupo de los 2 disponibles para evaluadores y desbloqueará el cargador de Shopify. ¿Listo para el enlace? 🚀"
      ],

      "default": [
        "SODIE no es una herramienta de $30 dólares para publicaciones; es infraestructura de conversión que evita perder miles en campañas fallidas. Solo operamos con un máximo de 20 cuentas activas con 2 inicialmente para evaluadores. ¿Vas a reservar tu slot con los $1,000 iniciales o dejas pasar la capacidad de cómputo? 👺"
      ]
    };

    this.patronesIntencion = {
      saludo: ['hola', 'hey', 'buenos dias', 'que tal', 'buenas', 'inicio', 'comenzar'],
      precio: ['precio', 'cuesta', 'valor', 'inversion', 'cuanto', 'costo', '10000', '1000', '9000'],
      ecommerce: ['ecommerce', 'tienda', 'shopify', '100k', '27', 'producto', 'clonacion', 'comisiones'],
      como_funciona: ['como funciona', 'explica', 'proceso', 'como es', 'pasos', 'protocolo'],
      comparacion: ['comparacion', 'comparar', 'saas', 'agencia', 'agencias', 'copywriter', 'diseñador', 'roas', 'fee', 'low-ticket', 'low ticket'],
      diferencia_herramientas: ['30', 'herramienta', 'barato', 'redes sociales', 'publicaciones', 'contenido', 'creativos', 'redaccion'],
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
    } else if (intencion === 'comparacion' || intencion === 'diferencia_herramientas') {
      quickReplies = [
        { label: "¿Cómo funciona?", payload: "como_funciona" },
        { label: "Reservar Slot ($1,000)", payload: "acceder" }
      ];
    }

    return {
      mensaje: respuestaRaw,
      intencion: intencion,
      quickReplies: quickReplies
    };
  }
}

const ia2Instance = new SOVYXIA2Conversor();

// Enrutador compatible con express app.use('/api/ia2', ia2Module)
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

    if (sovyxLogger && sovyxLogger.info) {
      sovyxLogger.info('IA2 Respuesta Generada', { intencion: result.intencion, sessionId });
    }

    return res.json({
      success: true,
      reply: result.mensaje,      // Leído por app.js
      response: result.mensaje,   // Fallback app.js
      mensaje: result.mensaje,    // Fallback nativo
      text: result.mensaje,       // Fallback
      intencion: result.intencion,
      quickReplies: result.quickReplies,
      status: 'ACTIVE'
    });
  } catch (error) {
    if (sovyxLogger && sovyxLogger.error) {
      sovyxLogger.error('Error en ejecución de IA2', { error: error.message });
    }
    return res.status(500).json({ 
      success: false, 
      error: 'Falla al procesar la respuesta en IA2: ' + error.message 
    });
  }
});

module.exports = router;
