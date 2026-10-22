// routes/uploadRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');

const Audiencia = require('../models/Audiencia');
const Client = require('../models/clients');

let metaService = null;
try {
  metaService = require('./metaService');
} catch (err) {
  console.warn('⚠️ [UPLOAD] metaService no encontrado.');
}

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
  if (clean.includes('ADMIN')) return 'ADMIN';
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

    const email = getVal(['email', 'e-mail', 'correo', 'correo electronico', 'mail']);
    const phone = getVal(['phone', 'telefono', 'tel', 'celular', 'mobile']);
    const country = getVal(['country', 'pais', 'geo', 'codigo pais']);
    const zip = getVal(['codigo postal', 'zip', 'zip code', 'postal code', 'cp']);
    const fn = getVal(['nombre', 'first name', 'firstname', 'fname']);
    const ln = getVal(['apellido', 'last name', 'lastname', 'lname']);
    const value = getVal(['value', 'valor', 'monto', 'purchase value', 'ltv', 'precio', 'total']);

    return {
      email: email.toLowerCase(),
      phone: phone.replace(/\D/g, ''),
      country: country ? country.toUpperCase() : 'US',
      zip: zip,
      firstName: fn.toLowerCase(),
      lastName: ln.toLowerCase(),
      value: value ? parseFloat(value.replace(/[^0-9.-]+/g, '')) || 0 : 0
    };
  }).filter(item => item.email || item.phone || item.firstName || item.value > 0);
}

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { sessionId, clientId, nicho, token, adAccountId } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Archivo Excel/CSV no recibido' });

    // Única declaración limpia de activeClientId
    const activeClientId = normalizeClientId(clientId);
    const session = sessionId || `sess_${activeClientId}_${Date.now()}`;
    const nichoObjetivo = nicho || 'infoproductos';

    // 1. Extraer los datos limpios del Excel
    const parsedPayload = extraerCamposTexto(req.file.buffer);

    if (!parsedPayload || parsedPayload.length === 0) {
      return res.status(400).json({ error: 'No se encontraron registros válidos con emails o teléfonos procesables.' });
    }

    let fileContent = req.file.buffer.toString('utf-8');
    if (fileContent.charCodeAt(0) === 0xFEFF) {
      fileContent = fileContent.slice(1);
    }

    // 2. Procesar la segmentación con IA1
    let extractedTargeting;
    if (ia1Instance && typeof ia1Instance.segmentarCsv === 'function') {
      extractedTargeting = await ia1Instance.segmentarCsv(fileContent, { nicho: nichoObjetivo });
    } else if (ia1Instance && typeof ia1Instance.generarSegmentacion === 'function') {
      extractedTargeting = ia1Instance.generarSegmentacion(nichoObjetivo, false, { 
        rawCsv: fileContent,
        usersPayload: parsedPayload 
      });
    } else {
      extractedTargeting = {
        nicho: nichoObjetivo,
        age_min: 22,
        age_max: 55,
        country: 'US',
        countriesFound: ['US'],
        usersPayload: parsedPayload
      };
    }

    if (!extractedTargeting.usersPayload || extractedTargeting.usersPayload.length === 0) {
      extractedTargeting.usersPayload = parsedPayload;
    }

    // Determinar la cuenta publicitaria destino (Cliente vs ADMIN)
    const targetAdAccount = adAccountId 
      || req.body.actId 
      || process.env.AD_ACCOUNT_ID 
      || process.env.META_AD_ACCOUNT_ID;

    // 4. Crear Audiencia Semilla + Lookalikes en Meta
    let metaTargeting = null;
    if (targetAdAccount && metaService && typeof metaService.procesarEInyectarLookalikes === 'function') {
      console.log(`🌱 [UPLOAD] Generando Audiencia Semilla + Lookalikes en Meta para ${activeClientId}...`);
      metaTargeting = await metaService.procesarEInyectarLookalikes({
        adAccountId: targetAdAccount,
        token: process.env.ADMIN_TOKEN || process.env.META_ACCESS_TOKEN,
        usersPayload: extractedTargeting.usersPayload,
        clientId: activeClientId
      });
    }

    // 5. Guardar la audiencia lista en MongoDB
    const audienciaGuardada = await Audiencia.findOneAndUpdate(
      { sessionId: session },
      {
        sessionId: session,
        clientId: activeClientId,
        fileUrl: `memory://${req.file.originalname}`,
        fileName: req.file.originalname,
        segmentacion: {
          ...extractedTargeting,
          custom_audiences: metaTargeting?.custom_audiences || []
        },
        totalRegistros: parsedPayload.length,
        estado: metaTargeting ? 'SEGMENTADA_Y_LISTA' : 'PENDIENTE_CONEXION_META'
      },
      { upsert: true, new: true }
    );

    return res.json({ 
      ok: true, 
      clientId: activeClientId,
      audienciaId: audienciaGuardada._id,
      totalRegistros: parsedPayload.length,
      targeting: extractedTargeting,
      customAudiences: metaTargeting?.custom_audiences || [],
      message: 'Excel procesado con IA1 y Audiencia Semilla inyectada en Meta. Listo para crear borrador.'
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
