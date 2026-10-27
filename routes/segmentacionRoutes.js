/**
 * SODIE - Pre-procesador de Segmentación (routes/segmentacionRoutes.js)
 * Genera 300 filas por país y se conecta directamente con la lógica de upload/MongoDB.
 */

const express = require('express');
const router = express.Router();
const Audiencia = require('../models/Audiencia');
const { procesarYGuardarAudiencia, normalizeClientId } = require('./uploadRoutes');

/**
 * Genera un dataset dinámico calculando 300 filas por cada país recibido.
 */
function mapearDatasetCliente({ clientId, paises, value, edadMin, edadMax, nicho }) {
  const listaPaises = Array.isArray(paises) 
    ? paises.map(p => String(p).trim().toUpperCase())
    : String(paises || 'US').split(',').map(p => p.trim().toUpperCase());

  const valorBase = parseFloat(value) || 1000;
  const nombres = ['Carlos', 'Sofía', 'Mateo', 'Valentina', 'Santiago', 'Camila', 'Alejandro', 'Mariana', 'Diego', 'Lucía'];
  const apellidos = ['Mendoza', 'Rodríguez', 'Silva', 'Gomez', 'Hernandez', 'Torres', 'Perez', 'Morales', 'Rios', 'Castro'];

  const datasetCompleto = [];
  let contadorGlobal = 1;

  // Generar exactamente 300 filas por cada país especificado
  listaPaises.forEach(pais => {
    for (let i = 1; i <= 300; i++) {
      const fn = nombres[contadorGlobal % nombres.length];
      const ln = apellidos[contadorGlobal % apellidos.length];
      const delta = (Math.random() * 0.3) - 0.15;
      const valorCalculado = Math.round(valorBase * (1 + delta));

      datasetCompleto.push({
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}${contadorGlobal}@sodie-leads.com`,
        phone: `+1555${100000 + contadorGlobal}`,
        firstName: fn.toLowerCase(),
        lastName: ln.toLowerCase(),
        country: pais,
        zip: '00000',
        value: valorCalculado > 0 ? valorCalculado : 100,
        age_min: parseInt(edadMin) || 22,
        age_max: parseInt(edadMax) || 55,
        nicho: nicho || 'infoproductos',
        clientId: clientId
      });
      contadorGlobal++;
    }
  });

  return datasetCompleto;
}

/* ==========================================================================
   POST /api/v1/segmentacion/procesar
   Mapea 300 filas por país y las despacha directamente al motor de almacenamiento
   ========================================================================== */
router.post(['/procesar', '/guardar-4-datos'], async (req, res) => {
  try {
    const { clientId, paises, edadMin, edadMax, value, nicho, token, adAccountId, pixelId } = req.body;

    const activeClientId = normalizeClientId(clientId);
    const claveColeccion = `Datos_${activeClientId}`;
    const session = `sess_form_${activeClientId}_${Date.now()}`;

    // 1. Mapear 300 registros por cada país recibido
    const payloadAjustado = mapearDatasetCliente({
      clientId: activeClientId,
      paises,
      value,
      edadMin,
      edadMax,
      nicho
    });

    const totalRegistrosGenerados = payloadAjustado.length;

    // 2. Guardar parámetros y temporizador de 72h en MongoDB (Modelo Audiencia)
    const ahora = new Date();
    const proximaRotacion = new Date(ahora.getTime() + (72 * 60 * 60 * 1000)); // +72 Horas

    await Audiencia.findOneAndUpdate(
      { clientId: activeClientId },
      {
        $set: {
          clientId: activeClientId,
          nombreDataset: claveColeccion,
          parametrosConfig: {
            paises,
            edadMin: parseInt(edadMin) || 22,
            edadMax: parseInt(edadMax) || 55,
            value: parseFloat(value) || 1000,
            nicho: nicho || 'infoproductos',
            updatedAt: ahora,
            nextRotationAt: proximaRotacion
          },
          estado: 'ENVIANDO_A_UPLOAD'
        }
      },
      { upsert: true, new: true }
    );

    // 3. CONEXIÓN DIRECTA CON UPLOAD (Sin llamadas HTTP internas redundantes)
    console.log(`🚀 [SEGMENTACION] Despachando ${totalRegistrosGenerados} registros directamente a motor Upload para ${activeClientId}...`);

    const uploadResponse = await procesarYGuardarAudiencia({
      sessionId: session,
      clientId: activeClientId,
      nicho: nicho || 'infoproductos',
      usersPayload: payloadAjustado,
      fileName: `dataset_automatico_${activeClientId}.json`
    });

    return res.json({
      ok: true,
      success: true,
      clientId: activeClientId,
      datasetKey: claveColeccion,
      totalRegistros: totalRegistrosGenerados,
      rotationTimerHours: 72,
      nextRotationAt: proximaRotacion,
      uploadResult: uploadResponse,
      message: `${totalRegistrosGenerados} registros (300 por país) generados y guardados con éxito en MongoDB.`
    });

  } catch (error) {
    console.error('💥 Error en segmentación predeterminada:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

/* ==========================================================================
   GET /api/v1/segmentacion/estado/:clientId
   ========================================================================== */
router.get('/estado/:clientId', async (req, res) => {
  try {
    const activeClientId = String(req.params.clientId).trim().toUpperCase();
    const audiencia = await Audiencia.findOne({ clientId: activeClientId });

    if (!audiencia || !audiencia.parametrosConfig) {
      return res.json({ ok: true, configurable: true, message: 'Sin configuración previa' });
    }

    const ahora = new Date();
    const proximaRotacion = new Date(audiencia.parametrosConfig.nextRotationAt);
    const msecRestantes = proximaRotacion.getTime() - ahora.getTime();
    const horasRestantes = Math.max(0, (msecRestantes / (1000 * 60 * 60)).toFixed(2));

    return res.json({
      ok: true,
      clientId: activeClientId,
      config: audiencia.parametrosConfig,
      horasRestantes: parseFloat(horasRestantes),
      puedeActualizar: msecRestantes <= 0
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
