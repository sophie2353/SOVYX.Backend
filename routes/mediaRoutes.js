const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    // Si se sube o reemplaza el vídeo promocional
    if (req.body.type === 'promo_video' || file.fieldname === 'video') {
      const ext = path.extname(file.originalname) || '.mp4';
      return cb(null, `promo-video-active${ext}`);
    }
    // Para imágenes y contratos PDF
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const uploadMedia = multer({
  storage,
  limits: { fileSize: 60 * 1024 * 1024 } // 60MB máximo
});

// POST /api/media/upload
router.post('/upload', uploadMedia.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se recibió ningún archivo de media.' });
    }

    const publicUrl = `/uploads/${req.file.filename}?v=${Date.now()}`;

    return res.json({
      success: true,
      url: publicUrl,
      filename: req.file.filename,
      mimetype: req.file.mimetype
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
