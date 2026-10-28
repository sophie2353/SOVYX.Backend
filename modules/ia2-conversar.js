/**
 * SOVYX IA2 Conversor Engine
 * Actualizado: 10 Cupos iniciales & Activación Lista de Espera en Cupo 11 (Sin Cuotas)
 */
const express = require('express');
const router = express.Router();

class SOVYXIA2Conversor {
  constructor(estilo = 'aggressive_closer') {
    this.name = "SODIE IA2";
    this.estilo = estilo;
    this.contexto = {}; 

    this.defaultQuickReplies = [
      { label: "¿Cómo funciona?", payload: "como_funciona" },
      { label: "SODIE vs SaaS / Agencias", payload: "comparacion" },
      { label: "Protocolo Ecommerce (100K€)", payload: "ecommerce" },
      { label: "Cupo 11 (Lista de Espera V4)", payload: "cupo_11" },
      { label: "Reservar slot", payload: "acceder" }
    ];

    this.plantillas = {
      "hola": [
        "Gracias por confirmar que este software funciona, ¿qué preguntas tienes?",
        "Quedan pocos cupos disponibles para evaluadores (10 cupos iniciales en total; a partir del cupo 11 se activa automáticamente la lista de espera para la V4). La oferta es directa: pago único de acceso para iniciar la inyección automatizada. ¿Tienes el Ads Manager listo?"
      ],

      "como_funciona": [
        "Las herramientas de contenido te ayudan a redactar o diseñar más rápido, pero no evitan que quemes presupuesto en pauta. Si lanzas 50 anuncios generados por IA a una audiencia mal segmentada, solo estás quemando tu dinero a mayor velocidad. SODIE resuelve la ineficiencia de tu gasto publicitario.",
        "El proceso de integración es de precisión militar:\n\n1️⃣ Reservas tu cupo dentro de los primeros 10 disponibles.\n2️⃣ Subes la hoja de cálculo exportada de Shopify/CRM con tu data de compradores previos para calibración espejo.\n3️⃣ En 10 minutos, sin tocar tu tarjeta ni tus creativos, la inteligencia de datos valida tu estructura publicitaria.\n4️⃣ Se activa la inyección cada 72 horas."
      ],

      "comparacion": [
        "Comparemos estas dos opciones:\n\n1. SaaS de Contenido (Low-Ticket): Ahorra $200 al mes en un diseñador o copywriter, pero te deja todo el trabajo de configuración y testeo manual.\n2. SODIE: Es infraestructura de conversión de precisión que evita quemar miles en pauta y acelera el tiempo de retorno de inmediato.",
        "Las agencias tradicionales te cobran un fee mensual para pasar 90 días haciendo pruebas manuales con un ROAS mediocre. SODIE inyecta audiencias optimizadas conectadas de forma nativa a tu Meta Ads."
      ],

      "diferencia_herramientas": [
        "Si buscas una herramienta de $30 para publicaciones de redes sociales, hay cientos. SODIE es exclusivo para negocios que manejan presupuesto publicitario real y exigen eficiencia de capital inmediata.",
        "Por estabilidad y rendimiento del algoritmo, operamos estrictamente con los primeros 10 cupos activos antes de pasar a lista de espera."
      ],

      "cupo_11": [
        "A partir del Cupo 11, el sistema bloquea el acceso inmediato y redirige automáticamente a la Lista de Espera oficial para la V4.",
        "Los primeros 10 usuarios obtienen el despliegue inmediato de la V3.5, mientras que el cupo 11 en adelante asegura su posición preferencial para el despliegue masivo en 28 días.",
        "¿Quieres asegurar uno de los 10 cupos evaluadores activos ahora mismo o prefieres correr el riesgo de quedar en lista de espera?"
      ],

      "despues_de_pagar": [
        "Inmediatamente confirmes tu reserva:\n\n1️⃣ Subes tu lista de compradores previos exportada de Shopify para iniciar la inyección de datos.\n2️⃣ Te agregas como evaluador en Facebook y conectas tu cuenta.\n3️⃣ En 24 horas ves los primeros resultados del borrador. Sin vueltas."
      ],

      "metodos_pago": [
        "Los pagos se procesan de forma segura a través de nuestra pasarela y métodos habilitados en el sistema de checkout."
      ],

      "ecommerce": [
        "Para escalar con tiendas online necesitas precisión en el Píxel. El protocolo de aceleración con SODIE clona tus compradores reales en perfiles idénticos de alta conversión, evitando especular durante meses con el algoritmo tradicional de Meta."
      ],

      "objecion": [
        "SODIE es exclusivo para negocios que manejan presupuesto real y entienden el valor de la infraestructura de datos. Por rendimiento del algoritmo, los cupos son sumamente limitados."
      ],

      "acceder": [
        "Perfecto. Voy a habilitar tu enlace de acceso directo al checkout.",
        "En cuanto el pago sea procesado, el contador global validará tu espacio dentro de los 10 cupos activos. ¿Listo para proceder?"
      ],

      "default": [
        "SODIE es infraestructura de conversión de alto rendimiento diseñada para marcas con pauta activa.",
        "Actualmente disponemos de los 10 cupos iniciales antes de activar la lista de espera del cupo 11. ¿Deseas asegurar tu acceso?"
      ]
    };

    this.patronesIntencion = {
      saludo: ['hola', 'hey', 'buenos dias', 'que tal', 'buenas', 'inicio', 'comenzar'],
      como_funciona: ['como funciona', 'explica', 'proceso', 'como es', 'pasos', 'protocolo'],
      comparacion: ['comparacion', 'comparar', 'saas', 'agencia', 'agencias', 'roas', 'fee'],
      diferencia_herramientas: ['30', 'herramienta', 'barato', 'redes sociales', 'publicaciones', 'contenido'],
      cupo_11: ['cupo 11', 'cupo11', '11', 'once', 'lista de espera', 'v4', 'lleno', 'sin cupos'],
      despues_de_pagar: ['despues de pagar', 'que hago despues', 'que sigue', 'luego de pagar', 'pague'],
      metodos_pago: ['pago', 'tarjeta', 'como pago', 'transferencia', 'checkout', 'pasarela'],
      ecommerce: ['ecommerce', 'tienda', 'shopify', 'producto', 'clonacion'],
      objecion: ['caro', 'riesgo', 'seguro', 'perder', 'lo pienso'],
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
    
    let mensajesArray = Array.isArray(respuestaRaw) ? respuestaRaw : [respuestaRaw];

    let quickReplies = [...this.defaultQuickReplies];
    if (intencion === 'acceder') {
      quickReplies = [
        { label: "Checkout de Reserva", payload: "checkout_link" },
        { label: "¿Qué hago después de pagar?", payload: "despues_de_pagar" }
      ];
    } else if (intencion === 'cupo_11') {
      quickReplies = [
        { label: "Unirme a Lista de Espera (V4)", payload: "cupo_11" },
        { label: "Reservar Slot", payload: "acceder" }
      ];
    }

    return {
      messages: mensajesArray,
      mensaje: mensajesArray.join("\n\n"),
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
      messages: result.messages,
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
