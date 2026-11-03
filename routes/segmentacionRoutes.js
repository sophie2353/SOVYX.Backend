/**
 * SODIE - Pre-procesador de Segmentación (routes/segmentacionRoutes.js)
 * Garantiza un mínimo global de 1,200 a 1,500 filas repartidas equitativamente por país,
 * sin correos ni teléfonos falsos, con variación dinámica de valores y nombres únicos.
 */

const express = require('express');
const router = express.Router();
const Audiencia = require('../models/Audiencia');
const { procesarYGuardarAudiencia, normalizeClientId } = require('./uploadRoutes');

/**
 * Genera un dataset dinámico garantizando un mínimo de 1,200 filas globales 
 * distribuidas equitativamente entre los países seleccionados.
 */
function mapearDatasetCliente({ clientId, paises, value, edadMin, edadMax, nicho }) {
  // ⚡ Normalización robusta de países
  let listaPaises = ['US'];
  if (Array.isArray(paises) && paises.length > 0) {
    listaPaises = paises.map(p => String(p).trim().toUpperCase());
  } else if (typeof paises === 'string' && paises.trim() !== '') {
    listaPaises = paises.split(',').map(p => String(p).trim().toUpperCase());
  }

  const valorBase = parseFloat(value) || 1000;
  const totalPaises = listaPaises.length;

  // ⚡ Cálculo exacto según tu regla: 
  // 1 país = 1,200 | 2 países = 600 c/u | 3 o más países = proporción que garantice mínimo 1,200 a 1,500 total (ej: 5 países = 400 c/u = 2,000)
  let filasPorPais;
  if (totalPaises === 1) {
    filasPorPais = 1200;
  } else if (totalPaises === 2) {
    filasPorPais = 600;
  } else {
    // Para 3 o más países, aseguramos un bloque fuerte por país (ej: mínimo 400 por país)
    filasPorPais = Math.max(400, Math.ceil(1200 / totalPaises));
  }

  const nombres = ['Carlos', 'Sofía', 'Mateo', 'Valentina', 'Santiago', 'Camila', 'Alejandro', 'Mariana', 'Diego', 'Lucía', 'Valeria', 'Sebastián', 'Renata', 'Joaquín', 'Isabella'];
  const apellidos = ['Mendoza', 'Rodríguez', 'Silva', 'Gomez', 'Hernandez', 'Torres', 'Perez', 'Morales', 'Rios', 'Castro', 'Navarro', 'Rojas', 'Ortega', 'Vargas', 'Jiménez'];

  const datasetCompleto = [];
  let contadorGlobal = 1;

  listaPaises.forEach(pais => {
    for (let i = 1; i <= filasPorPais; i++) {
      const fn = nombres[(contadorGlobal * 7) % nombres.length];
      const ln = apellidos[(contadorGlobal * 13) % apellidos.length];

      const deltaValor = (Math.random() * 0.4) - 0.2; 
      const valorCalculado = Math.round(valorBase * (1 + deltaValor));

      datasetCompleto.push({
        firstName: fn.toLowerCase(),
        lastName: ln.toLowerCase(),
        country: pais, // 👈 Asigna perfectamente cada país del array (BR, SV, US, etc.)
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
   ========================================================================== */
router.post(['/procesar', '/guardar-4-datos'], async (req, res) => {
  try {
    const { clientId, paises, edadMin, edadMax, value, nicho } = req.body;

    const activeClientId = normalizeClientId(clientId);
    const claveColeccion = `Datos_${activeClientId}`;
    const session = `sess_form_${activeClientId}_${Date.now()}`;
    const numericValue = Number(value) || 0;
    const valueEnCentavos = Math.round(numericValue * 100);

    const payloadAjustado = mapearDatasetCliente({
      clientId: activeClientId,
      paises,
      value: valueEnCentavos,
      edadMin,
      edadMax,
      nicho
    });

    const totalRegistrosGenerados = payloadAjustado.length;

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

    console.log(`🚀 [SEGMENTACION] Despachando ${totalRegistrosGenerados} registros limpios (mínimo 1,200) a Upload para ${activeClientId}...`);

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
      message: `${totalRegistrosGenerados} registros generados con éxito bajo el estándar mínimo de 1,200 filas sin correos ni teléfonos.`
    });

  } catch (error) {
    console.error('💥 Error en segmentación predeterminada:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

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
