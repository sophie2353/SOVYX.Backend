// modules/sovyxIA2Conversor.js
// IA2 - Responde mensajes automáticamente, gestiona pagos y formularios

const sovyxLogger = require('./sovyxLogger');

class SOVYXIA2Conversor {
  constructor(estilo = 'high_ticket_client') {
    this.name = "SOVYX IA2";
    this.estilo = estilo;
    this.contexto = {}; // Por clienteId
    this.historial = {};
    
    // LINK DEL FORMULARIO (actualizado)
    this.linkFormulario = 'https://forms.gle/W9BXc4bmHb2EHifg8';
    
    // PLANTILLAS DE RESPUESTA (basadas en conversaciones reales)
    this.plantillas = {
      // SALUDOS INICIALES
      "hola": [
        "¡Hola! gracias por escribir. ¿Que te interesa saber de SOVYX?",
        "¡Hey! ¿cómo vas? gracias por contactar",
        "Holaaa, bienvenido 👋 ¿en qué puedo ayudarte?"
      ],
      
      // PREGUNTAS FRECUENTES
      "cuánto cuesta": [
        "El programa SOVYX tiene un costo de ${precio}. Incluye: ${incluye}. ¿Te gustaría más detalles?",
        "Está en ${precio} (pago único). Incluye acceso a las 3 IAs, dashboard y automatización completa. ¿quieres que te cuente más?"
      ],
      
      "cómo funciona": [
        "SOVYX funciona con 3 IAs que trabajan juntas:\n1️⃣ IA1: Segmenta tu audiencia ideal\n2️⃣ IA2: Responde DMs automáticamente (como yo)\n3️⃣ IA3: Analiza resultados y mejora las 2 IAs anteriores.\n\n¿Te gustaría ver ejemplos?",
        "Es sencillo: tú subes un post, SOVYX lo segmenta, yo respondo los mensajes (IA2), y la IA3 optimiza todo. Nosotros nos encargamos del resto ✅"
      ],
      
      "resultados": [
        "El resultado es el que esta actualmente en las historias de SOVYX. se decidió arriesgarse y mostrar resultados primero con esta cuenta y luego con los clientes. ¿quieres ver algo más?",
        "En promedio, los clientes ven sus primeras ventas en 3-7 días. Llevo 11 meses perfeccionando esto. ¿te interesa?"
      ],
      
      // OBJECIONES COMUNES
      "caro": [
        "Entiendo tu punto. Pero piensa: si inviertes ${precio} y generas ${resultadoEstimado}, el ROI es enorme. Además, incluye 3 IAs trabajando 24/7 para ti. ¿vale la pena?",
        "Mira, la mayoría de agencias cobran 3x más y no tienen IAs. SOVYX es tecnología propia desarrollada en 11 meses. ¿quieres que te explique por qué es diferente?"
      ],
      
      "no tengo tiempo": [
        "Por eso mismo SOVYX está diseñado para gente ocupada. Solo necesitas subir 1 post cada 3-4 días y grabar los módulos del curso/mentoria. Nosotros hacemos el resto. ¿te sirve?",
        "IA2 responde por ti 24/7, tú solo supervisas. Inviertes 2-3 horas a la semana. ¿eso funciona para ti?"
      ],
      
      "necesito pensarlo": [
        "Claro, tómate tu tiempo. ¿quieres que te mande más info por aquí o prefieres agendar una llamada cuando estés list@?",
        "Sin presión. ¿alguna duda específica que pueda resolverte ahora? Así cuando decidas, ya tienes todo claro."
      ],
      
      // PAGO
      "pagar": [
        "¡Excelente decisión! Aquí tienes el link de pago: ${paymentLink}\n\nUna vez procesado, envíame el comprobante para activar SOVYX.",
        "¡Me alegra mucho! Procesa tu pago aquí: ${paymentLink}\n\nLuego envíame el comprobante para continuar con la activación. 🦁"
      ],
      
      // POST-PAGO (cuando envían comprobante)
      "post_pago": [
        "✅ ¡Pago confirmado! 🎉\n\nAhora completa este formulario para activar SOVYX:\n\n📋 ${linkFormulario}\n\nIncluye:\n- 🔐 Usuario y contraseña TEMPORAL de Instagram\n- 🎯 Nicho y audiencia objetivo\n- 📍 Países a segmentar\n- 💰 Presupuesto para ADS\n\nUna vez completado, en pocas horas tendrás:\n🔓 Acceso al dashboard (con tu dominio profesional)\n🌐 Tu propia página web SOVYX\n🤖 IA1 e IA2 configuradas con tus datos\n📱 Calendario de historias\n🎬 Estructura de 3 posts optimizados\n\n¿Tienes alguna duda?"
      ],
      
      // DEFAULT
      "default": [
        "Cuéntame más, ¿qué te gustaría saber específicamente sobre SOVYX?",
        "Entiendo. Dime, ¿qué es lo que más te interesa: la segmentación, la automatización o los resultados?"
      ]
    };
    
    // PATRONES PARA DETECTAR INTENCIONES
    this.patronesIntencion = {
      saludo: ['hola', 'buenas', 'qué tal', 'hey', 'hi', 'hello', 'buenos días', 'buenas tardes', 'que tal'],
      precio: ['precio', 'cuesta', 'valor', 'inversión', '$$', 'cost', 'price', 'cuánto', 'costo'],
      como_funciona: ['cómo funciona', 'explica', 'proceso', 'cómo es', 'how does', 'funcionamiento', 'explicame'],
      resultados: ['resultado', 'logrado', 'beneficio', 'ganado', 'results', 'success', 'casos', 'ejemplos'],
      objecion: ['caro', 'mucho', 'no tengo', 'no puedo', 'expensive', 'too much', 'cant', 'no me alcanza'],
      pensando: ['pensar', 'decidir', 'ver', 'dud', 'think', 'decide', 'doubt', 'considerar', 'analizar'],
      compra: ['pagar', 'comprar', 'quiero acceder', 'me interesa quiero pagar', 'quiero entrar', 'acceder'],
      post_pago: ['comprobante', 'ya pague', 'pago realizado', 'transferencia', 'recibo']
    };
    
    // ESTILOS DE RESPUESTA SEGÚN CUENTA
    this.estilos = {
      high_ticket_owner: {
        nombre: "Equipo SOVYX",
        tono: "cercano pero profesional",
        palabras_clave: ['inversión', 'retorno', 'garantía', '36 meses'],
        presentacion: "Somos el equipo de SOVYX, encantados de ayudarte"
      },
      
      high_ticket_client: {
        nombre: "Soporte SOVYX",
        tono: "profesional y servicial",
        palabras_clave: ['resultados', 'crecimiento', 'estrategia', 'acompañamiento'],
        presentacion: "Hola, soy del equipo de soporte de SOVYX. ¿En qué puedo ayudarte?"
      }
    };
  }
  
