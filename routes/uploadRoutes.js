// routes/uploadRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');

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

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // Límite de 15MB en memoria para Render
});

// Función de extracción y limpiado previa de los 6 campos requeridos
function extraerCamposTexto(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

  return rawRows.map(row => {
    // Helper para buscar claves sin importar Mayúsculas/Minúsculas/Acentos
    const getVal = (possibleKeys) => {
      const foundKey = Object.keys(row).find(k => 
        possibleKeys.includes(k.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
      );
      return foundKey ? String(row[foundKey]).trim() : '';
    };

    const email = getVal(['email', 'e-mail', 'correo', 'correo electronico', 'mail']);
    const phone = getVal(['phone', 'telefono', 'tel', 'celular', 'mobile']);
    const zip = getVal(['codigo postal', 'zip', 'zip code', 'postal code', 'cp']);
    const fn = getVal(['nombre', 'first name', 'firstname', 'fname']);
    const ln = getVal(['apellido', 'last name', 'lastname', 'lname']);
    const value = getVal(['value', 'valor', 'monto', 'purchase value', 'ltv', 'precio', 'total']);

    return {
      email: email.toLowerCase(),
      phone: phone.replace(/\D/g, ''),
      zip: zip,
      fn: fn.toLowerCase(),
      ln: ln.toLowerCase(),
      value: value ? parseFloat(value.replace(/[^0-9.-]+/g, '')) || 0 : 0
    };
  }).filter(item => item.email || item.phone || item.fn || item.value > 0);
}

router.post('/upload-csv', upload.single('file'), async (req, res) => {
  try {
    const { sessionId, nicho, token, adAccountId, nombreBorrador, autoActivate } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Archivo no recibido' });

    const session = sessionId || 'sess_default';
    const nichoObjetivo = nicho || 'fitness_coach';

    // 1. Extraer los 6 campos requeridos (email, phone, zip, fn, ln, value) desde el archivo
    const parsedPayload = extraerCamposTexto(req.file.buffer);

    if (!parsedPayload || parsedPayload.length === 0) {
      return res.status(400).json({ error: 'No se encontraron registros válidos con texto procesable en el archivo.' });
    }

    // Convertir el buffer a string limpio por si la IA1 requiere inspeccionar el raw text
    let fileContent = req.file.buffer.toString('utf-8');
    if (fileContent.charCodeAt(0) === 0xFEFF) {
      fileContent = fileContent.slice(1);
    }

    // 2. Procesar y enriquecer los datos con la IA1
    let extractedTargeting;

    if (ia1Instance && typeof ia1Instance.segmentarCsv === 'function') {
      extractedTargeting = await ia1Instance.segmentarCsv(parsedPayload, nichoObjetivo, fileContent);
    } else if (ia1Instance && typeof ia1Instance.generarSegmentacion === 'function') {
      extractedTargeting = ia1Instance.generarSegmentacion(nichoObjetivo, false, { 
        rawCsv: fileContent,
        usersPayload: parsedPayload 
      });
    } else {
      extractedTargeting = {
        nicho: nichoObjetivo,
        age_min: 22,
        age_max: 45,
        country: 'US',
        countriesFound: ['US'],
        usersPayload: parsedPayload
      };
    }

    // Garantizar que la lista estructurada con los 6 campos persista tras pasar por la IA1
    if (!extractedTargeting.usersPayload || extractedTargeting.usersPayload.length === 0) {
      extractedTargeting.usersPayload = parsedPayload;
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
        totalRegistros: parsedPayload.length,
        estado: 'PROCESANDO_META'
      },
      { upsert: true, new: true }
    );

    if (typeof global.sessionsDB !== 'undefined') {
      global.sessionsDB[session] = {
        ...(global.sessionsDB[session] || {}),
        fileUploaded: true,
        targetingData: extractedTargeting,
        audienciaId: audienciaGuardada._id
      };
    }

    // 4. Enviar los datos extraídos y procesados a Meta Services (quien creará el borrador, aplicará hashing y Lookalike)
    let metaResult = null;
    const userToken = token || process.env.ACCESS_TOKEN;
    const userAdAccount = adAccountId || process.env.AD_ACCOUNT_ID;
    const draftName = nombreBorrador || 'Prueba Hora 24';

    if (userToken && userAdAccount) {
      console.log(`📡 [UPLOAD] Enviando ${extractedTargeting.usersPayload.length} registros enriquecidos a Meta Services para borrador "${draftName}"...`);

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
        usersPayload: extractedTargeting.usersPayload, // Pasa email, phone, zip, fn, ln y value procesados
        countriesFound: extractedTargeting.countriesFound || ['US']
      });

      await Audiencia.findByIdAndUpdate(audienciaGuardada._id, { estado: 'COMPLETADO_Y_ACTIVADO' });
    }

    return res.json({ 
      ok: true, 
      audienciaId: audienciaGuardada._id,
      totalRegistros: parsedPayload.length,
      targeting: extractedTargeting,
      metaResult: metaResult || { message: 'Data con valor e identidad extraída e inyectada internamente. Listo para activación.' }
    });

  } catch (error) {
    console.error('💥 Error procesando archivo en IA1 y Meta:', error);
    return res.status(500).json({ 
      ok: false, 
      error: 'Error al procesar los campos del archivo y sincronizar con Meta Services.',
      details: error.message 
    });
  }
});

module.exports = router;
