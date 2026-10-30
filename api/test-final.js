const express = require('express');
const router = express.Router();
const fsPromises = require('fs/promises');
const path = require('path');

// Responde tanto a la raíz del router como a la ruta explícita por si tienes prefijos en tu index.js
router.get(['/', '/test-final', '/api/test-final', 'api/admin/test-final'], async (req, res) => {
const BASE = process.cwd(); // En Render esto es: /opt/render/project/src
console.log('🤠 Iniciando cacería de la imagen desde /api/test-final...');

  const rutaExacta = path.join(__dirname, '..', 'routes', 'sodie-placeholder.jpg');

  try {
    await fsPromises.access(rutaExacta);
    
    return res.json({
      estado: '✅ ¡BINGO! IMAGEN ENCONTRADA.',
      rutaProbada: rutaExacta,
      instruccionParaMetaService: "Pon exactamente esta línea en metaService.js: const imagePath = path.join(__dirname, 'sodie-placeholder.jpg');"
    });
    
  } catch (err) {
    return res.json({
      estado: '❌ Falló',
      rutaProbada: rutaExacta,
      error: err.message
    });
  }
});

module.exports = router;
