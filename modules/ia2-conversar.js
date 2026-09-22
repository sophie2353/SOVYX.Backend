/**
 * SOVYX IA2 Conversor Engine
 * Versión Limpia (Sin Binance) & Actualización Cupo 4 / Pasarela Directa
 */
const express = require('express');
const router = express.Router();

class SOVYXIA2Conversor {
  constructor(estilo = 'aggressive_closer') {
    this.name = "SODIE IA2";
    this.estilo = estilo;
    this.contexto = {}; 

    // Botones predeterminados de respuesta rápida (Sin Binance, orientado a Pasarela Directa)
    this.defaultQuickReplies = [
      { label: "¿Opciones de pago en cuotas?", payload: "cuotas_pasarela" },
      { label: "¿Cómo funciona?", payload: "como_funciona" },
      { label: "SODIE vs SaaS / Agencias", payload: "comparacion" },
      { label: "Protocolo Ecommerce (100K€)", payload: "ecommerce" },
      { label: "Cupo 4 (Lista de Espera V4)", payload: "cupo_4" },
      { label: "Reservar slot ($7,000)", payload: "acceder" }
    ];

    this.plantillas = {
      "hola": [
        "Gracias por confirmar que este software funciona, ¿qué preguntas tienes?\n\nQuedan pocos cupos disponibles para evaluadores (máximo 10 cuentas activas después de los 2 evaluadores). La oferta es simple: $7,000 de acceso inicial y $18,000 dividido en 3 cuotas cuando veas los resultados ($25,000 USD total). ¿Tienes el Ads Manager listo?"
      ],



      "cuanto_cuesta": [
        "El costo total es de $25,000 USD. Pagas $7,000 mediante cripto para reservar tu cupo de evaluador y activar el despliegue. Los $18,000 restantes los liquidas a partir de cada 7 días directamente con el retorno de ventas que SODIE te genera."
      ],

      "como_funciona": [
        "Las herramientas de contenido te ayudan a redactar o diseñar más rápido, pero no evitan que quemes presupuesto en pauta. Si lanzas 50 anuncios generados por IA a una audiencia mal segmentada, solo estás quemando tu dinero a mayor velocidad. SODIE no resuelve un problema de redacción; resuelve la ineficiencia de tu gasto publicitario.",
        "El proceso de integración es de precisión militar:\n\n1️⃣ Reservas tu cupo inicial ($1,000).\n2️⃣ Subes la hoja de cálculo exportada de Shopify/CRM con tu data de compradores previos para calibración espejo (IA1 + IA3).\n3️⃣ En 10 minutos, sin tocar tu tarjeta ni tus creativos, la inteligencia de datos valida tu estructura publicitaria para buscar retornos de 5x a 10x desde el día uno.\n4️⃣ Al validar la aceleración de ventas en 48H, liquidas los $9,000 finales por pasarela."
      ],

      "comparacion": [
        "Comparemos estas dos opciones:\n\n1. SaaS de Contenido (Low-Ticket): Ahorra $200 al mes en un diseñador o copywriter. Le entrega un archivo que el cliente aún debe configurar, testear y optimizar manualmente.\n2. SODIE: Evita perder $3,000 o $5,000 en campañas publicitarias fallidas y acelera el tiempo a retorno de 90 días a 10 minutos.",
        "Las agencias tradicionales te cobran un fee mensual para pasar 90 días haciendo pruebas manuales con un ROAS mediocre de 2x. Las herramientas de IA masivas te dan textos e imágenes para que tú hagas todo el trabajo pesado.\n\nLo que SODIE entrega es infraestructura de conversión: en 10 minutos, sin tocar tu tarjeta ni tus creativos, la inteligencia de datos valida tu estructura publicitaria para buscar retornos de 5x a 10x desde el día uno."
      ],

      "diferencia_herramientas": [
        "Si estás buscando una herramienta de $30 dólares al mes para generar publicaciones de redes sociales, hay cientos en el mercado. SODIE es exclusivo para negocios que manejan presupuesto publicitario real, entienden el costo de oportunidad de esperar meses por resultados y necesitan eficiencia de capital inmediata.",
        "Por estabilidad y rendimiento del algoritmo, solo operamos con un máximo de 20 cuentas activas en total."
      ],

      "cupo_4": [
        "El Cupo 4 marca el inicio de la lista de espera para los 10 cupos restantes de la V4, que se activará en 28 días mínimo.",
        "Al elegir el Cupo 4 te unes a la lista de espera donde podrás seguir los resultados y métricas en tiempo real de los evaluadores iniciales antes del lanzamiento global de la V4.",
        "¿Quieres asegurar tu cupo evaluador ahora con SODIE o prefieres quedar en la lista de espera perdiendo tracción publicitaria?"
      ],

      "despues_de_pagar": [
        "Inmediatamente confirmes tus $7,000 de reserva:\n\n\n1️⃣Subes tu lista de compradores previos exportada de Shopify para iniciar la inyección de datos.2️⃣ Te agregas como evaluador en Facebook y conectas tu cuenta.\n3️⃣ En 24 horas ves los primeros resultados antes de actualizar el borrador de hora 24 a 48. Sin vueltas."
      ],

      "metodos_pago": [
        "Hay un solo 1 forma de pago para evaluadores y es mediante cripto. después del periodo de prueba, se podrá usar pasarela",
      ],

      "ecommerce": [
        "Para alcanzar los 100K€ este mes con un producto de 27€ necesitas 3,700 ventas. Con el método tradicional de Meta Ads vas a quemar más de 25,000€ intentando que el Píxel aprenda a quién venderle. No tienes 90 días para especular; te quedan menos de 20.",
        "Este es el protocolo de aceleración con SODIE:\n\n• Acceso y Prueba (48 Horas): Inyectas la data de tus compradores validados y activas 1,000€/día en anuncios como lo vienes haciendo.\n• Clonación de Audiencia: SODIE multiplica cada comprador real en 100 perfiles idénticos de alta conversión.\n• Validación Condicionada: Si en 48 horas confirmas la aceleración de ventas en tu panel, liquidas los $9,000 del software. Si no hay resultados, te detienes ahí solo con los $1,000 de acceso.",
        "• Escalado a 100K€: $5,000 de entrada a esta fase y con cada venta nueva procesada cada 24 horas, la IA recalibra el motor para mantener el costo de adquisición congelado o más bajo mientras alcanzas las 3,700 ventas.\n• Comisión de Rendimiento: Al alcanzar la meta de los 100K€ en el mes, se aplica un 15% de comisión sobre el resultado generado.\n• Capacidad Limitada del Servidor: Al ingresar tu tienda, serías el último en acceder para destinar toda la capacidad de cómputo a tus resultados (máximo 20 cuentas activas).",
        "Si tienes la lista de compradores lista, el servidor puede iniciar la inyección de datos inmediatamente después de ingresar como evaluador en Facebook y conectar la cuenta."
      ],

      "objecion": [
        "Si $7,000 te parecen un obstáculo para escalar una oferta con un motor probado de clonación de audiencia, esta infraestructura no es para ti.",
        "SODIE es exclusivo para negocios que manejan presupuesto real. Por rendimiento del algoritmo, solo operamos con un máximo de 10 cuentas activas."
      ],

      "acceder": [
        "Perfecto. Voy a habilitar tu checkout de reserva de $7,000.",
        "En cuanto el pago sea procesado, el contador global restará el cupo disponible y desbloqueará el cargador de Shopify. ¿Listo para el enlace?"
      ],

      "default": [
        "SODIE no es una herramienta de $30 dólares para publicaciones; es infraestructura de conversión que evita perder miles en campañas fallidas.",
        "Solo operamos con un máximo de 20 cuentas activas. ¿Vas a reservar tu slot con los $1,000 iniciales o dejas pasar la capacidad de cómputo?"
      ]
    };

    this.patronesIntencion = {
      saludo: ['hola', 'hey', 'buenos dias', 'que tal', 'buenas', 'inicio', 'comenzar'],
      cuotas_pasarela: ['cuotas', '3 cuotas', 'tres cuotas', 'opciones de pago', '6000', '3000', 'pasarela'],
      precio: ['precio', 'cuesta', 'valor', 'inversion', 'cuanto', 'costo', '10000', '1000', '9000'],
      ecommerce: ['ecommerce', 'tienda', 'shopify', '100k', '27', 'producto', 'clonacion', 'comisiones'],
      como_funciona: ['como funciona', 'explica', 'proceso', 'como es', 'pasos', 'protocolo'],
      comparacion: ['comparacion', 'comparar', 'saas', 'agencia', 'agencias', 'copywriter', 'diseñador', 'roas', 'fee', 'low-ticket', 'low ticket'],
      diferencia_herramientas: ['30', 'herramienta', 'barato', 'redes sociales', 'publicaciones', 'contenido', 'creativos', 'redaccion'],
      cupo_4: ['cupo 4', 'cupo4', 'cuarto cupo', '4to cupo', 'cupo 3', 'lista de espera', 'v4', 'lleno', 'sin cupos'],
      despues_de_pagar: ['despues de pagar', 'que hago despues', 'que sigue', 'luego de pagar', 'pague', 'evaluador'],
      metodos_pago: ['pago', 'tarjeta', 'apple pay', 'como pago', 'transferencia', 'checkout', 'kontigo', 'pasarela'],
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
        { label: "Checkout Reserva ($7,000)", payload: "checkout_link" },
        { label: "¿Qué hago después de pagar?", payload: "despues_de_pagar" }
      ];
    } else if (intencion === 'cuotas_pasarela') {
      quickReplies = [
        { label: "¿Cómo funciona?", payload: "como_funciona" },
        { label: "Reservar slot ($7,000)", payload: "acceder" }
      ];
    } else if (intencion === 'ecommerce') {
      quickReplies = [
        { label: "Reservar Slot ($7,000)", payload: "acceder" },
        { label: "¿Qué hago después de pagar?", payload: "despues_de_pagar" }
      ];
    } else if (intencion === 'cupo_4') {
      quickReplies = [
        { label: "Unirme a Lista de Espera (V4)", payload: "cupo_4" },
        { label: "Reservar Slot ($7,000)", payload: "acceder" }
      ];
    } else if (intencion === 'comparacion' || intencion === 'diferencia_herramientas') {
      quickReplies = [
        { label: "¿Cómo funciona?", payload: "como_funciona" },
        { label: "Reservar Slot ($7,000)", payload: "acceder" }
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
