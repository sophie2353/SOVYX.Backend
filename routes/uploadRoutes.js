// routes/uploadRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');

const Audiencia = require('../models/Audiencia');
const metaService = require('../services/metaService');

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
    const { sessionId, nicho, token, adAccountId, nombreBorrador, autoActivate } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Archivo no recibido' });

    const session = sessionId || 'sess_default';
    const nichoObjetivo = nicho || 'fitness_coach';

    // 1. Decodificar el buffer del CSV y limpiar el carácter BOM (\uFEFF) de Excel
    let fileContent = req.file.buffer.toString('utf-8');
    if (fileContent.charCodeAt(0) === 0xFEFF) {
      fileContent = fileContent.slice(1);
    }

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
        country: 'US',
        countriesFound: ['US'],
        usersPayload: []
      };
    }

    if (typeof extractedTargeting === 'object' && !extractedTargeting.nicho) {
      extractedTargeting.nicho = nichoObjetivo;
    }

    // 3. Persistir en MongoDB
    const audienciaGuardada = await Audiencia.findOneAndUpdate(
      { sessionId: session },
      {
        sessionId: session,
        fileUrl: `memory://${req.file.originalname}`,
        fileName: req.file.originalname,
        segmentacion: extractedTargeting,
        estado: 'PROCESANDO_META'
      },
      { upsert: true, new: true }
    );

    // Actualizar base de datos global en memoria si existe
    if (typeof global.sessionsDB !== 'undefined') {
      global.sessionsDB[session] = {
        ...(global.sessionsDB[session] || {}),
        fileUploaded: true,
        targetingData: extractedTargeting,
        audienciaId: audienciaGuardada._id
      };
    }

    // 4. Inyección directa en Meta Services
    let metaResult = null;
    const userToken = token || process.env.META_ACCESS_TOKEN;
    const userAdAccount = adAccountId || process.env.META_AD_ACCOUNT_ID;
    const draftName = nombreBorrador || 'Prueba Hora 24-1';

    if (userToken && userAdAccount) {
      console.log(`📡 [UPLOAD] Iniciando inyección en Meta para borrador "${draftName}"...`);

      const dataSegmentacion = {
        age_min: extractedTargeting.age_min,
        age_max: extractedTargeting.age_max,
        geo_locations: {
          countries: extractedTargeting.countriesFound || ['US', 'CO', 'MX']
        }
      };

      metaResult = await metaService.procesarBorradorYActivar({
        sessionId: session,
        token: userToken,
        adAccountId: userAdAccount,
        nombreBorrador: draftName,
        dataSegmentacion: dataSegmentacion,
        usersPayload: extractedTargeting.usersPayload || [],
        countriesFound: extractedTargeting.countriesFound || ['US']
      });

      await Audiencia.findByIdAndUpdate(audienciaGuardada._id, { estado: 'COMPLETADO_Y_ACTIVADO' });
    }

    return res.json({ 
      ok: true, 
      audienciaId: audienciaGuardada._id,
      targeting: extractedTargeting,
      metaResult: metaResult || { message: 'Data procesada e inyectada internamente. Listo para activación.' }
    });

  } catch (error) {
    console.error('💥 Error procesando CSV en IA1 y Meta:', error);
    return res.status(500).json({ 
      ok: false, 
      error: 'Error al procesar el archivo y sincronizar la segmentación en Meta.',
      details: error.message 
    });
  }
});

module.exports = router;