  // ============================================
  // INICIAR CONTEXTO PARA UN CLIENTE
  // ============================================
  async iniciarContexto(clienteId, config = {}) {
    const estilo = this.estilos[this.estilo] || this.estilos.high_ticket_client;
    
    this.contexto[clienteId] = {
      nombre: config.nombre || 'Cliente',
      precio: '5,000$ (Pago a realizar por Binance Pay solamente)',
      incluye: '3 IAs, dashboard en tiempo real, automatización de DMs, segmentación avanzada, soporte prioritario',
      resultadoEstimado: '5-8 ventas de 1,000-5.000$',
      pasos: [
        'Subes tu primer post (30 segundos)',
        'IA2 responde todos los DMs automáticamente',
        'IA3 analiza y mejora la segmentación',
        'Ves resultados en el dashboard según tú objetivo'
      ],
      tiempoInversion: '2-3 horas a la semana',
      paymentLink: 'https://app.kontigo.com/pay/53a368ed-10d4-4936-accb-deb2e69f349a',
      pago_confirmado: false,
      estilo: estilo,
      etapa: "inicio",
      historial: [],
      probCierre: 0.1
    };
    
    sovyxLogger.info(`🤖 IA2: Contexto iniciado para ${clienteId}`);
    return this.contexto[clienteId];
  }
  
  // ============================================
  // DETECTAR INTENCIÓN DEL MENSAJE
  // ============================================
  detectarIntencion(mensaje) {
    const m = mensaje.toLowerCase().trim();
    
    for (const [intencion, patrones] of Object.entries(this.patronesIntencion)) {
      for (const patron of patrones) {
        if (m.includes(patron)) {
          return intencion;
        }
      }
    }
    
    return 'default';
  }
  
  // ============================================
  // GENERAR RESPUESTA POR INTENCIÓN
  // ============================================
  generarRespuestaPorIntencion(intencion, ctx) {
    const mapa = {
      'saludo': 'hola',
      'precio': 'cuánto cuesta',
      'como_funciona': 'cómo funciona',
      'resultados': 'resultados',
      'objecion': 'caro',
      'pensando': 'necesito pensarlo',
      'compra': 'pagar'
    };
    
    // Si es post_pago, usar plantilla especial
    if (intencion === 'post_pago') {
      const opciones = this.plantillas["post_pago"];
      let respuesta = opciones[0];
      respuesta = respuesta.replace('${linkFormulario}', this.linkFormulario);
      return respuesta;
    }
    
    const plantillaKey = mapa[intencion] || 'default';
    const opciones = this.plantillas[plantillaKey] || this.plantillas.default;
    
    // Si es objeción, verificar si es de tiempo o precio
    if (intencion === 'objecion') {
      const mensajeAnterior = ctx.historial[ctx.historial.length - 2]?.usuario?.toLowerCase() || '';
      if (mensajeAnterior.includes('tiempo') || mensajeAnterior.includes('horas')) {
        return this.plantillas["no tengo tiempo"][0];
      }
    }
    
    const indice = Math.floor(Math.random() * opciones.length);
    return opciones[indice];
  }
  
