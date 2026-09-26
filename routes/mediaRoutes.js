const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuración de Multer para guardar archivos directamente en /public
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const publicPath = path.join(__dirname, '../public');
    if (!fs.existsSync(publicPath)) {
      fs.mkdirSync(publicPath, { recursive: true });
    }
    cb(null, publicPath);
  },
  filename: (req, file, cb) => {
    // Si es el endpoint de video o contrato, asignamos un nombre fijo para sobreescribir el activo
    if (file.fieldname === 'video') {
      cb(null, 'video_demo.mp4');
    } else if (file.fieldname === 'contract') {
      cb(null, 'contrato.pdf');
    } else {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  }
});

const upload = multer({ storage });

// --- ENDPOINTS PÚBLICOS (CONSUMIDOS POR APP.JS Y CLIENT.JS) ---

// Obtener el video activo
router.get('/active-video', (req, res) => {
  return res.json({
    success: true,
    videoUrl: '/video_demo.mp4'
  });
});

// --- ENDPOINTS ADMINISTRATIVOS (SUBIDA DESDE ADMIN.JS) ---

// Subir o actualizar el Video Demo
router.post('/upload-video', upload.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se envió ningún video.' });
    }
    return res.json({
      success: true,
      message: 'Video demo actualizado correctamente.',
      videoUrl: '/video_demo.mp4'
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
