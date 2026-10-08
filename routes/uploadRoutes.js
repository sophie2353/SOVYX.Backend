// routes/uploadRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');

const Audiencia = require('../models/Audiencia');
const Client = require('../models/clients');
const campaignStorage = require('../services/campaignStorageService');

// Carga centralizada de metaServices
let metaService = null;
try {
  metaService = require('../services/metaServices');
} catch (e) {
  try {
    metaService = require('../services/metaService');
  } catch (err) {
    console.warn('⚠️ [UPLOAD] metaServices no encontrado.');
  }
}

// Carga centralizada de IA1 Segmenter
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

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // Límite de 15MB para servidor Render
});

/**
 * Normaliza el clientId a formato limpio (ej: 'CLIENT-#01' -> 'CLIENT-#01')
 */
function normalizeClientId(rawId) {
  if (!rawId) return 'CLIENT-#01';
  const clean = String(rawId).trim().toUpperCase();
  if (clean.includes('ADMIN')) return 'ADMIN';
  const match = clean.match(/\d+/);
  const numId = match ? match[0].padStart(2, '0') : '01';
  return `CLIENT-#${numId}`;
}

/**
 * Extrae y limpia los campos clave desde Excel / CSV para el Schema Match de Meta
 */
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

router.post('/', upload.single('file'), async (req, res) => {
  try {
    const { sessionId, clientId, nicho, token, adAccountId, pixelId, dailyBudget, version } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Archivo Excel/CSV no recibido' });

    const activeClientId = normalizeClientId(clientId);
    const session = sessionId || `sess_${activeClientId}_${Date.now()}`;
    const nichoObjetivo = nicho || 'infoproductos';

    // 1. Extraer los campos requeridos desde la hoja subida
    const parsedPayload = extraerCamposTexto(req.file.buffer);

    if (!parsedPayload || parsedPayload.length === 0) {
      return res.status(400).json({ error: 'No se encontraron registros válidos con emails o teléfonos procesables.' });
    }

    let fileContent = req.file.buffer.toString('utf-8');
    if (fileContent.charCodeAt(0) === 0xFEFF) {
      fileContent = fileContent.slice(1);
    }

    // 2. Procesar e inyectar segmentación con Sovyx IA1
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

    // 3. Resolver credenciales y contexto desde la DB si no vienen explícitos
    let userToken = token || process.env.META_ACCESS_TOKEN;
    let userAdAccount = adAccountId || process.env.AD_ACCOUNT_ID;
    let userPixelId = pixelId || process.env.META_PIXEL_ID;

    const clientDoc = await Client.findOne({ clientId: activeClientId });
    if (clientDoc && clientDoc.meta) {
      userToken = clientDoc.meta.fb_token || userToken;
      userAdAccount = clientDoc.meta.act_id || userAdAccount;
      userPixelId = clientDoc.meta.pixel_id || userPixelId;
    }

    // 4. Persistir datos del dataset en MongoDB
    const audienciaGuardada = await Audiencia.findOneAndUpdate(
      { sessionId: session },
      {
        sessionId: session,
        clientId: activeClientId,
        fileUrl: `memory://${req.file.originalname}`,
        fileName: req.file.originalname,
        segmentacion: extractedTargeting,
        totalRegistros: parsedPayload.length,
        estado: 'PROCESANDO_META'
      },
      { upsert: true, new: true }
    );

    // 5. Invocación a MetaServices (Ejecuta ciclo de 24h y guarda campaign_id en storage)
    let metaResult = null;

    if (userToken && userAdAccount && metaService && typeof metaService.procesarCicloHora24 === 'function') {
      console.log(`📡 [UPLOAD] Enviando ${extractedTargeting.usersPayload.length} registros para ${activeClientId} a Meta Services...`);

      metaResult = await metaService.procesarCicloHora24({
        clientId: activeClientId,
        token: userToken,
        adAccountId: userAdAccount,
        pixelId: userPixelId,
        usersPayload: extractedTargeting.usersPayload,
        dailyBudget: dailyBudget ? parseFloat(dailyBudget) : 1000,
        version: version || 'V3.5'
      });

      await Audiencia.findByIdAndUpdate(audienciaGuardada._id, { estado: 'COMPLETADO_Y_ACTIVADO' });
    } else {
      console.warn('⚠️ [UPLOAD] No se ejecutó procesarCicloHora24: Faltan tokens, cuenta publicitaria o servicio.');
    }

    return res.json({ 
      ok: true, 
      clientId: activeClientId,
      audienciaId: audienciaGuardada._id,
      totalRegistros: parsedPayload.length,
      targeting: extractedTargeting,
      campaignId: metaResult?.campaignId || null,
      metaResult: metaResult || { message: 'Data procesada correctamente. Pendiente conexión completa a Meta.' }
    });

  } catch (error) {
    console.error('💥 Error procesando archivo en IA1 y Meta:', error);
    return res.status(500).json({ 
      ok: false, 
      error: 'Error al procesar el archivo Excel y sincronizar con Meta Services.',
      details: error.message 
    });
  }
});

module.exports = router;