  // ============================================
  // PERSONALIZAR CON VARIABLES
  // ============================================
  personalizarRespuesta(respuesta, ctx) {
    const valores = {
      precio: '5,000$ (Binance Pay se acepta solamente)',
      incluye: '3 IAs, automatización de DMs, segmentación, dashboard',
      resultadoEstimado: '5-8 ventas de 1,000-5.000$',
      paso1: 'Subir tu primer post (30 segundos)',
      paso2: 'IA2 responde todos los DMs',
      paso3: 'IA3 optimiza la segmentación',
      paso4: 'Vendes mientras duermes',
      tiempoInversion: '2-3 horas a la semana',
      tiempoAhorro: '40',
      paymentLink: ctx.paymentLink || 'https://app.kontigo.com/pay/53a368ed-10d4-4936-accb-deb2e69f349a',
      linkFormulario: this.linkFormulario
    };
    
    return respuesta
      .replace('${precio}', valores.precio)
      .replace('${incluye}', valores.incluye)
      .replace('${resultadoEstimado}', valores.resultadoEstimado)
      .replace('${paso1}', valores.paso1)
      .replace('${paso2}', valores.paso2)
      .replace('${paso3}', valores.paso3)
      .replace('${paso4}', valores.paso4)
      .replace('${tiempoInversion}', valores.tiempoInversion)
      .replace('${tiempoAhorro}', valores.tiempoAhorro)
      .replace('${paymentLink}', valores.paymentLink)
      .replace('${linkFormulario}', valores.linkFormulario);
  }
  
  // ============================================
  // ACTUALIZAR ETAPA DEL LEAD
  // ============================================
  actualizarEtapa(ctx, intencion) {
    if (intencion === 'compra') {
      ctx.etapa = 'pago_pendiente';
      ctx.probCierre = 0.9;
    } else if (intencion === 'post_pago') {
      ctx.etapa = 'pago_confirmado';
      ctx.pago_confirmado = true;
      ctx.probCierre = 0.95;
    } else if (intencion === 'objecion') {
      ctx.etapa = 'objeción';
      ctx.probCierre = 0.3;
    } else if (intencion === 'pensando') {
      ctx.etapa = 'considerando';
      ctx.probCierre = 0.5;
    } else if (ctx.historial.length > 4) {
      ctx.etapa = 'conversando';
      ctx.probCierre = 0.4;
    }
    
    return ctx;
  }
  
  // ============================================
  // CALCULAR PROBABILIDAD DE CIERRE
  // ============================================
  calcularProbCierre(ctx) {
    let prob = 0.1; // base
    
    if (ctx.etapa === 'pago_confirmado') prob += 0.85;
    else if (ctx.etapa === 'pago_pendiente') prob += 0.8;
    else if (ctx.etapa === 'calificado') prob += 0.2;
    if (ctx.historial.length > 6) prob += 0.1;
    if (ctx.respondioSeguimiento) prob += 0.1;
    if (ctx.etapa === 'objeción') prob -= 0.1;
    
    return Math.min(Math.max(prob, 0), 1);
  }
  
  // ============================================
  // PROCESAR MENSAJE PRINCIPAL
  // ============================================
  async generarRespuesta({ mensaje, usuario, contexto = {} }) {
    sovyxLogger.info('🤖 IA2: Procesando mensaje', { usuario: usuario?.id });
    
    const clienteId = usuario?.id || 'unknown';
    
    if (!this.contexto[clienteId]) {
      await this.iniciarContexto(clienteId, contexto);
    }
    
    const ctx = this.contexto[clienteId];
    
    ctx.historial.push({
      usuario: mensaje,
      timestamp: new Date()
    });
    
    const intencion = this.detectarIntencion(mensaje);
    
    let respuesta = this.generarRespuestaPorIntencion(intencion, ctx);
    respuesta = this.personalizarRespuesta(respuesta, ctx);
    
    this.actualizarEtapa(ctx, intencion);
    ctx.probCierre = this.calcularProbCierre(ctx);
    
    ctx.historial.push({
      bot: respuesta,
      timestamp: new Date()
    });
    
    // Guardar en base de datos (opcional)
    try {
      const db = require('./sovyxDatabase');
      await db.guardarInteraccion({
        usuario_id: clienteId,
        mensaje,
        respuesta,
        etapa: ctx.etapa,
        probCierre: ctx.probCierre,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      // Si falla la DB, no detiene el flujo
      sovyxLogger.warn('No se pudo guardar interacción', { error: err.message });
    }
    
    return {
      mensaje: respuesta,
      etapa: ctx.etapa,
      intencion: intencion,
      probCierre: ctx.probCierre
    };
  }
  
  // ============================================
  // PROGRAMAR SEGUIMIENTO AUTOMÁTICO
  // ============================================
  programarSeguimiento(clienteId, tipo, tiempo = 24) {
    setTimeout(() => {
      const ctx = this.contexto[clienteId];
      if (!ctx) return;
      if (ctx.etapa === 'pago_confirmado' || ctx.etapa === 'pago_pendiente') return;
      
      sovyxLogger.info(`⏰ IA2: Seguimiento programado para ${clienteId}`);
      // El webhook manejaría el envío
      
    }, tiempo * 60 * 60 * 1000);
  }
}

module.exports = SOVYXIA2Conversor;
