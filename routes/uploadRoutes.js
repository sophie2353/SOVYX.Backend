// routes/uploadRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');

const Audiencia = require('../models/Audiencia');
const Client = require('../models/clients');

let ia1Instance = null;
try {
  const IA1 = require('../modules/sovyxIA1Segmenter');
  ia1Instance = new IA1();
} catch (e) {
  try {
    const IA1 = require('../../modules/sovyxIA1Segmenter');
    ia1Instance = new IA1();
  } catch (err) {
    console.warn('⚠️ [UPLOAD] No se pudo instanciar sovyxIA1Segmenter.');
  }
}

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});

function normalizeClientId(rawId) {
  if (!rawId) return 'CLIENT-#01';
  const clean = String(rawId).trim().toUpperCase();
  if (clean.includes('ADMIN') || clean === 'ADMIN') return 'ADMIN';
  const match = clean.match(/\d+/);
  const numId = match ? match[0].padStart(2, '0') : '01';
  return `CLIENT-#${numId}`;
}

function extraerCamposTexto(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

  return rawRows.map(row => {
    const getVal = (possibleKeys) => {
      const foundKey = Object.keys(row).find(k => 
        possibleKeys.includes(k.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
      );
      return foundKey ? String(row[foundKey]).trim() : '';
    };

    const country = getVal(['country', 'pais', 'geo', 'codigo pais']);
    const zip = getVal(['codigo postal', 'zip', 'zip code', 'postal code', 'cp']);
    const fn = getVal(['nombre', 'first name', 'firstname', 'fname']);
    const ln = getVal(['apellido', 'last name', 'lastname', 'lname']);
    const value = getVal(['value', 'valor', 'monto', 'purchase value', 'ltv', 'precio', 'total']);

    return {
      country: country ? country.toUpperCase() : 'US',
      zip: zip,
      firstName: fn.toLowerCase(),
      lastName: ln.toLowerCase(),
      value: value ? parseFloat(value.replace(/[^0-9.-]+/g, '')) || 0 : 0
    };
  }).filter(item => item.firstName || item.lastName || item.value > 0);
}

async function procesarYGuardarAudiencia({ sessionId, clientId, nicho, usersPayload, fileName = 'dataset.xlsx' }) {
  const activeClientId = normalizeClientId(clientId);
  const session = sessionId || `sess_${activeClientId}_${Date.now()}`;
  const nichoObjetivo = nicho || 'infoproductos';

  let extractedTargeting;
  if (ia1Instance && typeof ia1Instance.segmentarCsv === 'function') {
    const dummyCsv = usersPayload.map(u => `${u.firstName},${u.lastName},${u.country},${u.value}`).join('\n');
    extractedTargeting = await ia1Instance.segmentarCsv(dummyCsv, { nicho: nichoObjetivo });
  } else if (ia1Instance && typeof ia1Instance.generarSegmentacion === 'function') {
    extractedTargeting = ia1Instance.generarSegmentacion(nichoObjetivo, false, { 
      usersPayload: usersPayload 
    });
  } else {
    const paisesUnicos = [...new Set(usersPayload.map(u => u.country || 'US'))];
    extractedTargeting = {
      nicho: nichoObjetivo,
      age_min: usersPayload[0]?.age_min || 22,
      age_max: usersPayload[0]?.age_max || 55,
      country: paisesUnicos[0] || 'US',
      countriesFound: paisesUnicos,
      usersPayload: usersPayload
    };
  }

  if (!extractedTargeting.usersPayload || extractedTargeting.usersPayload.length === 0) {
    extractedTargeting.usersPayload = usersPayload;
  }

  const audienciaGuardada = await Audiencia.findOneAndUpdate(
    { clientId: activeClientId },
    {
      $set: {
        sessionId: session,
        clientId: activeClientId,
        fileUrl: `memory://${fileName}`,
        fileName: fileName,
        segmentacion: {
          ...extractedTargeting,
          usersPayload: extractedTargeting.usersPayload,
          custom_audiences: []
        },
        totalRegistros: usersPayload.length,
        estado: 'PENDIENTE_CONEXION_META'
      }
    },
    { upsert: true, new: true }
  );

  return {
    ok: true,
    clientId: activeClientId,
    audienciaId: audienciaGuardada._id,
    totalRegistros: usersPayload.length,
    targeting: extractedTargeting
  };
}

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { sessionId, clientId, nicho } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Archivo Excel/CSV no recibido' });

    const parsedPayload = extraerCamposTexto(req.file.buffer);
    if (!parsedPayload || parsedPayload.length === 0) {
      return res.status(400).json({ error: 'No se encontraron registros válidos con nombres o valores procesables.' });
    }

    const resultado = await procesarYGuardarAudiencia({
      sessionId,
      clientId,
      nicho,
      usersPayload: parsedPayload,
      fileName: req.file.originalname
    });

    return res.json({ 
      ok: true, 
      ...resultado,
      message: 'Excel procesado con IA1 (sin correos/teléfonos) y guardado en Audiencias.'
    });

  } catch (error) {
    console.error('💥 Error procesando archivo en Upload:', error);
    return res.status(500).json({ 
      ok: false, 
      error: 'Error al procesar el archivo Excel y generar la segmentación.',
      details: error.message 
    });
  }
});

router.get('/test-debug', async (req, res) => {
  return res.status(200).json({
    ok: true,
    message: 'El endpoint de upload responde correctamente.',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
module.exports.procesarYGuardarAudiencia = procesarYGuardarAudiencia;
module.exports.normalizeClientId = normalizeClientId;
