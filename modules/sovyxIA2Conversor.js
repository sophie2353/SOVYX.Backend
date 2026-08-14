// modules/sovyxIA2Conversor.js
const sovyxLogger = require('./sovyxLogger');

class SOVYXIA2Conversor {
  constructor(estilo = 'aggressive_closer') {
    this.name = "SOVYX IA2";
    this.estilo = estilo;
    this.contexto = {}; 
    
    this.plantillas = {
      "hola": [
        "Estás viendo las métricas en vivo. Solo liberamos 4 cupos para la infraestructura esta semana. La oferta es simple: $1,000 de acceso inicial y $4,000 cuando veas los resultados en 48 horas. ¿Tienes el Ads Manager listo con tu data de compradores anteriores? 👺",
        "Directo al punto. El sistema conecta con tu pauta, inyectas $100/día y en 48 horas validamos de 1 a 3 ventas High Ticket. Son solo 4 cupos. ¿Activamos tu slot hoy con Tarjeta o Apple Pay? 🍷"
      ],
      
      "cuanto_cuesta": [
        "El costo total de la infraestructura son $5,000. Pagas $1,000 para reservar uno de los 4 cupos y activar el despliegue. Los $4,000 restantes los pagas a las 48 horas, directamente del retorno de las ventas que SOVYX te genera. ¿Aceptas Tarjeta Internacional o Apple Pay? 🫦💅🏽",
        "Son $1,000 iniciales + $4,000 al ver resultados en 48H. Si tu oferta es High Ticket ($2,000+), recuperas la inversión con la primera venta de la prueba. Quedan cupos contados en la web. ¿Te envío el checkout?"
      ],
      
      "como_funciona": [
        "El proceso de integración es de precisión militar:\n1️⃣ Reservas 1 de los 4 cupos pagando $1,000 (Tarjeta o Apple Pay).\n2️⃣ Subes el archivo CSV con tu data de clientes anteriores para calibración espejo (IA1 + IA3).\n3️⃣ Corremos la pauta con $100/día durante 48H.\n4️⃣ Al caer las ventas High Ticket en la web, liquidas los $4,000 finales. 😮‍💨"
      ],
      
      "metodos_pago": [
        "Puedes procesar el pago inicial de $1,000 de forma inmediata con Tarjeta de Crédito/Débito Internacional o mediante Apple Pay directamente en la pasarela. El slot se descuenta automáticamente en el contador de la web al confirmarse el cobro. 💳🍎"
      ],
      
      "objecion": [
        "Si $1,000 te parecen un obstáculo para escalar una oferta High Ticket con un motor probado, esta infraestructura no es para ti. No mantengo cupos reservados sin pago. Hay otros usuarios viendo la pantalla en este momento. 🥱",
        "Solo abro 4 cupos porque el seguimiento de optimización en las primeras 48H requiere procesamiento dedicado. Si no reservas hoy, el contador llegará a cero y la ruta se cierra. 👺"
      ],
      
      "acceder": [
        "Perfecto. Voy a generar tu enlace de reserva de $1,000. Puedes pagar con Tarjeta Internacional o Apple Pay. En cuanto el pago sea procesado, el contador global restará un cupo y se habilitará la subida de tu data de clientes. ¿Listo para el enlace? 🚀"
      ],

      "default": [
        "Quedan pocos cupos en el panel. ¿Vas a reservar tu slot de 48H con los $1,000 iniciales o dejas pasar el tráfico? 👺"
      ]
    };

    this.patronesIntencion = {
      saludo: ['hola', 'hey', 'buenos dias', 'que tal', 'buenas'],
      precio: ['precio', 'cuesta', 'valor', 'inversion', 'cuanto', 'costo', '5000', '1000', '4000'],
      como_funciona: ['como funciona', 'explica', 'proceso', 'como es', 'pasos'],
      metodos_pago: ['pago', 'tarjeta', 'apple pay', 'como pago', 'transferencia', 'checkout', 'stripe'],
      objecion: ['caro', 'riesgo', 'seguro', 'perder', 'lo pienso', 'garantia'],
      acceder: ['quiero entrar', 'acceder', 'comprar', 'pagar', 'reserva', 'cupo', 'enlace', 'link']
    };
  }

  detectarIntencion(mensaje) {
    const m = mensaje.toLowerCase();
    for (const [intencion, patrones] of Object.entries(this.patronesIntencion)) {
      if (patrones.some(p => m.includes(p))) return intencion;
    }
    return 'default';
  }

  async generarRespuesta({ mensaje, sessionId }) {
    if (!this.contexto[sessionId]) this.contexto[sessionId] = { etapa: "inicio" };
    
    let intencion = this.detectarIntencion(mensaje);
    let respuestaRaw = this.plantillas[intencion] || this.plantillas.default;
    
    if (Array.isArray(respuestaRaw)) {
      respuestaRaw = respuestaRaw[Math.floor(Math.random() * respuestaRaw.length)];
    }

    return {
      mensaje: respuestaRaw,
      intencion: intencion
    };
  }
}

module.exports = SOVYXIA2Conversor;
