const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const tokens = require('../config/tokens');
const { enviarEventoCompraCAPI } = require('../services/capiService');

// Configuración de almacenamiento local para uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'uploads/general';
    if (file.mimetype.includes('video')) folder = 'uploads/videos';
    else if (file.mimetype.includes('pdf')) folder = 'uploads/pdfs';
    else if (file.originalname.match(/\.(xls|xlsx|csv)$/)) folder = 'uploads/excels';

    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });
global.dashboardVideoConfig = global.dashboardVideoConfig || { url: null, mostrarEnDashboard: false };
global.dashboardExcelConfig = global.dashboardExcelConfig || { url: null, fijoEnDashboard: false };
global.uploadedPdfsDB = global.uploadedPdfsDB || {};

// 1. Subir Video desde Admin y fijar en Dashboard
router.post('/upload-video', upload.single('video'), (req, res) => {
  const { adminKey, mostrarEnDashboard } = req.body;
  if (adminKey !== tokens.SOVYX_ADMIN_KEY) {
    return res.status(403).json({ error: 'Llave de administración inválida' });
  }

  if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo de video.' });

  const videoUrl = `/uploads/videos/${req.file.filename}`;
  global.dashboardVideoConfig = {
    url: videoUrl,
    mostrarEnDashboard: mostrarEnDashboard === 'true' || mostrarEnDashboard === true
  };

  res.json({
    success: true,
    message: 'Video subido correctamente 😮‍💨🙌🏼',
    videoConfig: global.dashboardVideoConfig
  });
});

// 2. Subir PDF para descarga de cliente pospago
router.post('/upload-pdf', upload.single('pdf'), (req, res) => {
  const { adminKey, sessionId } = req.body;
  if (adminKey !== tokens.SOVYX_ADMIN_KEY) {
    return res.status(403).json({ error: 'Llave de administración inválida' });
  }

  if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo PDF.' });

  if (sessionId) {
    global.uploadedPdfsDB[sessionId] = req.file.filename;
  }

  res.json({
    success: true,
    message: 'PDF preparado para descarga de cliente pospago.',
    fileName: req.file.filename,
    sessionId: sessionId || 'GENERAL'
  });
});

// 3. Subir Excel (Video Antes vs Después) y fijar en Dashboard
router.post('/upload-excel-antes-despues', upload.single('excel'), (req, res) => {
  const { adminKey } = req.body;
  if (adminKey !== tokens.SOVYX_ADMIN_KEY) {
    return res.status(403).json({ error: 'Llave de administración inválida' });
  }

  if (!req.file) return res.status(400).json({ error: 'No se subió el archivo Excel.' });

  const excelUrl = `/uploads/excels/${req.file.filename}`;
  global.dashboardExcelConfig = {
    url: excelUrl,
    fijoEnDashboard: true,
    updatedAt: new Date().toISOString()
  };

  res.json({
    success: true,
    message: 'Excel "Antes vs Después" fijado en el dashboard principal 🤬',
    excelConfig: global.dashboardExcelConfig
  });
});

// 4. Confirmación de Pago Manual y Disparo Directo a Meta CAPI
router.post('/confirmar-pago-manual', async (req, res) => {
  try {
    const { adminKey, slotNumber = 1, emailCliente = 'cliente@sovyx.com', monto = 10000 } = req.body;

    if (adminKey && adminKey !== tokens.SOVYX_ADMIN_KEY) {
      return res.status(403).json({ error: 'Llave de administración inválida' });
    }

    // A. Disparo del evento 'Purchase' a Meta Conversions API (CAPI)
    const capiResult = await enviarEventoCompraCAPI({
      email: emailCliente,
      monto: Number(monto),
      currency: 'USD',
      eventName: 'Purchase'
    });

    // B. Actualización del slot y estado global en memoria
    if (typeof global.sessionsDB !== 'undefined') {
      const sessionKey = `slot_${slotNumber}`;
      global.sessionsDB[sessionKey] = {
        ...(global.sessionsDB[sessionKey] || {}),
        pagoConfirmado: true,
        montoPagado: monto,
        fechaPago: new Date().toISOString()
      };
    }

    res.json({
      success: true,
      message: `Pago del Slot #${slotNumber} confirmado e inyectado en Meta CAPI 😮‍💨🙌🏼`,
      slotNumber,
      monto,
      capiResult
    });
  } catch (error) {
    console.error('💥 Error al procesar confirmación manual de pago:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno procesando el pago y enviando el evento a Meta CAPI.',
      details: error.message
    });
  }
});

module.exports = router;
