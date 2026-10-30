const express = require('express');
const router = express.Router();
const fsPromises = require('fs/promises');
const path = require('path');

// Responde tanto a la raíz del router como a la ruta explícita por si tienes prefijos en tu index.js
router.get(['/', '/test-final', '/api/test-final', 'api/admin/test-final'], async (req, res) => {
  console.log('🤠 Iniciando cacería de la imagen desde /api/test-final...');

  // El radar: Busca desde la perspectiva de la carpeta "api"
  const rutasAPrabar = [
    { id: 1, desc: 'En public via cwd', ruta: path.join(process.cwd(), 'public', 'sodie-placeholder.jpg') },
    { id: 2, desc: 'En routes via cwd', ruta: path.join(process.cwd(), 'routes', 'sodie-placeholder.jpg') },
    { id: 3, desc: 'En public subiendo un nivel (__dirname)', ruta: path.join(__dirname, '..', 'public', 'sodie-placeholder.jpg') },
    { id: 4, desc: 'En routes subiendo un nivel (__dirname)', ruta: path.join(__dirname, '..', 'routes', 'sodie-placeholder.jpg') },
    { id: 5, desc: 'En src/public (Clásico de Render)', ruta: path.join(process.cwd(), 'src', 'public', 'sodie-placeholder.jpg') },
    { id: 6, desc: 'En src/routes (Clásico de Render)', ruta: path.join(process.cwd(), 'src', 'routes', 'sodie-placeholder.jpg') }
  ];

  const resultados = [];
  let rutaGanadora = null;

  for (const item of rutasAPrabar) {
    try {
      await fsPromises.access(item.ruta); 
      resultados.push({ id: item.id, status: '✅ ENCONTRADA', ruta: item.ruta });
      if (!rutaGanadora) rutaGanadora = item.ruta;
    } catch (err) {
      resultados.push({ id: item.id, status: '❌ NO', ruta: item.ruta });
    }
  }

  return res.json({
    mensaje: rutaGanadora ? '¡Habemus Imagen! 🗿✨' : 'Ninguna ruta funcionó 💀',
    rutaGanadora: rutaGanadora || 'Sigue perdida en el limbo',
    detalles: resultados
  });
});

module.exports = router;
