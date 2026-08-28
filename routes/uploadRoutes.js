// routes/uploadRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');

const Audiencia = require('../models/Audiencia');

let ia1Instance = null;
try {
  const IA1 = require('../modules/sovyxIA1Segmenter');
  ia1Instance = new IA1();
} catch (e) {
  try {
    const IA1 = require('../../modules/sovyxIA1Segmenter');
    ia1Instance = new IA1();
  } catch (err) {
    console.warn('⚠️ [UPLOAD] No se pudo instanciar sovyxIA1Segmenter. Usando fallback.');
  }
}

const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload-csv', upload.single('file'), async (req, res) => {
  try {
    const { sessionId, nicho } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Archivo no recibido' });

    const session = sessionId || 'sess_default';
    const nichoObjetivo = nicho || 'fitness_coach';

    // 1. Decodificar el buffer
    const fileContent = req.file.buffer.toString('utf-8');

    // 2. Procesar la data con IA1
    let extractedTargeting;

    if (ia1Instance && typeof ia1Instance.segmentarCsv === 'function') {
      extractedTargeting = await ia1Instance.segmentarCsv(fileContent, nichoObjetivo);
    } else if (ia1Instance && typeof ia1Instance.generarSegmentacion === 'function') {
      extractedTargeting = ia1Instance.generarSegmentacion(nichoObjetivo, false, { rawCsv: fileContent });
    } else {
      extractedTargeting = {
        nicho: nichoObjetivo,
        age_min: 22,
        age_max: 45,
        country: 'US'
      };
    }

    if (typeof extractedTargeting === 'object' && !extractedTargeting.nicho) {
      extractedTargeting.nicho = nichoObjetivo;
    }

    // 3. Persistir en MongoDB cumpliendo con el Schema de Audiencia
    const audienciaGuardada = await Audiencia.findOneAndUpdate(
      { sessionId: session },
      {
        sessionId: session,
        fileUrl: `memory://${req.file.originalname}`, // Cumple con required: true en Schema
        fileName: req.file.originalname,
        segmentacion: extractedTargeting,
        estado: 'PENDIENTE_CONFIRMACION'
      },
      { upsert: true, new: true }
    );

    if (typeof sessionsDB !== 'undefined') {
      sessionsDB[session] = {
        ...sessionsDB[session],
        fileUploaded: true,
        targetingData: extractedTargeting,
        audienciaId: audienciaGuardada._id
      };
    }

    return res.json({ 
      ok: true, 
      audienciaId: audienciaGuardada._id,
      targeting: extractedTargeting 
    });

  } catch (error) {
    console.error('💥 Error procesando CSV en IA1:', error);
    return res.status(500).json({ 
      ok: false, 
      error: 'Error al procesar el archivo y guardar la segmentación en MongoDB.',
      details: error.message 
    });
  }
});

module.exports = router;
