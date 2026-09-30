/**
 * Módulo: IA3 Analyzer (modules/ia3-analyzer/index.js)
 * Diagnóstico de Fuga de Capital y Proyección de ROAS con SODIE.
 */

const express = require('express');
const crypto = require('crypto');

const router = express.Router();

/**
 * Función que realiza los cálculos de pérdida y proyección
 */
function analizarRendimiento({ adSpend, roas, sessionId }) {
  const spend = parseFloat(adSpend) || 0;
  const roasActual = parseFloat(roas) || 0;

  // ID único por consulta/sesión para evitar colisiones
  const activeSessionId = sessionId || `ia3_sess_${crypto.randomBytes(4).toString('hex')}`;

  if (spend <= 0 || roasActual <= 0) {
    return {
      success: false,
      sessionId: activeSessionId,
      problemas: "Datos de inversión o ROAS inválidos.",
      solucion: "Ingresa valores numéricos superiores a 0 para generar el diagnóstico.",
      ahorro: "$0 USD"
    };
  }

  // 1. Cálculos Mensuales / Fuga Actual (30 días)
  const inversionMensual = spend * 30;
  const retornoDiarioActual = spend * roasActual;
  const retornoMensualActual = inversionMensual * roasActual;

  // 2. Proyección SODIE (Escalabilidad en 4 semanas)
  const roasSemana1 = (roasActual * 1.2).toFixed(2);
  const roasSemana2 = (roasActual * 1.4).toFixed(2);
  const roasSemana3 = (roasActual * 1.8).toFixed(2);
  const roasSemana4 = (roasActual * 2.0).toFixed(2);

  const retornoDiarioSemana1 = Math.round(spend * roasSemana1);
  const retornoDiarioSemana2 = Math.round(spend * roasSemana2);
  const retornoDiarioSemana3 = Math.round(spend * roasSemana3);
  const retornoDiarioSemana4 = Math.round(spend * roasSemana4);

  const retornoMensualSODIE = (
    (retornoDiarioSemana1 * 7) +
    (retornoDiarioSemana2 * 7) +
    (retornoDiarioSemana3 * 7) +
    (retornoDiarioSemana4 * 9)
  );

  const fugaDineroMensual = Math.round(retornoMensualSODIE - retornoMensualActual);

  // 3. Estructuración de respuestas
  const problemas = `Actualmente inviertes $${spend.toLocaleString()} USD/día ($${inversionMensual.toLocaleString()} USD/mes) generando $${retornoDiarioActual.toLocaleString()} USD/día con un ROAS estancado de ${roasActual}. Sin segmentación en tiempo real, estás perdiendo aproximadamente $${fugaDineroMensual.toLocaleString()} USD cada mes por fugar capital en audiencias no optimizadas.`;

  const solucion = `Con SODIE eliminas la dependencia de la data segmentada tradicional. Al inyectar automáticamente tu lista de nuevos compradores cada 24 horas, tu ROAS escala semana a semana invirtiendo lo mismo:\n` +
    `• Semana 1: ROAS ${roasSemana1} ➔ $${retornoDiarioSemana1.toLocaleString()} USD/día\n` +
    `• Semana 2: ROAS ${roasSemana2} ➔ $${retornoDiarioSemana2.toLocaleString()} USD/día\n` +
    `• Semana 3: ROAS ${roasSemana3} ➔ $${retornoDiarioSemana3.toLocaleString()} USD/día\n` +
    `• Semana 4: ROAS ${roasSemana4} ➔ $${retornoDiarioSemana4.toLocaleString()} USD/día`;

  const ahorro = `$${fugaDineroMensual.toLocaleString()} USD/mes retenidos`;

  return {
    success: true,
    sessionId: activeSessionId,
    problemas,
    solucion,
    ahorro,
    metrics: {
      inversionMensual,
      retornoMensualActual,
      retornoMensualSODIE,
      fugaDineroMensual,
      proyeccionDiaria: {
        semana1: retornoDiarioSemana1,
        semana2: retornoDiarioSemana2,
        semana3: retornoDiarioSemana3,
        semana4: retornoDiarioSemana4
      }
    }
  };
}

// Handler flexible para POST/GET
const manejarAnalisis = (req, res) => {
  try {
    const data = req.method === 'GET' ? req.query : req.body;

    // Normalización de parámetros (Soporta múltiples variantes)
    const adSpend = data.adSpend || data.spend || data.inversion || data.inversionDiaria || 100;
    const roas = data.roas || data.roasActual || data.returnOnAdSpend || 2.0;
    const sessionId = data.sessionId || data.session_id;

    const resultado = analizarRendimiento({ adSpend, roas, sessionId });
    return res.status(200).json(resultado);

  } catch (error) {
    console.error('Error en módulo IA3 Analyzer:', error);
    return res.status(500).json({
      error: 'Error de servidor',
      message: 'No se pudo procesar el análisis de la IA3.'
    });
  }
};

// Endpoints con alias
router.post(['/analizar', '/', '/analizar-roas', '/fuga-capital'], manejarAnalisis);
router.get(['/analizar', '/', '/analizar-roas', '/fuga-capital'], manejarAnalisis);

// Endpoint SSE / Live Stream Mock para monitoreo en vivo
router.get(['/live', '/stream', '/sse'], (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  res.write(`data: ${JSON.stringify({ status: 'ACTIVE', system: 'IA3 ROAS Engine Live', time: new Date().toISOString() })}\n\n`);

  const interval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ event: 'ping', pulse: Date.now() })}\n\n`);
  }, 10000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

module.exports = router;
