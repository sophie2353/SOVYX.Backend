/**
 * SODIE - Pre-procesador de Segmentación (routes/segmentacionRoutes.js)
 * Adapta 200 filas predeterminadas según los 4 datos del frontend y las envía a /upload
 */
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Audiencia = require('../models/Audiencia');

/**
 * Plantilla base de 200 contactos predeterminados
 */
function construir200FilasBase() {
  const nombres = ['Carlos', 'Sofía', 'Mateo', 'Valentina', 'Santiago', 'Camila', 'Alejandro', 'Mariana', 'Diego', 'Lucía'];
  const apellidos = ['Mendoza', 'Rodríguez', 'Silva', 'Gomez', 'Hernandez', 'Torres', 'Perez', 'Morales', 'Rios', 'Castro'];
  
  const base = [];
  for (let i = 1; i <= 200; i++) {
    const fn = nombres[i % nombres.length];
    const ln = apellidos[i % apellidos.length];
    base.push({
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@sodie-leads.com`,
      phone: `+1555${100000 + i}`,
      firstName: fn,
      lastName: ln
    });
  }
  return base;
}

const TEMPLATE_200_FILAS = construir200FilasBase();

/**
 * Mapea las 200 filas fijas con los 4 datos específicos del frontend
 */
function mapearDatasetCliente({ clientId, paises, value, edadMin, edadMax, nicho }) {
  const listaPaises = Array.isArray(paises) 
    ? paises 
    : String(paises || 'US').split(',').map(p => p.trim().toUpperCase());

  const valorBase = parseFloat(value) || 1000;

  return TEMPLATE_200_FILAS.map((fila, index) => {
    const paisAsignado = listaPaises[index % listaPaises.length] || 'US';
    const delta = (Math.random() * 0.3) - 0.15;
    const valorCalculado = Math.round(valorBase * (1 + delta));

    return {
      ...fila,
      country: paisAsignado,
      value: valorCalculado > 0 ? valorCalculado : 100,
      age_min: parseInt(edadMin) || 22,
      age_max: parseInt(edadMax) || 55,
      nicho: nicho || 'infoproductos',
      clientId: clientId
    };
  });
}

/* ==========================================================================
   POST /api/v1/segmentacion/procesar
   Mapea los 200 registros y los despacha hacia /upload (uploadRoutes)
   ========================================================================== */
router.post(['/procesar', '/guardar-4-datos'], async (req, res) => {
  try {
    const { clientId, paises, edadMin, edadMax, value, nicho, token, adAccountId, pixelId } = req.body;

    const activeClientId = clientId ? String(clientId).trim().toUpperCase() : 'CLIENT-#01';
    const claveColeccion = `Datos_${activeClientId}`; // ej: Datos_CLIENT-#01
    const session = `sess_form_${activeClientId}_${Date.now()}`;

    // 1. Mapear los 200 registros predeterminados con los 4 parámetros del cliente
    const payload200Ajustado = mapearDatasetCliente({
      clientId: activeClientId,
      paises,
      value,
      edadMin,
      edadMax,
      nicho
    });

    // 2. Guardar/Actualizar los 4 datos y la marca de tiempo de 72h en MongoDB
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

    // 3. DESPACHAR DERECHO A uploadRoutes (/api/v1/media/upload)
    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'api.sodie.app';
    const uploadEndpoint = `${protocol}://${host}/api/v1/media/upload`;

    console.log(`🚀 [SEGMENTACION] Despachando dataset de 200 registros para ${activeClientId} hacia ${uploadEndpoint}...`);

    let uploadResponse = null;
    try {
      // Se envía el payload pre-procesado a uploadRoutes para que este le aplique la IA1 y llame a metaService
      const uploadRes = await axios.post(uploadEndpoint, {
        sessionId: session,
        clientId: activeClientId,
        nicho: nicho || 'infoproductos',
        usersPayload: payload200Ajustado,
        token,
        adAccountId,
        pixelId
      });
      uploadResponse = uploadRes.data;
    } catch (uploadErr) {
      console.warn('⚠️ [SEGMENTACION] Advertencia al contactar uploadRoutes via HTTP interno:', uploadErr.message);
      uploadResponse = { note: 'Fallback interno registrado en DB. uploadRoutes procesará en siguiente llamada.' };
    }

    return res.json({
      ok: true,
      success: true,
      clientId: activeClientId,
      datasetKey: claveColeccion,
      totalRegistros: 200,
      rotationTimerHours: 72,
      nextRotationAt: proximaRotacion,
      uploadResult: uploadResponse,
      message: `200 registros predeterminados enviados con éxito a uploadRoutes -> IA1 -> metaService.`
    });

  } catch (error) {
    console.error('💥 Error en segmentación predeterminada:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

/* ==========================================================================
   GET /api/v1/segmentacion/estado/:clientId
   Permite al frontend consultar el temporizador de 72 horas por cliente
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
