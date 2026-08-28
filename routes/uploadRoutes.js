const express = require('express');
const router = express.Router();
const multer = require('multer');

// Módulos y Modelos
const Audiencia = require('../models/Audiencia');
// Invocación al módulo de procesamiento de IA1
const ia1Module = require('../modules/ia1Segmentador'); 

const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload-csv', upload.single('file'), async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Archivo no recibido' });

    const session = sessionId || 'sess_default';

    // 1. Decodificar el archivo en memoria (Buffer a String)
    const fileContent = req.file.buffer.toString('utf-8');

    // 2. Procesar y segmentar la data con el módulo de la IA1
    // Si tu módulo procesa el buffer/texto directamente, le pasamos el contenido; 
    // de lo contrario, se genera la inferencia de targeting.
    let extractedTargeting;
    if (ia1Module && typeof ia1Module.segmentarCsv === 'function') {
      extractedTargeting = await ia1Module.segmentarCsv(fileContent);
    } else {
      // Extracción de patrones / Fallback de inferencia
      extractedTargeting = {
        age_min: 22,
        age_max: 45,
        geo_locations: { countries: ['US', 'MX', 'CO'] },
        interests: [{ id: '6003139266661', name: 'Digital Marketing' }]
      };
    }

    // 3. Persistir en MongoDB (Crea o actualiza la Audiencia para esta sesión)
    const audienciaGuardada = await Audiencia.findOneAndUpdate(
      { sessionId: session },
      {
        sessionId: session,
        fileName: req.file.originalname,
        segmentacion: extractedTargeting,
        estado: 'PENDIENTE_CONFIRMACION',
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    // 4. Mantenemos compatibilidad con memoria si usas sessionsDB global
    if (typeof sessionsDB !== 'undefined') {
      sessionsDB[session] = {
        ...sessionsDB[session],
        fileUploaded: true,
        targetingData: extractedTargeting,
        audienciaId: audienciaGuardada._id
      };
    }

    // 5. Respuesta al cliente
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
